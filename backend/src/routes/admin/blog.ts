import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/db.js';
import { audit } from '../../lib/audit.js';
import { slugify } from '../../lib/constants.js';
import { bad, h, idParam, pageInfo, paging } from './util.js';

export const adminBlog = Router();

const localImage = z.string().max(300).regex(/^\/(uploads|img)\/[A-Za-z0-9._-]+$/, 'Invalid image path');

// Content is plain text (blank line = new paragraph, "## " = heading). It is never rendered as HTML, so it can't carry scripts.
const postBody = z.object({
  title: z.string().trim().min(3, 'Enter a title').max(200),
  excerpt: z.string().trim().min(10, 'Write a short summary (10+ characters)').max(400),
  content: z.string().trim().min(30, 'Write the article (30+ characters)').max(20000),
  coverUrl: localImage.nullish().transform((v) => v ?? null),
  categoryId: z.number().int().positive('Choose a category'),
  status: z.enum(['DRAFT', 'PUBLISHED']),
});

const readMinutes = (text: string) => Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length / 200));

async function uniqueSlug(title: string, ignoreId?: number) {
  const base = slugify(title) || 'post';
  for (let i = 0; ; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const hit = await prisma.blogPost.findUnique({ where: { slug } });
    if (!hit || hit.id === ignoreId) return slug;
  }
}

const dto = (p: Awaited<ReturnType<typeof prisma.blogPost.findFirstOrThrow<{ include: { category: true } }>>>) => ({
  id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt, content: p.content, coverUrl: p.coverUrl, categoryId: p.categoryId, category: p.category.name,
  status: p.status, readMinutes: p.readMinutes, isDemo: p.isDemo, publishedAt: p.publishedAt, updatedAt: p.updatedAt,
});

adminBlog.get('/blog/categories', h(async (_req, res) => res.json(await prisma.blogCategory.findMany({ orderBy: { name: 'asc' } }))));

adminBlog.get('/blog/posts', h(async (req, res) => {
  const { page, size, skip } = paging(req);
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const status = ['DRAFT', 'PUBLISHED'].find((s) => s === req.query.status);
  const where = { ...(status ? { status } : {}), ...(q ? { title: { contains: q } } : {}) };
  const [total, rows] = await Promise.all([prisma.blogPost.count({ where }), prisma.blogPost.findMany({ where, include: { category: true }, orderBy: { updatedAt: 'desc' }, skip, take: size })]);
  res.json({ items: rows.map(dto), ...pageInfo(total, page, size) });
}));

adminBlog.post('/blog/posts', h(async (req, res) => {
  const p = postBody.safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  if (!(await prisma.blogCategory.findUnique({ where: { id: p.data.categoryId } }))) return res.status(400).json({ message: 'Choose a valid category.' });
  const created = await prisma.blogPost.create({
    data: { ...p.data, slug: await uniqueSlug(p.data.title), readMinutes: readMinutes(p.data.content), authorId: req.user!.id, publishedAt: p.data.status === 'PUBLISHED' ? new Date() : null },
    include: { category: true },
  });
  await audit(req, 'blog.create', 'BlogPost', created.id, { title: created.title, status: created.status });
  res.status(201).json(dto(created));
}));

adminBlog.patch('/blog/posts/:id', h(async (req, res) => {
  const p = postBody.safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const id = idParam(req);
  const existing = await prisma.blogPost.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Article not found.' });
  if (!(await prisma.blogCategory.findUnique({ where: { id: p.data.categoryId } }))) return res.status(400).json({ message: 'Choose a valid category.' });
  const updated = await prisma.blogPost.update({
    where: { id },
    data: {
      ...p.data, readMinutes: readMinutes(p.data.content),
      // the address of a published article never changes; drafts can follow the title
      slug: existing.status === 'PUBLISHED' ? existing.slug : await uniqueSlug(p.data.title, id),
      publishedAt: p.data.status === 'PUBLISHED' ? existing.publishedAt ?? new Date() : null,
    },
    include: { category: true },
  });
  await audit(req, 'blog.update', 'BlogPost', id, { status: updated.status });
  res.json(dto(updated));
}));

adminBlog.delete('/blog/posts/:id', h(async (req, res) => {
  const id = idParam(req);
  const r = await prisma.blogPost.deleteMany({ where: { id } });
  if (r.count === 0) return res.status(404).json({ message: 'Article not found.' });
  await audit(req, 'blog.delete', 'BlogPost', id);
  res.json({ ok: true });
}));
