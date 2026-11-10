import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../lib/auth.js';
import { recalcProductRating } from '../lib/reviews.js';
import { productInclude, toProductDTO, saleActive } from '../lib/serialize.js';

export const catalog = Router();

const asyncH = (fn: (req: any, res: any) => Promise<any>) => (req: any, res: any, next: any) => fn(req, res).catch(next);

// ── categories (pet types + product categories)
catalog.get('/categories', asyncH(async (_req, res) => {
  const rows = await prisma.category.findMany({ orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }] });
  res.json({
    pets: rows.filter((c) => c.kind === 'PET'),
    categories: rows.filter((c) => c.kind === 'PRODUCT'),
  });
}));

// ── filter facets for the shop sidebar
catalog.get('/facets', asyncH(async (_req, res) => {
  const products = await prisma.product.findMany({ where: { isActive: true, archivedAt: null }, select: { brand: true, price: true, salePrice: true, saleEndsAt: true } });
  const brands = new Map<string, number>();
  let min = Infinity, max = 0;
  for (const p of products) {
    brands.set(p.brand, (brands.get(p.brand) ?? 0) + 1);
    const eff = saleActive(p) ? Number(p.salePrice) : Number(p.price);
    min = Math.min(min, eff); max = Math.max(max, eff);
  }
  res.json({
    brands: [...brands].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)),
    priceMin: products.length ? Math.floor(min) : 0,
    priceMax: Math.ceil(max),
  });
}));

// ── product listing: search / filter / sort / paginate (all driven by the database)
const listQuery = z.object({
  q: z.string().trim().max(80).optional(),
  pet: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(), // comma-separated
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  inStock: z.enum(['true', 'false']).optional(),
  onSale: z.enum(['true', 'false']).optional(),
  featured: z.enum(['true', 'false']).optional(),
  sort: z.enum(['popularity', 'newest', 'price-asc', 'price-desc', 'rating']).default('popularity'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
});

catalog.get('/products', asyncH(async (req, res) => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid query', issues: parsed.error.flatten().fieldErrors });
  const f = parsed.data;

  const rows = await prisma.product.findMany({
    where: {
      isActive: true,
      archivedAt: null,
      ...(f.q ? { OR: [{ name: { contains: f.q } }, { brand: { contains: f.q } }, { description: { contains: f.q } }] } : {}),
      ...(f.pet ? { petType: { slug: f.pet } } : {}),
      ...(f.category ? { category: { slug: f.category } } : {}),
      ...(f.brand ? { brand: { in: f.brand.split(',').filter(Boolean) } } : {}),
      ...(f.rating ? { ratingAvg: { gte: f.rating } } : {}),
      ...(f.featured === 'true' ? { isFeatured: true } : {}),
    },
    include: productInclude,
  });

  // effective-price filters and sorting happen here because the sale price depends on its expiry date
  let items = rows.map(toProductDTO);
  if (f.minPrice != null) items = items.filter((p) => p.effectivePrice >= f.minPrice!);
  if (f.maxPrice != null) items = items.filter((p) => p.effectivePrice <= f.maxPrice!);
  if (f.inStock === 'true') items = items.filter((p) => p.inStock);
  if (f.onSale === 'true') items = items.filter((p) => p.onSale);

  const sorters = {
    popularity: (a: any, b: any) => b.soldCount - a.soldCount,
    newest: (a: any, b: any) => +new Date(b.createdAt) - +new Date(a.createdAt),
    'price-asc': (a: any, b: any) => a.effectivePrice - b.effectivePrice,
    'price-desc': (a: any, b: any) => b.effectivePrice - a.effectivePrice,
    rating: (a: any, b: any) => b.ratingAvg - a.ratingAvg || b.reviewCount - a.reviewCount,
  } as const;
  items.sort(sorters[f.sort]);

  const total = items.length;
  const start = (f.page - 1) * f.pageSize;
  res.json({
    items: items.slice(start, start + f.pageSize),
    total,
    page: f.page,
    pageSize: f.pageSize,
    totalPages: Math.max(1, Math.ceil(total / f.pageSize)),
  });
}));

// ── product detail
catalog.get('/products/:slug', asyncH(async (req, res) => {
  const p = await prisma.product.findFirst({
    where: { slug: req.params.slug, isActive: true, archivedAt: null },
    include: {
      ...productInclude,
      variants: true,
      reviews: { where: { status: 'PUBLISHED' }, orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
  if (!p) return res.status(404).json({ message: 'Product not found' });

  const related = await prisma.product.findMany({
    where: { isActive: true, archivedAt: null, id: { not: p.id }, OR: [{ categoryId: p.categoryId }, { petTypeId: p.petTypeId }] },
    include: productInclude,
    take: 4,
    orderBy: { soldCount: 'desc' },
  });

  res.json({
    ...toProductDTO(p),
    variants: p.variants.map((v) => ({ id: v.id, name: v.name, sku: v.sku, priceDelta: Number(v.priceDelta), stock: v.stock })),
    reviews: p.reviews.map((r) => ({ id: r.id, author: r.authorName, rating: r.rating, title: r.title, body: r.body, isDemo: r.isDemo, createdAt: r.createdAt })),
    related: related.map(toProductDTO),
  });
}));

// ── adoption (public read)
catalog.get('/adoption', asyncH(async (req, res) => {
  const species = typeof req.query.species === 'string' ? req.query.species : undefined;
  const items = await prisma.adoptionListing.findMany({
    where: { ...(species ? { species } : {}) },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });
  res.json(items);
}));

catalog.get('/adoption/:id', asyncH(async (req, res) => {
  const id = Number(req.params.id);
  const pet = Number.isInteger(id) ? await prisma.adoptionListing.findUnique({ where: { id } }) : null;
  if (!pet) return res.status(404).json({ message: 'Pet not found' });
  res.json(pet);
}));

// ── blog (public read)
catalog.get('/blog', asyncH(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 12, 50);
  const posts = await prisma.blogPost.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: limit,
    include: { category: true },
  });
  res.json(posts.map((p) => ({
    id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt, coverUrl: p.coverUrl,
    category: p.category.name, readMinutes: p.readMinutes, publishedAt: p.publishedAt, isDemo: p.isDemo,
  })));
}));

// ── newsletter + contact (stored in the database)
catalog.post('/newsletter', asyncH(async (req, res) => {
  const body = z.object({ email: z.string().trim().toLowerCase().email().max(190) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Please enter a valid email address.' });
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email: body.data.email } });
  if (existing) return res.json({ message: 'You are already subscribed. Thank you!' });
  await prisma.newsletterSubscriber.create({ data: { email: body.data.email } });
  res.status(201).json({ message: 'Welcome to the Pawzora Family!' });
}));

const contactLimiter = rateLimit({ windowMs: 60 * 60_000, limit: Number(process.env.CONTACT_RATE_LIMIT || 8), standardHeaders: true, legacyHeaders: false, message: { message: 'Too many messages. Please try again later.' } });

catalog.post('/contact', contactLimiter, asyncH(async (req, res) => {
  // hidden "website" field: people leave it empty, spam bots fill it. Pretend success and store nothing.
  if (typeof req.body?.website === 'string' && req.body.website.trim() !== '') return res.status(201).json({ message: 'Thanks! Your message has been sent.' });
  const body = z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(190),
    subject: z.string().trim().min(2).max(160),
    message: z.string().trim().min(5).max(2000),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: 'Please complete all fields.', issues: body.error.flatten().fieldErrors });
  await prisma.contactMessage.create({ data: body.data });
  res.status(201).json({ message: 'Thanks! Your message has been sent.' });
}));

// ── public store settings (contact details etc. are configured by the admin, never hardcoded)
const PUBLIC_SETTINGS = ['store_name', 'tagline', 'contact_email', 'contact_phone', 'contact_address', 'business_hours',
  'social_facebook', 'social_instagram', 'social_tiktok', 'social_youtube', 'shipping_standard_fee', 'shipping_express_fee', 'free_shipping_over'];

catalog.get('/settings', asyncH(async (_req, res) => {
  const rows = await prisma.storeSettings.findMany({ where: { key: { in: PUBLIC_SETTINGS } } });
  const out: Record<string, string> = Object.fromEntries(PUBLIC_SETTINGS.map((k) => [k, '']));
  for (const r of rows) out[r.key] = r.value;
  res.json(out);
}));

// ── top reviews for the homepage testimonial carousel
catalog.get('/reviews/featured', asyncH(async (_req, res) => {
  const rows = await prisma.review.findMany({
    where: { status: 'PUBLISHED', rating: { gte: 4 } },
    orderBy: { createdAt: 'desc' },
    take: 6,
    include: { product: { select: { name: true, slug: true } } },
  });
  res.json(rows.map((r) => ({ id: r.id, author: r.authorName, rating: r.rating, body: r.body, isDemo: r.isDemo, product: r.product })));
}));

// ───────────── blog (published posts only) ─────────────
type PostRow = { id: number; title: string; slug: string; excerpt: string; coverUrl: string | null; readMinutes: number; publishedAt: Date | null; isDemo: boolean; category: { name: string; slug: string } };
const postCard = (p: PostRow) => ({
  id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt, coverUrl: p.coverUrl, category: p.category.name, categorySlug: p.category.slug,
  readMinutes: p.readMinutes, publishedAt: p.publishedAt, isDemo: p.isDemo,
});

catalog.get('/blog/categories', asyncH(async (_req, res) => {
  const cats = await prisma.blogCategory.findMany({ include: { _count: { select: { posts: { where: { status: 'PUBLISHED' } } } } }, orderBy: { name: 'asc' } });
  res.json(cats.map((c) => ({ id: c.id, name: c.name, slug: c.slug, count: c._count.posts })));
}));

catalog.get('/blog/posts', asyncH(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const size = Math.min(24, Math.max(1, Number(req.query.pageSize) || 9));
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
  const category = typeof req.query.category === 'string' ? req.query.category : '';
  const where = { status: 'PUBLISHED', ...(category ? { category: { slug: category } } : {}), ...(q ? { OR: [{ title: { contains: q } }, { excerpt: { contains: q } }] } : {}) };
  const [total, rows] = await Promise.all([
    prisma.blogPost.count({ where }),
    prisma.blogPost.findMany({ where, include: { category: true }, orderBy: { publishedAt: 'desc' }, skip: (page - 1) * size, take: size }),
  ]);
  res.json({ items: rows.map(postCard), total, page, pageSize: size, totalPages: Math.max(1, Math.ceil(total / size)) });
}));

catalog.get('/blog/posts/:slug', asyncH(async (req, res) => {
  const p = await prisma.blogPost.findFirst({ where: { slug: req.params.slug, status: 'PUBLISHED' }, include: { category: true } });
  if (!p) return res.status(404).json({ message: 'Article not found.' });
  const related = await prisma.blogPost.findMany({ where: { status: 'PUBLISHED', id: { not: p.id }, categoryId: p.categoryId }, include: { category: true }, orderBy: { publishedAt: 'desc' }, take: 3 });
  res.json({ ...postCard(p), content: p.content, related: related.map(postCard) });
}));

// ───────────── product reviews (verified purchases only) ─────────────
async function reviewStatus(userId: number | undefined, productId: number) {
  if (!userId) return { canReview: false, reason: 'login' as const };
  if (await prisma.review.findFirst({ where: { productId, userId } })) return { canReview: false, reason: 'already' as const };
  const bought = await prisma.orderItem.findFirst({ where: { productId, order: { userId, status: 'DELIVERED' } } });
  return bought ? { canReview: true, reason: 'ok' as const } : { canReview: false, reason: 'not-purchased' as const };
}

catalog.get('/products/:slug/review-status', asyncH(async (req, res) => {
  const p = await prisma.product.findFirst({ where: { slug: req.params.slug, isActive: true, archivedAt: null }, select: { id: true } });
  if (!p) return res.status(404).json({ message: 'Product not found' });
  res.json(await reviewStatus(req.user?.id, p.id));
}));

catalog.post('/products/:slug/reviews', requireAuth, asyncH(async (req, res) => {
  const body = z.object({
    rating: z.number().int().min(1, 'Choose a star rating').max(5),
    title: z.string().trim().max(120).optional(),
    body: z.string().trim().min(10, 'Tell us a bit more (10+ characters)').max(1500),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: body.error.issues[0].message, issues: body.error.flatten().fieldErrors });
  const p = await prisma.product.findFirst({ where: { slug: req.params.slug, isActive: true, archivedAt: null }, select: { id: true } });
  if (!p) return res.status(404).json({ message: 'Product not found' });
  const st = await reviewStatus(req.user!.id, p.id);
  if (!st.canReview) {
    return res.status(st.reason === 'already' ? 409 : 403).json({ message: st.reason === 'already' ? 'You have already reviewed this product.' : 'Only customers who received this product can review it.' });
  }
  const parts = req.user!.fullName.trim().split(/\s+/);
  const authorName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
  const r = await prisma.review.create({ data: { productId: p.id, userId: req.user!.id, authorName, rating: body.data.rating, title: body.data.title || null, body: body.data.body, status: 'PUBLISHED' } });
  await recalcProductRating(p.id);
  res.status(201).json({ id: r.id, message: 'Thanks for your review!' });
}));
