import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/db.js';
import { audit } from '../../lib/audit.js';
import { ORDER_STATUSES, PAYMENT_STATUSES } from '../../lib/constants.js';
import { ConflictError, ORDER_FLOW, cancelOrder } from '../../lib/orderOps.js';
import { bad, dateRange, h, pageInfo, paging } from './util.js';

export const adminOrders = Router();

const detailInclude = { items: true, payments: { orderBy: { createdAt: 'desc' as const } }, shipments: { orderBy: { createdAt: 'desc' as const } }, user: { select: { id: true, fullName: true, email: true } } };

adminOrders.get('/orders', h(async (req, res) => {
  const { page, size, skip } = paging(req);
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const status = ORDER_STATUSES.find((s) => s === req.query.status);
  const payment = PAYMENT_STATUSES.find((s) => s === req.query.paymentStatus);
  const hasRange = typeof req.query.from === 'string' || typeof req.query.to === 'string';
  const range = hasRange ? dateRange(req, 3650) : null;
  const where = {
    ...(status ? { status } : {}), ...(payment ? { paymentStatus: payment } : {}),
    ...(q ? { OR: [{ orderNumber: { contains: q } }, { email: { contains: q } }, { shipName: { contains: q } }] } : {}),
    ...(range ? { createdAt: { gte: range.from, lte: range.to } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: size, include: { items: { select: { quantity: true } }, user: { select: { fullName: true } } } }),
  ]);
  res.json({
    items: rows.map((o) => ({ orderNumber: o.orderNumber, customer: o.user?.fullName ?? o.shipName, email: o.email, status: o.status, paymentStatus: o.paymentStatus, paymentMethod: o.paymentMethod, total: Number(o.total), itemCount: o.items.reduce((s, i) => s + i.quantity, 0), createdAt: o.createdAt, isDemo: o.isDemo })),
    ...pageInfo(total, page, size),
  });
}));

async function detail(orderNumber: string) {
  const o = await prisma.order.findUnique({ where: { orderNumber }, include: detailInclude });
  if (!o) return null;
  return {
    orderNumber: o.orderNumber, status: o.status, paymentStatus: o.paymentStatus, paymentMethod: o.paymentMethod, shippingMethod: o.shippingMethod,
    subtotal: Number(o.subtotal), shippingFee: Number(o.shippingFee), discountTotal: Number(o.discountTotal), total: Number(o.total), couponCode: o.couponCode,
    customer: o.user ? { id: o.user.id, name: o.user.fullName, email: o.user.email } : null, email: o.email, notes: o.notes, isDemo: o.isDemo, createdAt: o.createdAt,
    ship: { name: o.shipName, phone: o.shipPhone, address: o.shipAddress, barangay: o.shipBarangay, city: o.shipCity, province: o.shipProvince, postalCode: o.shipPostal },
    items: o.items.map((i) => ({ id: i.id, name: i.name, imageUrl: i.imageUrl, unitPrice: Number(i.unitPrice), quantity: i.quantity, lineTotal: Number(i.lineTotal) })),
    payments: o.payments.map((p) => ({ id: p.id, provider: p.provider, amount: Number(p.amount), status: p.status, paidAt: p.paidAt, providerRef: p.providerRef })),
    shipments: o.shipments.map((s) => ({ id: s.id, carrier: s.carrier, trackingNumber: s.trackingNumber, status: s.status, shippedAt: s.shippedAt, deliveredAt: s.deliveredAt })),
    allowedNext: ORDER_FLOW[o.status] ?? [],
    canMarkPaid: o.paymentMethod === 'COD' && o.paymentStatus === 'UNPAID' && o.status !== 'CANCELLED',
    canRefund: o.paymentStatus === 'PAID',
  };
}

adminOrders.get('/orders/:orderNumber', h(async (req, res) => {
  const d = await detail(req.params.orderNumber);
  if (!d) return res.status(404).json({ message: 'Order not found.' });
  res.json(d);
}));

adminOrders.patch('/orders/:orderNumber/status', h(async (req, res) => {
  const p = z.object({ status: z.enum(ORDER_STATUSES) }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const o = await prisma.order.findUnique({ where: { orderNumber: req.params.orderNumber } });
  if (!o) return res.status(404).json({ message: 'Order not found.' });
  const next = p.data.status;
  if (!(ORDER_FLOW[o.status] ?? []).includes(next)) return res.status(409).json({ message: `An order that is ${o.status.toLowerCase()} cannot be changed to ${next.toLowerCase()}.` });
  try {
    if (next === 'CANCELLED') await cancelOrder(o.id, ['PENDING', 'CONFIRMED', 'PROCESSING']);
    else {
      const changed = await prisma.order.updateMany({ where: { id: o.id, status: o.status }, data: { status: next } }); // conditional: safe against concurrent edits
      if (changed.count === 0) throw new ConflictError('This order was already updated. Refresh and try again.');
      if (next === 'DELIVERED') await prisma.shipment.updateMany({ where: { orderId: o.id, status: { not: 'DELIVERED' } }, data: { status: 'DELIVERED', deliveredAt: new Date() } });
    }
  } catch (e) { if (e instanceof ConflictError) return res.status(409).json({ message: e.message }); throw e; }
  await audit(req, 'order.status', 'Order', o.orderNumber, { from: o.status, to: next });
  res.json(await detail(o.orderNumber));
}));

// Manual payment records. Online payments (GCash/Maya/card) can NEVER be marked paid here: that needs a verified provider callback.
adminOrders.post('/orders/:orderNumber/payment', h(async (req, res) => {
  const p = z.object({ action: z.enum(['MARK_PAID', 'REFUND']) }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const o = await prisma.order.findUnique({ where: { orderNumber: req.params.orderNumber } });
  if (!o) return res.status(404).json({ message: 'Order not found.' });

  if (p.data.action === 'MARK_PAID') {
    if (o.paymentMethod !== 'COD') return res.status(400).json({ message: 'Online payments can only be confirmed by the payment provider.' });
    if (o.status === 'CANCELLED') return res.status(409).json({ message: 'This order is cancelled.' });
    const changed = await prisma.order.updateMany({ where: { id: o.id, paymentStatus: 'UNPAID' }, data: { paymentStatus: 'PAID' } });
    if (changed.count === 0) return res.status(409).json({ message: 'This order is not awaiting payment.' });
    await prisma.payment.updateMany({ where: { orderId: o.id, status: 'PENDING' }, data: { status: 'PAID', paidAt: new Date() } });
    await audit(req, 'payment.mark_paid', 'Order', o.orderNumber, { amount: Number(o.total), method: 'COD' });
  } else {
    const changed = await prisma.order.updateMany({ where: { id: o.id, paymentStatus: 'PAID' }, data: { paymentStatus: 'REFUNDED' } });
    if (changed.count === 0) return res.status(409).json({ message: 'Only paid orders can be refunded.' });
    await prisma.payment.updateMany({ where: { orderId: o.id, status: 'PAID' }, data: { status: 'REFUNDED' } });
    await audit(req, 'payment.refund', 'Order', o.orderNumber, { amount: Number(o.total) });
  }
  res.json(await detail(o.orderNumber));
}));

adminOrders.post('/orders/:orderNumber/shipment', h(async (req, res) => {
  const p = z.object({
    carrier: z.string().trim().min(2, 'Enter the courier name').max(60),
    trackingNumber: z.string().trim().max(80).nullish().transform((v) => v || null),
    status: z.enum(['PREPARING', 'IN_TRANSIT', 'DELIVERED']),
  }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const o = await prisma.order.findUnique({ where: { orderNumber: req.params.orderNumber } });
  if (!o) return res.status(404).json({ message: 'Order not found.' });
  if (o.status === 'CANCELLED') return res.status(409).json({ message: 'This order is cancelled.' });
  const existing = await prisma.shipment.findFirst({ where: { orderId: o.id }, orderBy: { createdAt: 'desc' } });
  const now = new Date();
  const data = {
    carrier: p.data.carrier, trackingNumber: p.data.trackingNumber, status: p.data.status,
    shippedAt: p.data.status === 'PREPARING' ? null : existing?.shippedAt ?? now,
    deliveredAt: p.data.status === 'DELIVERED' ? existing?.deliveredAt ?? now : null,
  };
  if (existing) await prisma.shipment.update({ where: { id: existing.id }, data });
  else await prisma.shipment.create({ data: { ...data, orderId: o.id } });
  await audit(req, 'shipment.save', 'Order', o.orderNumber, { carrier: p.data.carrier, tracking: p.data.trackingNumber, status: p.data.status });
  res.json(await detail(o.orderNumber));
}));

// ───────────── payments ledger ─────────────
adminOrders.get('/payments', h(async (req, res) => {
  const { page, size, skip } = paging(req, 20);
  const status = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'].find((s) => s === req.query.status);
  const provider = ['COD', 'GCASH', 'MAYA', 'CARD'].find((s) => s === req.query.provider);
  const where = { ...(status ? { status } : {}), ...(provider ? { provider } : {}) };
  const [total, rows, sums] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: size, include: { order: { select: { orderNumber: true, email: true, shipName: true, isDemo: true } } } }),
    prisma.payment.groupBy({ by: ['status'], _sum: { amount: true } }),
  ]);
  const sum = (s: string) => Number(sums.find((x) => x.status === s)?._sum.amount ?? 0);
  res.json({
    items: rows.map((p) => ({ id: p.id, orderNumber: p.order.orderNumber, customer: p.order.shipName, email: p.order.email, provider: p.provider, amount: Number(p.amount), status: p.status, paidAt: p.paidAt, createdAt: p.createdAt, providerRef: p.providerRef, isDemo: p.order.isDemo })),
    totals: { paid: sum('PAID'), pending: sum('PENDING'), refunded: sum('REFUNDED') },
    ...pageInfo(total, page, size),
  });
}));
