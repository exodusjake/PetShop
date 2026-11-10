import { Router, type Response } from 'express';
import { prisma } from '../../lib/db.js';
import { audit } from '../../lib/audit.js';
import { dateRange, dayKey, h, toCsv } from './util.js';

export const adminReports = Router();
const TYPES = ['sales', 'orders', 'products', 'inventory', 'customers'] as const;
type Table = { headers: string[]; rows: (string | number | null)[][] };
const money = (n: number) => Math.round(n * 100) / 100;

async function build(type: (typeof TYPES)[number], from: Date, to: Date): Promise<Table> {
  const range = { createdAt: { gte: from, lte: to } };
  const live = { status: { not: 'CANCELLED' } };

  if (type === 'sales') {
    const orders = await prisma.order.findMany({ where: { ...range, ...live }, include: { items: { select: { quantity: true } } } });
    const days = new Map<string, { orders: number; items: number; subtotal: number; discounts: number; shipping: number; revenue: number }>();
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) days.set(dayKey(d), { orders: 0, items: 0, subtotal: 0, discounts: 0, shipping: 0, revenue: 0 });
    for (const o of orders) {
      const r = days.get(dayKey(o.createdAt)); if (!r) continue;
      r.orders++; r.items += o.items.reduce((s, i) => s + i.quantity, 0); r.subtotal += Number(o.subtotal); r.discounts += Number(o.discountTotal); r.shipping += Number(o.shippingFee); r.revenue += Number(o.total);
    }
    return { headers: ['Date', 'Orders', 'Items sold', 'Subtotal (PHP)', 'Discounts (PHP)', 'Shipping (PHP)', 'Revenue (PHP)'], rows: [...days].map(([d, r]) => [d, r.orders, r.items, money(r.subtotal), money(r.discounts), money(r.shipping), money(r.revenue)]) };
  }
  if (type === 'orders') {
    const orders = await prisma.order.findMany({ where: range, orderBy: { createdAt: 'desc' }, include: { items: { select: { quantity: true } } } });
    return { headers: ['Order', 'Date', 'Customer', 'Email', 'Status', 'Payment', 'Method', 'Items', 'Subtotal (PHP)', 'Discount (PHP)', 'Shipping (PHP)', 'Total (PHP)', 'Demo'],
      rows: orders.map((o) => [o.orderNumber, dayKey(o.createdAt), o.shipName, o.email, o.status, o.paymentStatus, o.paymentMethod, o.items.reduce((s, i) => s + i.quantity, 0), Number(o.subtotal), Number(o.discountTotal), Number(o.shippingFee), Number(o.total), o.isDemo ? 'yes' : 'no']) };
  }
  if (type === 'products') {
    const grouped = await prisma.orderItem.groupBy({ by: ['productId'], where: { order: { ...range, ...live } }, _sum: { quantity: true, lineTotal: true }, orderBy: { _sum: { quantity: 'desc' } } });
    const prods = await prisma.product.findMany({ where: { id: { in: grouped.map((g) => g.productId) } }, include: { category: true } });
    return { headers: ['Product', 'Category', 'Units sold', 'Revenue (PHP)'], rows: grouped.map((g) => { const p = prods.find((x) => x.id === g.productId); return [p?.name ?? `#${g.productId}`, p?.category.name ?? '', g._sum.quantity ?? 0, money(Number(g._sum.lineTotal ?? 0))]; }) };
  }
  if (type === 'inventory') {
    const inv = await prisma.inventory.findMany({ include: { product: { include: { category: true } } }, orderBy: { quantity: 'asc' } });
    return { headers: ['Product', 'Brand', 'Category', 'In stock', 'Low-stock threshold', 'Status', 'Archived'],
      rows: inv.map((i) => [i.product.name, i.product.brand, i.product.category.name, i.quantity, i.lowStockThreshold, i.quantity === 0 ? 'Out of stock' : i.quantity <= i.lowStockThreshold ? 'Low stock' : 'OK', i.product.archivedAt ? 'yes' : 'no']) };
  }
  const users = await prisma.user.findMany({ where: { role: { name: 'CUSTOMER' }, ...range }, orderBy: { createdAt: 'desc' } });
  const sums = await prisma.order.groupBy({ by: ['userId'], where: { userId: { in: users.map((u) => u.id) }, status: { not: 'CANCELLED' } }, _sum: { total: true }, _count: true });
  return { headers: ['Name', 'Email', 'Joined', 'Status', 'Orders', 'Total spent (PHP)'],
    rows: users.map((u) => { const s = sums.find((x) => x.userId === u.id); return [u.fullName, u.email, dayKey(u.createdAt), u.status, s?._count ?? 0, money(Number(s?._sum.total ?? 0))]; }) };
}

adminReports.get('/reports/:type', h(async (req, res: Response) => {
  const type = TYPES.find((t) => t === req.params.type);
  if (!type) return res.status(404).json({ message: 'Unknown report.' });
  const { from, to } = dateRange(req);
  if (to.getTime() - from.getTime() > 400 * 864e5) return res.status(400).json({ message: 'Please choose a range of 400 days or less.' });
  const t = await build(type, from, to);
  if (req.query.format === 'csv') {
    await audit(req, 'report.export', 'Report', type, { from: dayKey(from), to: dayKey(to), rows: t.rows.length });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pawzora-${type}-${dayKey(from)}_${dayKey(to)}.csv"`);
    return res.send('﻿' + toCsv(t.headers, t.rows)); // BOM so Excel reads UTF-8 (₱, accents) correctly
  }
  res.json({ type, from: dayKey(from), to: dayKey(to), headers: t.headers, rows: t.rows });
}));
