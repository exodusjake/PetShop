import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, DollarSign, Package, ShoppingBag, Users } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi } from '../../lib/api';
import type { AdminStats } from '../../lib/adminTypes';
import { formatDate, formatPeso } from '../../lib/format';
import { EmptyState } from '../../components/ui';
import { DataTable, PageHeader, Pill, StatCard } from '../../components/dashboard';

const peso = (v: number) => formatPeso(v);

export default function Dashboard() {
  const { data: s, error } = useApi<AdminStats>('/admin/stats');
  if (error) return <EmptyState title="Couldn't load the dashboard" text={error} />;
  if (!s) return <div className="space-y-4"><div className="skeleton h-24" /><div className="skeleton h-72" /></div>;
  const shortDate = (d: string) => new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Live numbers from your database." />
      {s.includesDemoData && <p className="rounded-2xl bg-yellow-50 px-4 py-2.5 text-sm font-bold text-yellow-900">Some orders and customers are demo data created by the development seed. Real activity appears alongside them.</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total revenue" value={peso(s.totalRevenue)} hint={`${peso(s.paidRevenue)} collected`} icon={<DollarSign />} tone="green" />
        <StatCard label="Total orders" value={s.totalOrders} icon={<ShoppingBag />} />
        <StatCard label="Customers" value={s.totalCustomers} icon={<Users />} tone="blue" />
        <StatCard label="Active products" value={s.totalProducts} icon={<Package />} />
        <StatCard label="Pending orders" value={s.pendingOrders} icon={<Clock />} tone="peach" />
        <StatCard label="Low-stock products" value={s.lowStockCount} icon={<AlertTriangle />} tone={s.lowStockCount ? 'red' : 'green'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <section className="card p-5" aria-label="Revenue, last 30 days">
          <h2 className="mb-3 text-lg font-semibold">Revenue (last 30 days)</h2>
          <div className="h-64"><ResponsiveContainer width="100%" height="100%">
            <AreaChart data={s.salesByDay} margin={{ left: 0, right: 8, top: 5 }}>
              <defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#E86A16" stopOpacity={0.4} /><stop offset="95%" stopColor="#E86A16" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0DCCB" />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} interval={4} />
              <YAxis tick={{ fontSize: 11 }} width={56} tickFormatter={(v) => `₱${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
              <Tooltip formatter={(v: number) => [peso(v), 'Revenue']} labelFormatter={shortDate} />
              <Area isAnimationActive={false} type="monotone" dataKey="revenue" stroke="#E86A16" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer></div>
        </section>
        <section className="card p-5" aria-label="Orders per day">
          <h2 className="mb-3 text-lg font-semibold">Orders per day</h2>
          <div className="h-64"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={s.salesByDay} margin={{ left: -20, right: 8, top: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0DCCB" />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} interval={6} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={shortDate} formatter={(v: number) => [v, 'Orders']} />
              <Bar isAnimationActive={false} dataKey="orders" fill="#4A2515" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer></div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section aria-label="Best sellers">
          <h2 className="mb-2 text-lg font-semibold">Best-selling products</h2>
          <DataTable compact rows={s.bestSellers} rowKey={(r) => r.productId} empty="No sales yet."
            columns={[{ header: 'Product', cell: (r) => <span className="font-bold">{r.name}</span> }, { header: 'Units', cell: (r) => r.units, className: 'text-right' }, { header: 'Revenue', cell: (r) => peso(r.revenue), className: 'text-right' }]} />
        </section>
        <section aria-label="Low stock">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-semibold">Needs restocking</h2><Link to="/admin/inventory?low=true" className="text-sm font-extrabold text-link hover:underline">View inventory</Link></div>
          <DataTable compact rows={s.lowStock} rowKey={(r) => r.productId} empty="Everything is well stocked."
            columns={[{ header: 'Product', cell: (r) => <span className="font-bold">{r.name}</span> }, { header: 'In stock', cell: (r) => <Pill value={r.quantity === 0 ? 'OUT' : 'LOW'} label={`${r.quantity} left`} />, className: 'text-right' }]} />
        </section>
      </div>

      <section aria-label="Recent orders">
        <div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-semibold">Recent orders</h2><Link to="/admin/orders" className="text-sm font-extrabold text-link hover:underline">All orders</Link></div>
        <DataTable rows={s.recentOrders} rowKey={(r) => r.orderNumber} empty="No orders yet."
          columns={[
            { header: 'Order', cell: (r) => <Link to={`/admin/orders/${r.orderNumber}`} className="font-extrabold text-link hover:underline">{r.orderNumber}</Link> },
            { header: 'Customer', cell: (r) => r.customer }, { header: 'Date', cell: (r) => formatDate(r.createdAt) },
            { header: 'Status', cell: (r) => <Pill value={r.status} /> }, { header: 'Payment', cell: (r) => <Pill value={r.paymentStatus} /> },
            { header: 'Total', cell: (r) => <b>{peso(r.total)}</b>, className: 'text-right' },
          ]} />
      </section>

      <section aria-label="Recent transactions">
        <h2 className="mb-2 text-lg font-semibold">Recent transactions</h2>
        <DataTable rows={s.recentTransactions} rowKey={(r) => r.id} empty="No transactions yet."
          columns={[
            { header: 'Order', cell: (r) => r.orderNumber }, { header: 'Customer email', cell: (r) => r.email }, { header: 'Method', cell: (r) => r.provider },
            { header: 'Status', cell: (r) => <Pill value={r.status} /> }, { header: 'Amount', cell: (r) => <b>{peso(r.amount)}</b>, className: 'text-right' },
          ]} />
      </section>
    </div>
  );
}
