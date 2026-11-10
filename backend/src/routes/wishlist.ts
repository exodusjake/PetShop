import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { productInclude, toProductDTO } from '../lib/serialize.js';

export const wishlist = Router();
wishlist.use(requireAuth); // every wishlist route is scoped to the logged-in user
const h = (fn: (req: any, res: any) => Promise<any>) => (req: any, res: any, next: any) => fn(req, res).catch(next);

const list = async (userId: number) => {
  const rows = await prisma.wishlist.findMany({ where: { userId, product: { isActive: true, archivedAt: null } }, orderBy: { createdAt: 'desc' }, include: { product: { include: productInclude } } });
  return rows.map((r) => toProductDTO(r.product));
};

wishlist.get('/', h(async (req, res) => res.json(await list(req.user.id))));

wishlist.put('/:productId', h(async (req, res) => {
  const productId = Number(req.params.productId);
  if (!Number.isInteger(productId)) return res.status(400).json({ message: 'Invalid product' });
  if (!(await prisma.product.findFirst({ where: { id: productId, isActive: true } }))) return res.status(404).json({ message: 'Product not found' });
  await prisma.wishlist.upsert({ where: { userId_productId: { userId: req.user.id, productId } }, update: {}, create: { userId: req.user.id, productId } });
  res.json({ ok: true });
}));

wishlist.delete('/:productId', h(async (req, res) => {
  const productId = Number(req.params.productId);
  await prisma.wishlist.deleteMany({ where: { userId: req.user.id, productId: Number.isInteger(productId) ? productId : -1 } });
  res.json({ ok: true });
}));

// Called after login to fold the guest (browser) wishlist into the account.
wishlist.post('/merge', h(async (req, res) => {
  const p = z.object({ productIds: z.array(z.number().int()).max(200) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Invalid input' });
  const valid = await prisma.product.findMany({ where: { id: { in: p.data.productIds }, isActive: true }, select: { id: true } });
  const have = new Set((await prisma.wishlist.findMany({ where: { userId: req.user.id }, select: { productId: true } })).map((w) => w.productId));
  const fresh = valid.filter((v) => !have.has(v.id));
  if (fresh.length) await prisma.wishlist.createMany({ data: fresh.map((v) => ({ userId: req.user.id, productId: v.id })) });
  res.json((await list(req.user.id)).map((p) => p.id));
}));
