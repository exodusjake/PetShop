import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { PAYMENT_METHODS } from '../lib/constants.js';
import { SHIPPING_METHODS, checkCoupon, findCoupon, paymentMethods, priceCart, toCents } from '../lib/pricing.js';
import { ConflictError, cancelOrder } from '../lib/orderOps.js';
import { orderConfirmationEmail, sendMail } from '../lib/mailer.js';
import { resolveCart } from './cart.js';

export const orders = Router();
orders.use(['/checkout', '/orders'], requireAuth); // checkout and every order route belong to a logged-in customer
const h = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: (e?: unknown) => void) => fn(req, res).catch(next);

/** Thrown inside the checkout transaction to roll everything back with a friendly message. */
class CheckoutError extends Error { constructor(message: string, public status = 409) { super(message); } }

const ETA_DAYS = { STANDARD: [3, 7], EXPRESS: [1, 3] } as const;
const addBusinessDays = (from: Date, n: number) => { const d = new Date(from); let left = n; while (left > 0) { d.setDate(d.getDate() + 1); if (d.getDay() % 6 !== 0) left--; } return d; };

function orderNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rnd = Array.from(crypto.randomBytes(5), (b) => alphabet[b % alphabet.length]).join('');
  return `PZ-${ymd}-${rnd}`;
}

const checkoutSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(120),
  phone: z.string().trim().regex(/^[0-9+()\-\s]{7,20}$/, 'Enter a valid phone number'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(190),
  address: z.string().trim().min(5, 'Enter your complete address').max(300),
  barangay: z.string().trim().min(1, 'Enter your barangay').max(100),
  city: z.string().trim().min(1, 'Enter your city or municipality').max(100),
  province: z.string().trim().min(1, 'Enter your province').max(100),
  postalCode: z.string().trim().regex(/^[0-9]{4}$/, 'Enter a 4-digit postal code'),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  shippingMethod: z.enum(SHIPPING_METHODS),
  paymentMethod: z.enum(PAYMENT_METHODS),
});

orders.post('/checkout', h(async (req, res) => {
  const p = checkoutSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: p.error.issues[0].message, issues: p.error.flatten().fieldErrors });
  const f = p.data;

  const pm = paymentMethods().find((m) => m.code === f.paymentMethod);
  if (!pm?.available) return res.status(400).json({ message: `${pm?.label ?? 'That payment method'} is not available yet. Please choose Cash on Delivery.` });

  // Re-price everything from the database. Nothing the browser says about prices is used.
  const cart = await resolveCart(req, res);
  const priced = await priceCart(cart.id, { shipping: f.shippingMethod, couponCode: cart.couponCode });
  if (priced.lines.length === 0) return res.status(400).json({ message: 'Your cart is empty.' });
  if (priced.hasIssues || priced.itemCount === 0) return res.status(409).json({ message: 'Some items in your cart are no longer available in the quantity you chose. Please review your cart and try again.', code: 'CART_CHANGED' });
  if (priced.couponError) return res.status(409).json({ message: priced.couponError, code: 'COUPON_INVALID' });

  const items = await prisma.cartItem.findMany({ where: { cartId: cart.id } });
  const userId = req.user!.id;

  try {
    const order = await prisma.$transaction(async (tx) => {
      // 1) reserve stock atomically: the UPDATE only succeeds while enough units remain, so overselling is impossible
      for (const l of priced.lines) {
        const inv = await tx.inventory.updateMany({ where: { productId: l.productId, quantity: { gte: l.quantity } }, data: { quantity: { decrement: l.quantity } } });
        if (inv.count === 0) throw new CheckoutError(`Sorry, "${l.name}" just sold out or has fewer units than you ordered.`);
        if (l.variantId) {
          const v = await tx.productVariant.updateMany({ where: { id: l.variantId, stock: { gte: l.quantity } }, data: { stock: { decrement: l.quantity } } });
          if (v.count === 0) throw new CheckoutError(`Sorry, that option of "${l.name}" just sold out.`);
        }
        await tx.product.update({ where: { id: l.productId }, data: { soldCount: { increment: l.quantity } } });
      }

      // 2) coupon: re-check and consume one use (optimistic lock on usedCount)
      let couponId: number | null = null;
      if (priced.coupon) {
        const coupon = await findCoupon(priced.coupon.code);
        const chk = checkCoupon(coupon, toCents(priced.subtotal));
        if (!chk.ok || !coupon) throw new CheckoutError(chk.message ?? 'That discount code is no longer valid.');
        const used = await tx.coupon.updateMany({ where: { id: coupon.id, usedCount: coupon.usedCount }, data: { usedCount: { increment: 1 } } });
        if (used.count === 0) throw new CheckoutError('That discount code was just used up. Please remove it and try again.');
        couponId = coupon.id;
      }

      // 3) the order, its line items (price snapshot) and a pending payment
      const created = await tx.order.create({
        data: {
          orderNumber: orderNumber(), userId, email: f.email, status: 'PENDING', paymentStatus: 'UNPAID',
          paymentMethod: f.paymentMethod, shippingMethod: f.shippingMethod,
          subtotal: priced.subtotal, shippingFee: priced.shippingFee, discountTotal: priced.discount, total: priced.total, couponCode: priced.coupon?.code ?? null,
          shipName: f.fullName, shipPhone: f.phone, shipAddress: f.address, shipBarangay: f.barangay, shipCity: f.city, shipProvince: f.province, shipPostal: f.postalCode,
          notes: f.notes || null,
          items: { create: priced.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, name: l.variantName ? `${l.name} (${l.variantName})` : l.name, imageUrl: l.image, unitPrice: l.unitPrice, quantity: l.quantity, lineTotal: l.lineTotal })) },
          // COD is collected on delivery; online methods will only ever be marked PAID from a verified provider callback
          payments: { create: [{ provider: f.paymentMethod, amount: priced.total, status: 'PENDING' }] },
        },
      });
      if (couponId) await tx.couponRedemption.create({ data: { couponId, userId, orderId: created.id } });

      // 4) empty the cart
      await tx.cartItem.deleteMany({ where: { cartId: cart.id, id: { in: items.map((i) => i.id) } } });
      await tx.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
      return created;
    }, { maxWait: 10_000, timeout: 20_000 });

    if (req.user!.notifyOrders) {
      void sendMail({ to: f.email, ...orderConfirmationEmail({
        orderNumber: order.orderNumber, name: f.fullName, items: priced.lines.map((l) => ({ name: l.variantName ? `${l.name} (${l.variantName})` : l.name, quantity: l.quantity, lineTotal: l.lineTotal })),
        subtotal: priced.subtotal, discount: priced.discount, shipping: priced.shippingFee, total: priced.total, paymentMethod: f.paymentMethod,
        address: `${f.address}, ${f.barangay}, ${f.city}, ${f.province} ${f.postalCode}`,
      }) });
    }
    res.status(201).json({ orderNumber: order.orderNumber });
  } catch (e) {
    if (e instanceof CheckoutError) return res.status(e.status).json({ message: e.message, code: 'CHECKOUT_CONFLICT' });
    throw e;
  }
}));

// ───────────── reading orders (always scoped to the logged-in customer) ─────────────
const orderInclude = { items: true, shipments: { orderBy: { createdAt: 'desc' as const } } } satisfies Prisma.OrderInclude;
type OrderFull = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

function toOrderDTO(o: OrderFull) {
  const [from, to] = ETA_DAYS[o.shippingMethod as keyof typeof ETA_DAYS] ?? ETA_DAYS.STANDARD;
  const open = !['DELIVERED', 'CANCELLED'].includes(o.status);
  return {
    orderNumber: o.orderNumber, status: o.status, paymentStatus: o.paymentStatus, paymentMethod: o.paymentMethod, shippingMethod: o.shippingMethod,
    subtotal: Number(o.subtotal), shippingFee: Number(o.shippingFee), discountTotal: Number(o.discountTotal), total: Number(o.total), couponCode: o.couponCode,
    ship: { name: o.shipName, phone: o.shipPhone, address: o.shipAddress, barangay: o.shipBarangay, city: o.shipCity, province: o.shipProvince, postalCode: o.shipPostal },
    email: o.email, notes: o.notes, isDemo: o.isDemo, createdAt: o.createdAt,
    estimatedDelivery: open ? { from: addBusinessDays(o.createdAt, from), to: addBusinessDays(o.createdAt, to) } : null,
    items: o.items.map((i) => ({ id: i.id, productId: i.productId, name: i.name, imageUrl: i.imageUrl, unitPrice: Number(i.unitPrice), quantity: i.quantity, lineTotal: Number(i.lineTotal) })),
    shipments: o.shipments.map((s) => ({ carrier: s.carrier, trackingNumber: s.trackingNumber, status: s.status, shippedAt: s.shippedAt, deliveredAt: s.deliveredAt })),
    canCancel: ['PENDING', 'CONFIRMED'].includes(o.status) && o.paymentStatus === 'UNPAID',
  };
}

orders.get('/orders', h(async (req, res) => {
  const rows = await prisma.order.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, include: orderInclude });
  res.json(rows.map(toOrderDTO));
}));

orders.get('/orders/:orderNumber', h(async (req, res) => {
  const o = await prisma.order.findFirst({ where: { orderNumber: req.params.orderNumber, userId: req.user!.id }, include: orderInclude });
  if (!o) return res.status(404).json({ message: 'Order not found.' }); // same answer whether it exists or belongs to someone else
  res.json(toOrderDTO(o));
}));

orders.post('/orders/:orderNumber/cancel', h(async (req, res) => {
  const o = await prisma.order.findFirst({ where: { orderNumber: req.params.orderNumber, userId: req.user!.id } });
  if (!o) return res.status(404).json({ message: 'Order not found.' });
  if (!['PENDING', 'CONFIRMED'].includes(o.status) || o.paymentStatus !== 'UNPAID') {
    return res.status(409).json({ message: 'This order can no longer be cancelled online. Please contact support.' });
  }
  try { await cancelOrder(o.id, ['PENDING', 'CONFIRMED']); }
  catch (e) { if (e instanceof ConflictError) return res.status(409).json({ message: e.message }); throw e; }
  const fresh = await prisma.order.findUniqueOrThrow({ where: { id: o.id }, include: orderInclude });
  res.json(toOrderDTO(fresh));
}));
