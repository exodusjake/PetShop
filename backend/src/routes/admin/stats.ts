import { Router } from 'express';
import { prisma } from '../../lib/db.js';
import { dayKey, h } from './util.js';

export const stats = Router();

// All numbers come from the database. Cancelled orders are excluded from sales figures.
stats.get('/stats', h(async (_req, res) => {
  const live = { status: { not: 'CANCELLED' } };
  const since = new Date(); since.setDate(since.getDate() - 29); since.setHours(0, 0, 0, 0);

  const [rev, paidRev, totalOrders, pendingOrders, customers, products, inventory, recent, txns, last30, sold, demoOrders] = await Promise.all([
    prisma.order.aggregate({ _sum: { total: true }, where: live }),
    prisma.order.aggregate({ _sum: { total: true }, where: { ...live, paymentStatus: 'PAID' } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.user.count({ where: { role: { name: 'CUSTOMER' } } }),
    prisma.product.count({ where: { isActive: true, archivedAt: null } }),
    prisma.inventory.findMany({ where: { product: { isActive: true, archivedAt: null } }, include: { product: { select: { id: true, name: true } } } }),
    prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 6, include: { user: { select: { fullName: true } } } }),
    prisma.payment.findMany({ orderBy: { createdAt: 'desc' }, take: 6, include: { order: { select: { orderNumber: true, email: true } } } }),
    prisma.order.findMany({ where: { ...live, createdAt: { gte: since } }, select: { createdAt: true, total: true } }),
    prisma.orderItem.groupBy({ by: ['productId'], where: { order: live }, _sum: { quantity: true, lineTotal: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 5 }),
    prisma.order.count({ where: { isDemo: true } }),
  ]);

  const days = new Map<string, { date: string; orders: number; revenue: number }>();
  for (let i = 0; i < 30; i++) { const d = new Date(since); d.setDate(since.getDate() + i); days.set(dayKey(d), { date: dayKey(d), orders: 0, revenue: 0 }); }
  for (const o of last30) { const r = days.get(dayKey(o.createdAt)); if (r) { r.orders++; r.revenue += Number(o.total); } }

  const names = await prisma.product.findMany({ where: { id: { in: sold.map((s) => s.productId) } }, select: { id: true, name: true } });
  const lowStock = inventory.filter((i) => i.quantity <= i.lowStockThreshold).sort((a, b) => a.quantity - b.quantity);

  res.json({
    totalRevenue: Number(rev._sum.total ?? 0), paidRevenue: Number(paidRev._sum.total ?? 0), totalOrders, pendingOrders,
    totalCustomers: customers, totalProducts: products, lowStockCount: lowStock.length,
    lowStock: lowStock.slice(0, 6).map((i) => ({ productId: i.productId, name: i.product.name, quantity: i.quantity, threshold: i.lowStockThreshold })),
    salesByDay: [...days.values()].map((d) => ({ ...d, revenue: Math.round(d.revenue * 100) / 100 })),
    bestSellers: sold.map((s) => ({ productId: s.productId, name: names.find((n) => n.id === s.productId)?.name ?? 'Unknown', units: s._sum.quantity ?? 0, revenue: Number(s._sum.lineTotal ?? 0) })),
    recentOrders: recent.map((o) => ({ orderNumber: o.orderNumber, customer: o.user?.fullName ?? o.shipName, status: o.status, paymentStatus: o.paymentStatus, total: Number(o.total), createdAt: o.createdAt, isDemo: o.isDemo })),
    recentTransactions: txns.map((p) => ({ id: p.id, orderNumber: p.order.orderNumber, email: p.order.email, provider: p.provider, amount: Number(p.amount), status: p.status, createdAt: p.createdAt })),
    includesDemoData: demoOrders > 0,
  });
}));
