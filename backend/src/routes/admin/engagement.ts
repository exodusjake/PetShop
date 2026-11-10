import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/db.js';
import { audit } from '../../lib/audit.js';
import { recalcProductRating } from '../../lib/reviews.js';
import { bad, h, idParam, pageInfo, paging } from './util.js';

export const adminEngagement = Router();

// ───────────── sidebar badges ─────────────
adminEngagement.get('/counts', h(async (_req, res) => {
  const [unreadMessages, pendingApplications] = await Promise.all([
    prisma.contactMessage.count({ where: { readAt: null } }),
    prisma.adoptionApplication.count({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } } }),
  ]);
  res.json({ unreadMessages, pendingApplications });
}));

// ───────────── review moderation ─────────────
adminEngagement.get('/reviews', h(async (req, res) => {
  const { page, size, skip } = paging(req);
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const status = ['PUBLISHED', 'HIDDEN'].find((s) => s === req.query.status);
  const where = { ...(status ? { status } : {}), ...(q ? { OR: [{ body: { contains: q } }, { authorName: { contains: q } }, { product: { name: { contains: q } } }] } : {}) };
  const [total, rows] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: size, include: { product: { select: { name: true, slug: true } } } }),
  ]);
  res.json({ items: rows.map((r) => ({ id: r.id, product: r.product, author: r.authorName, rating: r.rating, title: r.title, body: r.body, status: r.status, isDemo: r.isDemo, verified: r.userId != null, createdAt: r.createdAt })), ...pageInfo(total, page, size) });
}));

adminEngagement.patch('/reviews/:id', h(async (req, res) => {
  const p = z.object({ status: z.enum(['PUBLISHED', 'HIDDEN']) }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const r = await prisma.review.findUnique({ where: { id: idParam(req) } });
  if (!r) return res.status(404).json({ message: 'Review not found.' });
  await prisma.review.update({ where: { id: r.id }, data: { status: p.data.status } });
  await recalcProductRating(r.productId);
  await audit(req, `review.${p.data.status.toLowerCase()}`, 'Review', r.id);
  res.json({ ok: true });
}));

adminEngagement.delete('/reviews/:id', h(async (req, res) => {
  const r = await prisma.review.findUnique({ where: { id: idParam(req) } });
  if (!r) return res.status(404).json({ message: 'Review not found.' });
  await prisma.review.delete({ where: { id: r.id } });
  await recalcProductRating(r.productId);
  await audit(req, 'review.delete', 'Review', r.id);
  res.json({ ok: true });
}));

// ───────────── promotions (discount codes) ─────────────
const dateOrNull = z.string().trim().nullish().refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Invalid date').transform((v) => (v ? new Date(v) : null));
const couponFields = {
  type: z.enum(['PERCENT', 'FIXED']),
  value: z.number({ invalid_type_error: 'Enter the discount amount' }).positive('Discount must be more than 0').max(1_000_000),
  minSubtotal: z.number({ invalid_type_error: 'Enter a number' }).min(0).max(1_000_000).default(0),
  startsAt: dateOrNull, expiresAt: dateOrNull,
  usageLimit: z.number().int().min(1, 'Usage limit must be at least 1').max(1_000_000).nullish().transform((v) => v ?? null),
  isActive: z.boolean().default(true),
};
const checkCoupon = (v: { type: string; value: number; startsAt: Date | null; expiresAt: Date | null }) => {
  if (v.type === 'PERCENT' && v.value > 100) return 'A percentage discount can\'t be more than 100%.';
  if (v.startsAt && v.expiresAt && v.expiresAt <= v.startsAt) return 'The expiry date must be after the start date.';
  return null;
};
const createBody = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, 'Use 3–30 letters, numbers, - or _'), ...couponFields });
const updateBody = z.object(couponFields);

const couponDTO = (c: Awaited<ReturnType<typeof prisma.coupon.findFirstOrThrow>>) => ({
  id: c.id, code: c.code, type: c.type, value: Number(c.value), minSubtotal: Number(c.minSubtotal), startsAt: c.startsAt, expiresAt: c.expiresAt,
  usageLimit: c.usageLimit, usedCount: c.usedCount, isActive: c.isActive, createdAt: c.createdAt,
  state: !c.isActive ? 'DISABLED' : c.expiresAt && c.expiresAt < new Date() ? 'EXPIRED' : c.startsAt && c.startsAt > new Date() ? 'SCHEDULED' : c.usageLimit != null && c.usedCount >= c.usageLimit ? 'USED_UP' : 'ACTIVE',
});

adminEngagement.get('/coupons', h(async (_req, res) => res.json((await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } })).map(couponDTO))));

adminEngagement.post('/coupons', h(async (req, res) => {
  const p = createBody.safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const err = checkCoupon(p.data);
  if (err) return res.status(400).json({ message: err });
  if (await prisma.coupon.findUnique({ where: { code: p.data.code } })) return res.status(409).json({ message: 'That code already exists.', issues: { code: ['Already in use'] } });
  const c = await prisma.coupon.create({ data: p.data });
  await audit(req, 'coupon.create', 'Coupon', c.id, { code: c.code, type: c.type, value: p.data.value });
  res.status(201).json(couponDTO(c));
}));

adminEngagement.patch('/coupons/:id', h(async (req, res) => {
  const p = updateBody.safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const err = checkCoupon(p.data);
  if (err) return res.status(400).json({ message: err });
  const id = idParam(req);
  const r = await prisma.coupon.updateMany({ where: { id }, data: p.data });
  if (r.count === 0) return res.status(404).json({ message: 'Code not found.' });
  await audit(req, 'coupon.update', 'Coupon', id, { isActive: p.data.isActive });
  res.json(couponDTO(await prisma.coupon.findUniqueOrThrow({ where: { id } })));
}));

// Codes that were used keep their history. Disable them instead of deleting.
adminEngagement.delete('/coupons/:id', h(async (req, res) => {
  const id = idParam(req);
  const c = await prisma.coupon.findUnique({ where: { id } });
  if (!c) return res.status(404).json({ message: 'Code not found.' });
  if (c.usedCount > 0 || (await prisma.couponRedemption.count({ where: { couponId: id } })) > 0) return res.status(409).json({ message: 'This code has been used. Disable it instead of deleting it.' });
  await prisma.coupon.delete({ where: { id } });
  await audit(req, 'coupon.delete', 'Coupon', id, { code: c.code });
  res.json({ ok: true });
}));

// ───────────── contact messages ─────────────
adminEngagement.get('/messages', h(async (req, res) => {
  const { page, size, skip } = paging(req);
  const where = req.query.unread === 'true' ? { readAt: null } : {};
  const [total, rows, unread] = await Promise.all([
    prisma.contactMessage.count({ where }),
    prisma.contactMessage.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: size }),
    prisma.contactMessage.count({ where: { readAt: null } }),
  ]);
  res.json({ items: rows.map((m) => ({ id: m.id, name: m.name, email: m.email, subject: m.subject, message: m.message, read: m.readAt != null, createdAt: m.createdAt })), unread, ...pageInfo(total, page, size) });
}));

adminEngagement.patch('/messages/:id', h(async (req, res) => {
  const p = z.object({ read: z.boolean() }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const r = await prisma.contactMessage.updateMany({ where: { id: idParam(req) }, data: { readAt: p.data.read ? new Date() : null } });
  if (r.count === 0) return res.status(404).json({ message: 'Message not found.' });
  res.json({ ok: true });
}));

adminEngagement.delete('/messages/:id', h(async (req, res) => {
  const id = idParam(req);
  const r = await prisma.contactMessage.deleteMany({ where: { id } });
  if (r.count === 0) return res.status(404).json({ message: 'Message not found.' });
  await audit(req, 'message.delete', 'ContactMessage', id);
  res.json({ ok: true });
}));
