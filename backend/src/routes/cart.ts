import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { cookieSecure, randomToken } from '../lib/auth.js';
import { SHIPPING_METHODS, checkCoupon, findCoupon, priceCart, toCents, type ShippingMethod } from '../lib/pricing.js';

export const cart = Router();
const h = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: (e?: unknown) => void) => fn(req, res).catch(next);

const GUEST_COOKIE = 'pz_guest';
const guestCookieOpts = () => ({ httpOnly: true, sameSite: 'lax' as const, secure: cookieSecure(), path: '/', maxAge: 30 * 864e5 });

/** Stock available for a (product, variant) pair right now. */
async function stockFor(productId: number, variantId: number | null) {
  if (variantId) return (await prisma.productVariant.findFirst({ where: { id: variantId, productId } }))?.stock ?? 0;
  return (await prisma.inventory.findUnique({ where: { productId } }))?.quantity ?? 0;
}

/**
 * Finds (or creates) the caller's cart. Logged-in users get a cart tied to their account; a guest cart from
 * before login is merged into it (quantities capped by stock) and discarded. Guests are tracked by a random cookie.
 */
export async function resolveCart(req: Request, res: Response) {
  const guestToken = req.cookies?.[GUEST_COOKIE] as string | undefined;
  const guestCart = guestToken ? await prisma.cart.findFirst({ where: { guestToken, userId: null }, include: { items: true } }) : null;

  if (req.user) {
    let mine = await prisma.cart.findFirst({ where: { userId: req.user.id } });
    if (!mine) mine = await prisma.cart.create({ data: { userId: req.user.id } });
    if (guestCart) {
      for (const gi of guestCart.items) {
        const existing = await prisma.cartItem.findFirst({ where: { cartId: mine.id, productId: gi.productId, variantId: gi.variantId } });
        const stock = await stockFor(gi.productId, gi.variantId);
        const want = Math.min((existing?.quantity ?? 0) + gi.quantity, Math.max(stock, 1));
        if (existing) await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: want } });
        else await prisma.cartItem.create({ data: { cartId: mine.id, productId: gi.productId, variantId: gi.variantId, quantity: want } });
      }
      if (guestCart.couponCode && !mine.couponCode) mine = await prisma.cart.update({ where: { id: mine.id }, data: { couponCode: guestCart.couponCode } });
      await prisma.cart.delete({ where: { id: guestCart.id } });
    }
    if (guestToken) res.clearCookie(GUEST_COOKIE, { path: '/' });
    return mine;
  }

  if (guestCart) return guestCart;
  const token = randomToken();
  const created = await prisma.cart.create({ data: { guestToken: token } });
  res.cookie(GUEST_COOKIE, token, guestCookieOpts());
  return created;
}

const shippingParam = (req: Request): ShippingMethod => {
  const s = String(req.query.shipping ?? 'STANDARD').toUpperCase();
  return (SHIPPING_METHODS as readonly string[]).includes(s) ? (s as ShippingMethod) : 'STANDARD';
};
const respond = async (req: Request, res: Response, cartId: number, couponCode: string | null) =>
  res.json(await priceCart(cartId, { shipping: shippingParam(req), couponCode }));

cart.get('/', h(async (req, res) => {
  const c = await resolveCart(req, res);
  await respond(req, res, c.id, c.couponCode);
}));

const addSchema = z.object({ productId: z.number().int().positive(), variantId: z.number().int().positive().nullish(), quantity: z.number().int().min(1).max(99).default(1) });

cart.post('/items', h(async (req, res) => {
  const p = addSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Invalid request' });
  const { productId, quantity } = p.data;
  const variantId = p.data.variantId ?? null;

  const product = await prisma.product.findFirst({ where: { id: productId, isActive: true, archivedAt: null }, include: { variants: true } });
  if (!product) return res.status(404).json({ message: 'This product is no longer available.' });
  if (product.variants.length > 0 && !variantId) return res.status(400).json({ message: 'Please choose an option first.' });
  if (variantId && !product.variants.some((v) => v.id === variantId)) return res.status(400).json({ message: 'That option does not exist.' });

  const c = await resolveCart(req, res);
  const existing = await prisma.cartItem.findFirst({ where: { cartId: c.id, productId, variantId } });
  const stock = await stockFor(productId, variantId);
  const want = (existing?.quantity ?? 0) + quantity;
  if (stock <= 0) return res.status(409).json({ message: 'Sorry, this item is out of stock.' });
  if (want > stock) return res.status(409).json({ message: `Only ${stock} in stock${existing ? ` – you already have ${existing.quantity} in your cart` : ''}.` });

  if (existing) await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: want } });
  else await prisma.cartItem.create({ data: { cartId: c.id, productId, variantId, quantity: want } });
  await respond(req, res, c.id, c.couponCode);
}));

cart.patch('/items/:id', h(async (req, res) => {
  const p = z.object({ quantity: z.number().int().min(1).max(99) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Invalid quantity' });
  const c = await resolveCart(req, res);
  const item = await prisma.cartItem.findFirst({ where: { id: Number(req.params.id) || -1, cartId: c.id } }); // scoped to the caller's own cart
  if (!item) return res.status(404).json({ message: 'Item not found in your cart.' });
  const stock = await stockFor(item.productId, item.variantId);
  if (p.data.quantity > stock) return res.status(409).json({ message: `Only ${stock} in stock.` });
  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: p.data.quantity } });
  await respond(req, res, c.id, c.couponCode);
}));

cart.delete('/items/:id', h(async (req, res) => {
  const c = await resolveCart(req, res);
  await prisma.cartItem.deleteMany({ where: { id: Number(req.params.id) || -1, cartId: c.id } });
  await respond(req, res, c.id, c.couponCode);
}));

cart.post('/coupon', h(async (req, res) => {
  const p = z.object({ code: z.string().trim().min(1).max(40) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Enter a discount code.' });
  const c = await resolveCart(req, res);
  const priced = await priceCart(c.id);
  const chk = checkCoupon(await findCoupon(p.data.code), toCents(priced.subtotal));
  if (!chk.ok || !chk.coupon) return res.status(400).json({ message: chk.message });
  await prisma.cart.update({ where: { id: c.id }, data: { couponCode: chk.coupon.code } });
  await respond(req, res, c.id, chk.coupon.code);
}));

cart.delete('/coupon', h(async (req, res) => {
  const c = await resolveCart(req, res);
  await prisma.cart.update({ where: { id: c.id }, data: { couponCode: null } });
  await respond(req, res, c.id, null);
}));
