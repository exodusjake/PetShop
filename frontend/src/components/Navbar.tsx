import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Heart, LayoutDashboard, LogOut, MapPin, Menu, PackageSearch, PawPrint, Search, Settings, ShieldCheck, ShoppingCart, User, X } from 'lucide-react';
import { Logo } from './ui';
import { useShop } from '../context/Shop';
import { useAuth } from '../context/Auth';
import { useApi } from '../lib/api';
import type { Category } from '../lib/types';

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-1 rounded-full px-2 py-1.5 text-[15px] font-bold transition xl:px-3 ${isActive ? 'bg-primary text-white' : 'hover:bg-peach'}`;

function Dropdown({ label, to, items, plain = false }: { label: string; to: string; items: { label: string; to: string }[]; plain?: boolean }) {
  const [open, setOpen] = useState(false);
  const t = useRef<number>();
  const show = () => { clearTimeout(t.current); setOpen(true); };
  const hide = () => { t.current = window.setTimeout(() => setOpen(false), 120); };
  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {plain
        ? <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={linkCls({ isActive: false })}>{label}<ChevronDown size={14} strokeWidth={2.6} /></button>
        : <NavLink to={to} end className={linkCls}>{label}<ChevronDown size={14} strokeWidth={2.6} /></NavLink>}
      <AnimatePresence>
        {open && (
          <motion.ul initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-50 mt-2 w-56 rounded-2xl bg-white p-2 shadow-lift">
            {items.map((i) => (
              <li key={i.to}><Link to={i.to} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 text-sm font-semibold hover:bg-peach">{i.label}</Link></li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProfileMenu() {
  const { user, isAdmin, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  if (!user) return null;
  const items = [
    ['/account', 'My Dashboard', LayoutDashboard], ['/account/orders', 'My Orders', PackageSearch], ['/account/wishlist', 'My Wishlist', Heart],
    ['/account/pets', 'My Pets', PawPrint], ['/account/addresses', 'My Addresses', MapPin], ['/account/settings', 'Account Settings', Settings],
  ] as const;
  return (
    <div className="relative" ref={ref}>
      <button data-testid="profile-menu" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-peach">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-primary font-display text-base font-semibold text-white"><span aria-hidden="true">{user.fullName.charAt(0).toUpperCase()}</span></span><span className="sr-only">Account menu for {user.fullName}</span>
        <span className="hidden max-w-[110px] truncate text-sm font-bold xl:block">{user.fullName.split(' ')[0]}</span>
        <ChevronDown size={14} strokeWidth={2.6} className="hidden sm:block" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.15 }}
            role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl bg-white p-2 shadow-lift">
            <div className="border-b border-peach px-3 pb-2 pt-1"><p className="truncate text-sm font-extrabold">{user.fullName}</p><p className="truncate text-xs text-choco-soft">{user.email}</p></div>
            {isAdmin && <Link role="menuitem" to="/admin" onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2 rounded-xl bg-peach/60 px-3 py-2 text-sm font-extrabold hover:bg-peach"><ShieldCheck size={16} className="text-primary" />Admin Dashboard</Link>}
            {items.map(([to, label, Icon]) => (
              <Link key={to} role="menuitem" to={to} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-peach"><Icon size={16} className="text-primary" />{label}</Link>
            ))}
            <button role="menuitem" onClick={async () => { setOpen(false); await logout(); nav('/'); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-peach"><LogOut size={16} className="text-primary" />Logout</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const { cartCount, wishlist, setCartOpen } = useShop();
  const { data } = useApi<{ pets: Category[]; categories: Category[] }>('/catalog/categories');
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);

  useEffect(() => setMenu(false), [loc.pathname, loc.search]);

  const submit = (e: FormEvent) => { e.preventDefault(); nav(`/shop${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); };
  const shopItems = [{ label: 'All Products', to: '/shop' }, ...(data?.categories ?? []).map((c) => ({ label: c.name, to: `/categories/${c.slug}` }))];
  const petItems = (data?.pets ?? []).map((c) => ({ label: c.name, to: `/shop?pet=${c.slug}` }));

  const Badge = ({ n }: { n: number }) => n > 0 ? (
    <span className="absolute -right-2 -top-2 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-extrabold text-white">{n}</span>
  ) : null;

  return (
    <>
      <aside aria-label="Store announcement" className="bg-choco px-4 py-1.5 text-center text-xs font-semibold text-white">
        Free shipping on orders over ₱2,000 · Use code <b className="text-primary-light">PAWZORA10</b> for 10% off your first order
      </aside>
      <header className="sticky top-0 z-40 bg-cream/90 shadow-soft backdrop-blur">
        <div className="container-x flex h-[68px] items-center gap-4 !max-w-[1320px]">
          <button className="rounded-full p-2 hover:bg-peach lg:hidden" aria-label="Open menu" onClick={() => setMenu(true)}><Menu size={24} /></button>
          <Link to="/" aria-label="Pawzora home" className="shrink-0"><Logo className="h-12" /></Link>

          <nav className="ml-2 hidden items-center lg:flex" aria-label="Main">
            <NavLink to="/" end className={linkCls}>Home</NavLink>
            <Dropdown label="Shop" to="/shop" items={shopItems} />
            <Dropdown label="Pets" to="/shop" items={petItems} plain />
            <NavLink to="/adoption" className={linkCls}>Adoption</NavLink>
            <NavLink to="/deals" className={linkCls}>Deals</NavLink>
            <NavLink to="/blog" className={linkCls}>Blog</NavLink>
            <NavLink to="/about" className={linkCls}>About</NavLink>
            <NavLink to="/contact" className={linkCls}>Contact</NavLink>
          </nav>

          <form onSubmit={submit} role="search" aria-label="Search products" className="ml-auto hidden lg:max-w-[150px] xl:max-w-[230px] max-w-[230px] flex-1 items-center gap-2 rounded-full border-2 border-peach bg-white px-4 py-2 md:flex">
            <Search size={18} className="shrink-0 text-choco-soft" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for pet products..." aria-label="Search products"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </form>

          <div className="ml-auto flex items-center gap-3 md:ml-0">
            {isAdmin && <Link to="/admin" aria-label="Admin Panel" title="Admin Panel" className="btn btn-sm hidden !bg-choco !px-3 hover:!bg-black xl:inline-flex"><ShieldCheck size={15} /><span className="hidden 2xl:inline">Admin Panel</span></Link>}
            {user ? <ProfileMenu /> : (
              <>
                <Link to="/login" className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold hover:bg-peach sm:flex"><User size={18} /><span className="hidden xl:inline">Login</span></Link>
                <Link to="/register" className="btn btn-sm hidden sm:inline-flex">Sign Up</Link>
              </>
            )}
            <Link data-testid="wishlist-link" to={user ? '/account/wishlist' : '/login?next=/account/wishlist'} className="relative rounded-full p-2 hover:bg-peach"><Heart size={22} aria-hidden="true" /><span className="sr-only">Wishlist{wishlist.size > 0 ? ', items:' : ''}</span><Badge n={wishlist.size} /></Link>
            <button data-testid="cart-button" onClick={() => setCartOpen(true)} className="relative rounded-full p-2 hover:bg-peach"><ShoppingCart size={22} aria-hidden="true" /><span className="sr-only">Open cart{cartCount > 0 ? ', items:' : ''}</span><Badge n={cartCount} /></button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menu && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-choco/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenu(false)} />
            <motion.aside className="fixed inset-y-0 left-0 z-50 flex w-[300px] max-w-[85vw] flex-col gap-1 overflow-y-auto bg-cream p-5 shadow-lift"
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'tween', duration: 0.22 }} aria-label="Mobile menu">
              <div className="mb-3 flex items-center justify-between"><Logo className="h-11" /><button onClick={() => setMenu(false)} aria-label="Close menu" className="rounded-full p-2 hover:bg-peach"><X size={22} /></button></div>
              <form onSubmit={submit} className="mb-3 flex items-center gap-2 rounded-full border-2 border-peach bg-white px-4 py-2">
                <Search size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
              </form>
              {[['/', 'Home'], ['/shop', 'Shop'], ['/adoption', 'Adoption'], ['/deals', 'Deals'], ['/blog', 'Blog'], ['/about', 'About Us'], ['/contact', 'Contact']].map(([to, l]) => (
                <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `rounded-xl px-4 py-3 text-base font-bold ${isActive ? 'bg-primary text-white' : 'hover:bg-peach'}`}>{l}</NavLink>
              ))}
              <p className="mt-3 px-4 text-xs font-extrabold uppercase tracking-wide text-choco-soft">Shop by pet</p>
              <div className="flex flex-wrap gap-2 px-3">
                {petItems.map((p) => <Link key={p.to} to={p.to} className="rounded-full bg-white px-3 py-1.5 text-sm font-bold shadow-soft">{p.label}</Link>)}
              </div>
              {user ? (
                <div className="mt-3 space-y-1 border-t border-peach pt-3">
                  <p className="truncate px-4 text-sm font-extrabold">{user.fullName}</p>
                  {isAdmin && <Link to="/admin" className="block rounded-xl px-4 py-2.5 text-sm font-extrabold text-link hover:bg-peach">Admin Dashboard</Link>}
                  {[['/account', 'My Dashboard'], ['/account/orders', 'My Orders'], ['/account/wishlist', 'My Wishlist'], ['/account/pets', 'My Pets'], ['/account/addresses', 'My Addresses'], ['/account/settings', 'Account Settings']].map(([to, l]) => (
                    <Link key={to} to={to} className="block rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-peach">{l}</Link>
                  ))}
                  <button onClick={async () => { setMenu(false); await logout(); nav('/'); }} className="block w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold hover:bg-peach">Logout</button>
                </div>
              ) : (
                <div className="mt-auto grid grid-cols-2 gap-3 pt-6">
                  <Link to="/login" className="btn btn-ghost">Login</Link>
                  <Link to="/register" className="btn">Sign Up</Link>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
