import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Boxes, ClipboardList, CreditCard, ExternalLink, Heart, LayoutDashboard, LogOut, Mail, Menu, Newspaper, Package, Percent, Settings, Star, Tags, Users, X } from 'lucide-react';
import { useAuth } from '../../context/Auth';
import { api } from '../../lib/api';
import { Logo } from '../../components/ui';

const NAV = [
  ['/admin', 'Dashboard', LayoutDashboard, true, false], ['/admin/products', 'Products', Package, false, false], ['/admin/categories', 'Categories', Tags, false, false],
  ['/admin/inventory', 'Inventory', Boxes, false, false], ['/admin/orders', 'Orders', ClipboardList, false, false], ['/admin/customers', 'Customers', Users, false, false],
  ['/admin/payments', 'Payments', CreditCard, false, false], ['/admin/adoption', 'Adoption', Heart, false, false], ['/admin/blog', 'Blog', Newspaper, false, false],
  ['/admin/reviews', 'Reviews', Star, false, false], ['/admin/promotions', 'Promotions', Percent, false, false], ['/admin/messages', 'Messages', Mail, false, false],
  ['/admin/reports', 'Reports', BarChart3, false, false], ['/admin/settings', 'Settings', Settings, false, false],
] as const;

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<{ unreadMessages: number; pendingApplications: number }>({ unreadMessages: 0, pendingApplications: 0 });
  useEffect(() => { api<typeof counts>('/admin/counts').then(setCounts).catch(() => {}); }, [loc.pathname]); // refresh when moving between sections
  const badge: Record<string, number> = { '/admin/messages': counts.unreadMessages, '/admin/adoption': counts.pendingApplications };
  useEffect(() => setOpen(false), [loc.pathname]);

  const links = (
    <nav aria-label="Admin" className="flex flex-col gap-0.5">
      {NAV.map(([to, label, Icon, end, soon]) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${isActive ? 'bg-primary text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}>
          <Icon size={18} />{label}{soon && <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-extrabold uppercase">Soon</span>}{!soon && (badge[to] ?? 0) > 0 && <span className="ml-auto grid h-5 min-w-[20px] place-items-center rounded-full bg-white px-1.5 text-[11px] font-extrabold text-link" aria-label={`${badge[to]} waiting`}>{badge[to]}</span>}
        </NavLink>
      ))}
      <button onClick={async () => { await logout(); nav('/'); }} className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-white/80 hover:bg-white/10 hover:text-white"><LogOut size={18} />Logout</button>
    </nav>
  );

  return (
    <div className="min-h-screen bg-beige lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="hidden bg-choco p-4 lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto">
        <Link to="/admin" className="mb-5 block rounded-2xl bg-white/95 p-2"><Logo className="mx-auto h-14" /></Link>
        {links}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[270px] overflow-y-auto bg-choco p-4">
            <div className="mb-4 flex items-center justify-between"><Logo className="h-12 rounded-xl bg-white/95 p-1" /><button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-full p-2 text-white hover:bg-white/10"><X size={20} /></button></div>
            {links}
          </aside>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-peach bg-cream/95 px-4 py-3 backdrop-blur sm:px-6">
          <button className="rounded-full p-2 hover:bg-peach lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={22} /></button>
          <span className="rounded-full bg-peach px-3 py-1 text-xs font-extrabold uppercase tracking-wide">Admin</span>
          <Link to="/" className="ml-auto flex items-center gap-1.5 text-sm font-bold hover:text-primary"><ExternalLink size={15} />View store</Link>
          <span className="hidden text-sm font-bold text-choco-soft sm:block">{user?.email}</span>
        </header>
        <main className="p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
