import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Heart, Loader2, LogOut, MapPin, PackageSearch, PawPrint, Settings, LayoutDashboard, ClipboardList } from 'lucide-react';
import { ApiError, api, useApi } from '../lib/api';
import type { Product } from '../lib/types';
import { useAuth, type User } from '../context/Auth';
import { useShop } from '../context/Shop';
import { formatDate, formatPeso } from '../lib/format';
import { Pill } from '../components/dashboard';
import { useToast } from '../context/Toast';
import ProductCard from '../components/ProductCard';
import { EmptyState, ProductSkeletons } from '../components/ui';
import { Field, FormError, PasswordInput, StrengthMeter, TextInput, passwordField } from '../components/forms';

const NAV = [
  ['/account', 'Dashboard', LayoutDashboard, true], ['/account/orders', 'My Orders', PackageSearch, false], ['/account/wishlist', 'My Wishlist', Heart, false],
  ['/account/pets', 'My Pets', PawPrint, false], ['/account/addresses', 'My Addresses', MapPin, false],
  ['/account/adoption-applications', 'Adoption Applications', ClipboardList, false], ['/account/settings', 'Account Settings', Settings, false],
] as const;

export function AccountLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="container-x grid gap-6 py-8 lg:grid-cols-[250px_1fr]">
      <aside className="card h-fit min-w-0 p-4">
        <div className="mb-3 flex items-center gap-3 border-b border-peach pb-3">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-primary font-display text-lg font-semibold text-white">{user?.fullName.charAt(0).toUpperCase()}</span>
          <div className="min-w-0"><p className="truncate text-sm font-extrabold">{user?.fullName}</p><p className="truncate text-xs text-choco-soft">{user?.email}</p></div>
        </div>
        <nav aria-label="Account" className="flex gap-1 overflow-x-auto lg:flex-col">
          {NAV.map(([to, label, Icon, end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${isActive ? 'bg-peach' : 'hover:bg-beige'}`}><Icon size={17} className="text-primary" />{label}</NavLink>
          ))}
          <button onClick={async () => { await logout(); nav('/'); }} className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-beige"><LogOut size={17} className="text-primary" />Logout</button>
        </nav>
      </aside>
      <section className="min-w-0"><Outlet /></section>
    </div>
  );
}

interface Summary { totalOrders: number; pendingOrders: number; wishlistItems: number; pets: number; recentOrders: { orderNumber: string; status: string; paymentStatus: string; total: number; createdAt: string; itemCount: number; isDemo: boolean }[] }

export function AccountHome() {
  const { user } = useAuth();
  const { data: s, error } = useApi<Summary>('/account/summary');
  const stats = [
    [PackageSearch, 'Total orders', s?.totalOrders, '/account/orders'], [ClipboardList, 'Pending orders', s?.pendingOrders, '/account/orders'],
    [Heart, 'Wishlist items', s?.wishlistItems, '/account/wishlist'], [PawPrint, 'Registered pets', s?.pets, '/account/pets'],
  ] as const;
  return (
    <div>
      <h1 className="text-3xl font-bold">Welcome back, {user?.fullName.split(' ')[0]}!</h1>
      <p className="mt-1 text-sm text-choco-soft">Here's what's happening with your Pawzora account.</p>
      {error && <p className="mt-4"><EmptyState title="Couldn't load your dashboard" text={error} /></p>}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([Icon, label, value, to]) => (
          <Link key={label} to={to} className="card card-hover p-5"><Icon className="text-primary" size={22} /><p className="mt-2 text-3xl font-extrabold">{value ?? '–'}</p><p className="text-sm font-bold text-choco-soft">{label}</p></Link>
        ))}
      </div>
      <section className="mt-8" aria-label="Recent orders">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-semibold">Recent orders</h2><Link to="/account/orders" className="text-sm font-extrabold text-link hover:underline">View all</Link></div>
        {s?.recentOrders.length === 0 && <EmptyState title="No orders yet" text="When you place an order it will show up here." action={<Link to="/shop" className="btn btn-sm">Start shopping</Link>} />}
        <ul className="space-y-2">
          {s?.recentOrders.map((o) => (
            <li key={o.orderNumber}><Link to={`/account/orders/${o.orderNumber}`} className="card card-hover flex flex-wrap items-center justify-between gap-3 p-4">
              <div><p className="font-display text-lg font-semibold">{o.orderNumber}</p><p className="text-xs text-choco-soft">{formatDate(o.createdAt)} · {o.itemCount} item(s){o.isDemo && ' · demo'}</p></div>
              <div className="flex items-center gap-3"><Pill value={o.status} /><b>{formatPeso(o.total)}</b></div>
            </Link></li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function WishlistPage() {
  const { wishlist } = useShop();
  const [items, setItems] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api<Product[]>('/wishlist').then(setItems).catch((e) => setError(e.message)); }, []);
  // removing a heart updates instantly because we filter by the live wishlist set
  const shown = items?.filter((p) => wishlist.has(p.id)) ?? null;
  return (
    <div>
      <h1 className="mb-1 text-3xl font-bold">My Wishlist</h1>
      <p className="mb-5 text-sm text-choco-soft">Products you've saved for later.</p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {error && <EmptyState title="Couldn't load your wishlist" text={error} />}
        {!shown && !error && <ProductSkeletons n={3} />}
        {shown?.length === 0 && <EmptyState title="Your wishlist is empty" text="Tap the heart on any product to save it here." action={<Link to="/shop" className="btn btn-sm">Browse products</Link>} />}
        {shown?.map((p) => <ProductCard key={p.id} p={p} />)}
      </div>
    </div>
  );
}

const profileSchema = z.object({ fullName: z.string().trim().min(2, 'Enter your full name').max(120), phone: z.string().trim().max(30).regex(/^[0-9+()\-\s]*$/, 'Enter a valid phone number') });
const pwSchema = z.object({ currentPassword: z.string().min(1, 'Enter your current password'), newPassword: passwordField, confirm: z.string().min(1, 'Confirm your new password') })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

function ProfileCard({ user }: { user: User }) {
  const { setUser } = useAuth();
  const { toast } = useToast();
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema), defaultValues: { fullName: user.fullName, phone: user.phone ?? '' },
  });
  return (
    <form noValidate className="card space-y-4 p-6" onSubmit={handleSubmit(async (v) => {
      try { const r = await api<{ user: User }>('/auth/me', { method: 'PATCH', json: { fullName: v.fullName, phone: v.phone || null } }); setUser(r.user); toast('Profile updated'); }
      catch (e) { toast((e as Error).message, 'error'); }
    })}>
      <h2 className="text-xl font-semibold">Profile</h2>
      <Field label="Full Name" htmlFor="p-name" error={errors.fullName?.message}><TextInput id="p-name" invalid={!!errors.fullName} {...register('fullName')} /></Field>
      <Field label="Email" htmlFor="p-email" hint="Your email can't be changed here."><TextInput id="p-email" value={user.email} disabled readOnly /></Field>
      <Field label="Phone Number" htmlFor="p-phone" error={errors.phone?.message}><TextInput id="p-phone" inputMode="tel" invalid={!!errors.phone} {...register('phone')} /></Field>
      <button className="btn" disabled={isSubmitting || !isDirty}>{isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Save changes'}</button>
    </form>
  );
}

function NotificationsCard({ user }: { user: User }) {
  const { setUser } = useAuth();
  const { toast } = useToast();
  const set = async (patch: Partial<Pick<User, 'notifyOrders' | 'notifyPromos'>>) => {
    try { const r = await api<{ user: User }>('/auth/me', { method: 'PATCH', json: patch }); setUser(r.user); toast('Preferences saved'); }
    catch (e) { toast((e as Error).message, 'error'); }
  };
  return (
    <div className="card space-y-3 p-6">
      <h2 className="text-xl font-semibold">Notification Preferences</h2>
      <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold"><input type="checkbox" className="accent-primary" checked={user.notifyOrders} onChange={(e) => set({ notifyOrders: e.target.checked })} />Order updates (confirmation, shipping, delivery)</label>
      <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold"><input type="checkbox" className="accent-primary" checked={user.notifyPromos} onChange={(e) => set({ notifyPromos: e.target.checked })} />Deals, new arrivals and pet care tips</label>
    </div>
  );
}

function PasswordCard() {
  const { toast } = useToast();
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, watch, reset, setError, formState: { errors, isSubmitting } } = useForm<z.infer<typeof pwSchema>>({ resolver: zodResolver(pwSchema) });
  return (
    <form noValidate className="card space-y-4 p-6" onSubmit={handleSubmit(async (v) => {
      setErr(null);
      try { await api('/auth/change-password', { method: 'POST', json: { currentPassword: v.currentPassword, newPassword: v.newPassword } }); toast('Password changed'); reset(); }
      catch (e) {
        if (e instanceof ApiError && e.issues.currentPassword) setError('currentPassword', { message: e.issues.currentPassword[0] }); else setErr((e as Error).message);
      }
    })}>
      <h2 className="text-xl font-semibold">Change Password</h2>
      <FormError message={err} />
      <Field label="Current Password" htmlFor="cp" error={errors.currentPassword?.message}><PasswordInput id="cp" autoComplete="current-password" invalid={!!errors.currentPassword} {...register('currentPassword')} /></Field>
      <Field label="New Password" htmlFor="np" error={errors.newPassword?.message}><PasswordInput id="np" autoComplete="new-password" invalid={!!errors.newPassword} {...register('newPassword')} /><StrengthMeter password={watch('newPassword') ?? ''} /></Field>
      <Field label="Confirm New Password" htmlFor="cnp" error={errors.confirm?.message}><PasswordInput id="cnp" autoComplete="new-password" invalid={!!errors.confirm} {...register('confirm')} /></Field>
      <button className="btn" disabled={isSubmitting}>{isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Update password'}</button>
      <p className="text-xs text-choco-soft">Changing your password signs you out on other devices.</p>
    </form>
  );
}

export function SettingsPage() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  if (!user) return null;
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">Account Settings</h1>
      <ProfileCard user={user} />
      <NotificationsCard user={user} />
      <PasswordCard />
      <button onClick={async () => { await logout(); nav('/'); }} className="btn btn-ghost"><LogOut size={16} /> Log out</button>
    </div>
  );
}
