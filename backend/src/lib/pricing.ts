// Server-side pricing. The client only ever sends product ids and quantities; every price, discount,
// shipping fee and total is computed here from the database. All money math is done in integer centavos.
import type { Coupon } from '@prisma/client';
import { prisma } from './db.js';
import { saleActive } from './serialize.js';

export const SHIPPING_METHODS = ['STANDARD', 'EXPRESS'] as const;
export type ShippingMethod = (typeof SHIPPING_METHODS)[number];

export const toCents = (n: number | string | { toString(): string }) => Math.round(Number(n.toString()) * 100);
export const fromCents = (c: number) => Math.round(c) / 100;

export async function loadSettings() {
  const rows = await prisma.storeSettings.findMany();
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const num = (k: string, d: number) => (m[k] !== undefined && m[k] !== '' && !Number.isNaN(Number(m[k])) ? Number(m[k]) : d);
  return { standardFee: num('shipping_standard_fee', 99), expressFee: num('shipping_express_fee', 199), freeOver: num('free_shipping_over', 2000) };
}

/** Payment methods. Only COD is live; online methods need a configured, verified payment provider (none yet). */
export function paymentMethods() {
  const enabled = new Set((process.env.PAYMENT_METHODS_ENABLED || 'COD').split(',').map((s) => s.trim().toUpperCase()));
  const note = 'Available once an online payment provider is connected.';
  return [
    { code: 'COD', label: 'Cash on Delivery', available: enabled.has('COD'), note: 'Pay with cash when your order arrives.' },
    { code: 'GCASH', label: 'GCash', available: enabled.has('GCASH'), note },
    { code: 'MAYA', label: 'Maya', available: enabled.has('MAYA'), note },
    { code: 'CARD', label: 'Credit / Debit Card', available: enabled.has('CARD'), note },
  ];
}

export interface CouponCheck { ok: boolean; message?: string; coupon?: Coupon; discountCents: number }

export function checkCoupon(coupon: Coupon | null, subtotalCents: number): CouponCheck {
  const fail = (message: string): CouponCheck => ({ ok: false, message, discountCents: 0 });
  if (!coupon || !coupon.isActive) return fail('That discount code is not valid.');
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return fail('That discount code is not active yet.');
  if (coupon.expiresAt && coupon.expiresAt < now) return fail('That discount code has expired.');
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return fail('That discount code has reached its usage limit.');
  const min = toCents(coupon.minSubtotal);
  if (subtotalCents < min) return fail(`Spend at least ₱${fromCents(min).toLocaleString('en-PH')} to use this code.`);
  const raw = coupon.type === 'PERCENT' ? Math.round((subtotalCents * Number(coupon.value)) / 100) : toCents(coupon.value);
  return { ok: true, coupon, discountCents: Math.min(raw, subtotalCents) };
}

export const findCoupon = (code: string) => prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });

export interface PricedLine {
  id: number; productId: number; variantId: number | null; variantName: string | null;
  name: string; slug: string; image: string | null;
  unitPrice: number; quantity: number; lineTotal: number;
  stock: number; available: boolean; issue: string | null;
}

export async function priceCart(cartId: number, opts: { shipping?: ShippingMethod; couponCode?: string | null } = {}) {
  const shipping: ShippingMethod = opts.shipping ?? 'STANDARD';
  const items = await prisma.cartItem.findMany({
    where: { cartId }, orderBy: { id: 'asc' },
    include: { product: { include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 }, inventory: true } }, variant: true },
  });

  let subtotalC = 0, itemCount = 0;
  const lines: PricedLine[] = items.map((it) => {
    const p = it.product;
    const stock = it.variant ? it.variant.stock : p.inventory?.quantity ?? 0;
    const live = p.isActive && !p.archivedAt;
    const base = toCents(saleActive(p) ? p.salePrice! : p.price) + (it.variant ? toCents(it.variant.priceDelta) : 0);
    let issue: string | null = null;
    let qty = it.quantity;
    if (!live) { issue = 'This item is no longer available.'; qty = 0; }
    else if (stock <= 0) { issue = 'Out of stock.'; qty = 0; }
    else if (qty > stock) { issue = `Only ${stock} left in stock.`; qty = stock; }
    subtotalC += base * qty; itemCount += qty;
    return {
      id: it.id, productId: p.id, variantId: it.variantId, variantName: it.variant?.name ?? null, name: p.name, slug: p.slug,
      image: p.images[0]?.url ?? null, unitPrice: fromCents(base), quantity: qty, lineTotal: fromCents(base * qty),
      stock, available: !issue || qty > 0, issue,
    };
  });

  // coupon
  let coupon: { code: string; description: string } | null = null, couponError: string | null = null, discountC = 0;
  if (opts.couponCode) {
    const chk = checkCoupon(await findCoupon(opts.couponCode), subtotalC);
    if (chk.ok && chk.coupon) {
      discountC = chk.discountCents;
      coupon = { code: chk.coupon.code, description: chk.coupon.type === 'PERCENT' ? `${Number(chk.coupon.value)}% off` : `₱${Number(chk.coupon.value)} off` };
    } else couponError = chk.message ?? 'Invalid code';
  }

  // shipping
  const s = await loadSettings();
  const afterDiscountC = subtotalC - discountC;
  const feeFor = (m: ShippingMethod) => (itemCount === 0 ? 0 : m === 'EXPRESS' ? toCents(s.expressFee) : s.freeOver > 0 && afterDiscountC >= toCents(s.freeOver) ? 0 : toCents(s.standardFee));
  const shippingOptions = [
    { code: 'STANDARD' as const, label: 'Standard Delivery', eta: '3–7 business days', fee: fromCents(feeFor('STANDARD')), free: itemCount > 0 && feeFor('STANDARD') === 0 },
    { code: 'EXPRESS' as const, label: 'Express Delivery', eta: '1–3 business days', fee: fromCents(feeFor('EXPRESS')), free: false },
  ];
  const shippingFeeC = feeFor(shipping);

  return {
    lines, itemCount, subtotal: fromCents(subtotalC), discount: fromCents(discountC), coupon, couponError,
    shippingMethod: shipping, shippingFee: fromCents(shippingFeeC), total: fromCents(afterDiscountC + shippingFeeC),
    shippingOptions, freeShippingOver: s.freeOver,
    hasIssues: lines.some((l) => l.issue !== null),
    paymentMethods: paymentMethods(),
  };
}
export type PricedCart = Awaited<ReturnType<typeof priceCart>>;
