import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/db.js';
import { audit } from '../../lib/audit.js';
import { slugify } from '../../lib/constants.js';
import { bad, h, idParam, pageInfo, paging } from './util.js';

export const adminCatalog = Router();

const localImage = z.string().max(300).regex(/^\/(uploads|img)\/[A-Za-z0-9._-]+$/, 'Invalid image path');
const dateOrNull = z.string().trim().nullish().refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Invalid date').transform((v) => (v ? new Date(v) : null));

const productBody = z.object({
  name: z.string().trim().min(2, 'Enter a product name').max(160),
  brand: z.string().trim().min(1, 'Enter a brand').max(80),
  description: z.string().trim().min(10, 'Write a short description (10+ characters)').max(4000),
  price: z.number({ invalid_type_error: 'Enter a price' }).positive('Price must be more than 0').max(1_000_000),
  salePrice: z.number().positive('Sale price must be more than 0').max(1_000_000).nullish().transform((v) => v ?? null),
  saleEndsAt: dateOrNull,
  categoryId: z.number().int().positive('Choose a category'),
  petTypeId: z.number().int().positive('Choose a pet type'),
  stock: z.number({ invalid_type_error: 'Enter the stock quantity' }).int().min(0, 'Stock cannot be negative').max(1_000_000),
  lowStockThreshold: z.number().int().min(0).max(100000).default(5),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  images: z.array(localImage).max(8).default([]),
});
const checkSale = (b: { price?: number; salePrice?: number | null }) => b.salePrice == null || b.price == null || b.salePrice < b.price;

async function validRefs(categoryId: number, petTypeId: number) {
  const [c, p] = await Promise.all([prisma.category.findFirst({ where: { id: categoryId, kind: 'PRODUCT' } }), prisma.category.findFirst({ where: { id: petTypeId, kind: 'PET' } })]);
  return c && p ? null : !c ? 'Choose a valid product category.' : 'Choose a valid pet type.';
}

async function uniqueSlug(name: string, ignoreId?: number) {
  const base = slugify(name) || 'product';
  for (let i = 0; ; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const hit = await prisma.product.findUnique({ where: { slug } });
    if (!hit || hit.id === ignoreId) return slug;
  }
}

const include = { images: { orderBy: { sortOrder: 'asc' as const } }, inventory: true, category: true, petType: true };
const dto = (p: Awaited<ReturnType<typeof prisma.product.findFirstOrThrow<{ include: typeof include }>>>) => ({
  id: p.id, name: p.name, slug: p.slug, brand: p.brand, description: p.description, price: Number(p.price), salePrice: p.salePrice != null ? Number(p.salePrice) : null,
  saleEndsAt: p.saleEndsAt, categoryId: p.categoryId, petTypeId: p.petTypeId, category: p.category.name, petType: p.petType.name,
  isFeatured: p.isFeatured, isActive: p.isActive, archivedAt: p.archivedAt, isDemo: p.isDemo, soldCount: p.soldCount,
  stock: p.inventory?.quantity ?? 0, lowStockThreshold: p.inventory?.lowStockThreshold ?? 5, images: p.images.map((i) => i.url), createdAt: p.createdAt,
});

// ───────────── products ─────────────
adminCatalog.get('/products', h(async (req, res) => {
  const { page, size, skip } = paging(req);
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const status = req.query.status;
  const where = {
    ...(q ? { OR: [{ name: { contains: q } }, { brand: { contains: q } }] } : {}),
    ...(status === 'archived' ? { archivedAt: { not: null } } : status === 'all' ? {} : { archivedAt: null }),
    ...(Number(req.query.categoryId) ? { categoryId: Number(req.query.categoryId) } : {}),
  };
  const [total, rows] = await Promise.all([prisma.product.count({ where }), prisma.product.findMany({ where, include, orderBy: { id: 'desc' }, skip, take: size })]);
  res.json({ items: rows.map(dto), ...pageInfo(total, page, size) });
}));

adminCatalog.get('/products/:id', h(async (req, res) => {
  const p = await prisma.product.findFirst({ where: { id: idParam(req) }, include });
  if (!p) return res.status(404).json({ message: 'Product not found.' });
  res.json(dto(p));
}));

adminCatalog.post('/products', h(async (req, res) => {
  const p = productBody.safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  if (!checkSale(p.data)) return res.status(400).json({ message: 'Sale price must be lower than the regular price.', issues: { salePrice: ['Must be lower than the price'] } });
  const refErr = await validRefs(p.data.categoryId, p.data.petTypeId);
  if (refErr) return res.status(400).json({ message: refErr });
  const d = p.data;
  const created = await prisma.product.create({
    data: {
      name: d.name, slug: await uniqueSlug(d.name), brand: d.brand, description: d.description, price: d.price, salePrice: d.salePrice, saleEndsAt: d.saleEndsAt,
      categoryId: d.categoryId, petTypeId: d.petTypeId, isFeatured: d.isFeatured, isActive: d.isActive,
      inventory: { create: { quantity: d.stock, lowStockThreshold: d.lowStockThreshold } },
      images: { create: d.images.map((url, i) => ({ url, alt: d.name, sortOrder: i })) },
    },
    include,
  });
  await audit(req, 'product.create', 'Product', created.id, { name: created.name, price: d.price, stock: d.stock });
  res.status(201).json(dto(created));
}));

adminCatalog.patch('/products/:id', h(async (req, res) => {
  const id = idParam(req);
  const existing = await prisma.product.findUnique({ where: { id }, include: { inventory: true } });
  if (!existing) return res.status(404).json({ message: 'Product not found.' });
  const p = productBody.safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  if (!checkSale(p.data)) return res.status(400).json({ message: 'Sale price must be lower than the regular price.', issues: { salePrice: ['Must be lower than the price'] } });
  const refErr = await validRefs(p.data.categoryId, p.data.petTypeId);
  if (refErr) return res.status(400).json({ message: refErr });
  const d = p.data;
  const updated = await prisma.$transaction(async (tx) => {
    await tx.productImage.deleteMany({ where: { productId: id } });
    if (d.images.length) await tx.productImage.createMany({ data: d.images.map((url, i) => ({ productId: id, url, alt: d.name, sortOrder: i })) });
    await tx.inventory.upsert({ where: { productId: id }, update: { quantity: d.stock, lowStockThreshold: d.lowStockThreshold }, create: { productId: id, quantity: d.stock, lowStockThreshold: d.lowStockThreshold } });
    return tx.product.update({
      where: { id },
      data: { name: d.name, slug: existing.name === d.name ? existing.slug : await uniqueSlug(d.name, id), brand: d.brand, description: d.description, price: d.price, salePrice: d.salePrice, saleEndsAt: d.saleEndsAt, categoryId: d.categoryId, petTypeId: d.petTypeId, isFeatured: d.isFeatured, isActive: d.isActive },
      include,
    });
  });
  await audit(req, 'product.update', 'Product', id, { price: d.price, salePrice: d.salePrice, stock: d.stock, wasStock: existing.inventory?.quantity });
  res.json(dto(updated));
}));

// "Delete" archives: the product disappears from the shop but past orders keep their history.
adminCatalog.delete('/products/:id', h(async (req, res) => {
  const id = idParam(req);
  const r = await prisma.product.updateMany({ where: { id, archivedAt: null }, data: { archivedAt: new Date(), isActive: false, isFeatured: false } });
  if (r.count === 0) return res.status(404).json({ message: 'Product not found or already archived.' });
  await audit(req, 'product.archive', 'Product', id);
  res.json({ ok: true });
}));
adminCatalog.post('/products/:id/restore', h(async (req, res) => {
  const id = idParam(req);
  const r = await prisma.product.updateMany({ where: { id, archivedAt: { not: null } }, data: { archivedAt: null, isActive: true } });
  if (r.count === 0) return res.status(404).json({ message: 'Product not found or not archived.' });
  await audit(req, 'product.restore', 'Product', id);
  res.json({ ok: true });
}));

// ───────────── categories (product categories + pet types) ─────────────
const categoryBody = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(80),
  kind: z.enum(['PRODUCT', 'PET']),
  imageUrl: localImage.nullish().transform((v) => v ?? null),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

adminCatalog.get('/categories', h(async (_req, res) => {
  const rows = await prisma.category.findMany({ orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }], include: { _count: { select: { products: true, petProducts: true } } } });
  res.json(rows.map((c) => ({ id: c.id, name: c.name, slug: c.slug, kind: c.kind, imageUrl: c.imageUrl, sortOrder: c.sortOrder, productCount: c._count.products + c._count.petProducts })));
}));

adminCatalog.post('/categories', h(async (req, res) => {
  const p = categoryBody.safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const slug = slugify(p.data.name);
  if (await prisma.category.findUnique({ where: { slug } })) return res.status(409).json({ message: 'A category with that name already exists.' });
  const c = await prisma.category.create({ data: { ...p.data, slug } });
  await audit(req, 'category.create', 'Category', c.id, { name: c.name, kind: c.kind });
  res.status(201).json(c);
}));

adminCatalog.patch('/categories/:id', h(async (req, res) => {
  const id = idParam(req);
  const p = categoryBody.omit({ kind: true }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const slug = slugify(p.data.name);
  const clash = await prisma.category.findUnique({ where: { slug } });
  if (clash && clash.id !== id) return res.status(409).json({ message: 'A category with that name already exists.' });
  const r = await prisma.category.updateMany({ where: { id }, data: { ...p.data, slug } });
  if (r.count === 0) return res.status(404).json({ message: 'Category not found.' });
  await audit(req, 'category.update', 'Category', id, { name: p.data.name });
  res.json({ ok: true });
}));

adminCatalog.delete('/categories/:id', h(async (req, res) => {
  const id = idParam(req);
  const used = await prisma.product.count({ where: { OR: [{ categoryId: id }, { petTypeId: id }] } });
  if (used > 0) return res.status(409).json({ message: `This category is used by ${used} product(s). Move or archive them first.` });
  const r = await prisma.category.deleteMany({ where: { id } });
  if (r.count === 0) return res.status(404).json({ message: 'Category not found.' });
  await audit(req, 'category.delete', 'Category', id);
  res.json({ ok: true });
}));

// ───────────── inventory ─────────────
adminCatalog.get('/inventory', h(async (req, res) => {
  const { page, size, skip } = paging(req, 20);
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const rows = await prisma.inventory.findMany({
    where: { product: { archivedAt: null, ...(q ? { OR: [{ name: { contains: q } }, { brand: { contains: q } }] } : {}) } },
    include: { product: { select: { id: true, name: true, brand: true, isActive: true, images: { take: 1, orderBy: { sortOrder: 'asc' } }, variants: { select: { name: true, stock: true } } } } },
    orderBy: { quantity: 'asc' },
  });
  const all = rows.map((i) => ({
    productId: i.productId, name: i.product.name, brand: i.product.brand, image: i.product.images[0]?.url ?? null, isActive: i.product.isActive,
    quantity: i.quantity, lowStockThreshold: i.lowStockThreshold, low: i.quantity <= i.lowStockThreshold, out: i.quantity === 0,
    variants: i.product.variants,
  }));
  const filtered = req.query.low === 'true' ? all.filter((r) => r.low) : all;
  res.json({ items: filtered.slice(skip, skip + size), ...pageInfo(filtered.length, page, size), lowCount: all.filter((r) => r.low).length });
}));

adminCatalog.patch('/inventory/:productId', h(async (req, res) => {
  const productId = idParam(req, 'productId');
  const p = z.object({ quantity: z.number().int().min(0).max(1_000_000).optional(), delta: z.number().int().min(-100000).max(100000).optional(), lowStockThreshold: z.number().int().min(0).max(100000).optional() })
    .refine((v) => v.quantity !== undefined || v.delta !== undefined || v.lowStockThreshold !== undefined, 'Nothing to update').safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const inv = await prisma.inventory.findUnique({ where: { productId } });
  if (!inv) return res.status(404).json({ message: 'Product not found.' });
  const next = p.data.quantity ?? (p.data.delta !== undefined ? inv.quantity + p.data.delta : inv.quantity);
  if (next < 0) return res.status(400).json({ message: 'Stock cannot go below zero.' });
  const updated = await prisma.inventory.update({ where: { productId }, data: { quantity: next, ...(p.data.lowStockThreshold !== undefined ? { lowStockThreshold: p.data.lowStockThreshold } : {}) } });
  await audit(req, 'inventory.update', 'Product', productId, { from: inv.quantity, to: next });
  res.json({ productId, quantity: updated.quantity, lowStockThreshold: updated.lowStockThreshold });
}));
