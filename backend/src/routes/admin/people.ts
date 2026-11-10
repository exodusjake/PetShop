import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/db.js';
import { audit } from '../../lib/audit.js';
import { bad, h, idParam, pageInfo, paging } from './util.js';

export const adminPeople = Router();

adminPeople.get('/customers', h(async (req, res) => {
  const { page, size, skip } = paging(req);
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const where = { role: { name: 'CUSTOMER' }, ...(q ? { OR: [{ fullName: { contains: q } }, { email: { contains: q } }] } : {}), ...(req.query.status === 'SUSPENDED' ? { status: 'SUSPENDED' } : {}) };
  const [total, rows] = await Promise.all([prisma.user.count({ where }), prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: size })]);
  const sums = await prisma.order.groupBy({ by: ['userId'], where: { userId: { in: rows.map((r) => r.id) }, status: { not: 'CANCELLED' } }, _sum: { total: true }, _count: true });
  res.json({
    items: rows.map((u) => { const s = sums.find((x) => x.userId === u.id); return { id: u.id, name: u.fullName, email: u.email, phone: u.phone, status: u.status, isDemo: u.isDemo, orders: s?._count ?? 0, totalSpent: Number(s?._sum.total ?? 0), joinedAt: u.createdAt }; }),
    ...pageInfo(total, page, size),
  });
}));

adminPeople.get('/customers/:id', h(async (req, res) => {
  const u = await prisma.user.findFirst({ where: { id: idParam(req), role: { name: 'CUSTOMER' } }, include: { orders: { orderBy: { createdAt: 'desc' }, take: 20 }, _count: { select: { pets: true, wishlist: true } } } });
  if (!u) return res.status(404).json({ message: 'Customer not found.' });
  res.json({
    id: u.id, name: u.fullName, email: u.email, phone: u.phone, status: u.status, isDemo: u.isDemo, joinedAt: u.createdAt, pets: u._count.pets, wishlistItems: u._count.wishlist,
    orders: u.orders.map((o) => ({ orderNumber: o.orderNumber, status: o.status, paymentStatus: o.paymentStatus, total: Number(o.total), createdAt: o.createdAt })),
  });
}));

// Admin accounts can't be suspended from here (and an admin can never suspend themselves), so nobody gets locked out.
adminPeople.patch('/customers/:id/status', h(async (req, res) => {
  const p = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const id = idParam(req);
  const u = await prisma.user.findFirst({ where: { id, role: { name: 'CUSTOMER' } } });
  if (!u) return res.status(404).json({ message: 'Customer not found.' });
  await prisma.user.update({ where: { id }, data: { status: p.data.status } });
  if (p.data.status === 'SUSPENDED') await prisma.userSession.deleteMany({ where: { userId: id } }); // sign them out everywhere
  await audit(req, p.data.status === 'SUSPENDED' ? 'customer.suspend' : 'customer.activate', 'User', id, { email: u.email });
  res.json({ ok: true, status: p.data.status });
}));
