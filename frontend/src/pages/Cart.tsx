import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Tag, Trash2, X } from 'lucide-react';
import { formatPeso } from '../lib/format';
import { useShop } from '../context/Shop';
import { EmptyState } from '../components/ui';
import { FreeShippingHint, LineThumb, QtyStepper, Totals } from '../components/cart';

export function CouponBox() {
  const { cart, applyCoupon, removeCoupon } = useShop();
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!cart) return null;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const m = await applyCoupon(code);
    setErr(m); if (!m) setCode('');
    setBusy(false);
  };
  return (
    <div>
      {cart.coupon ? (
        <div className="flex items-center justify-between rounded-xl bg-softgreen px-3 py-2 text-sm font-bold text-green-900">
          <span className="flex items-center gap-2"><Tag size={15} />{cart.coupon.code} · {cart.coupon.description}</span>
          <button onClick={removeCoupon} aria-label="Remove discount code" className="rounded-full p-1 hover:bg-white/60"><X size={15} /></button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex gap-2">
          <label htmlFor="coupon" className="sr-only">Discount code</label>
          <input id="coupon" className="input !py-2 uppercase placeholder:normal-case" placeholder="Discount code" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn btn-sm shrink-0" disabled={busy || !code.trim()}>Apply</button>
        </form>
      )}
      {err && <p role="alert" className="mt-1 text-xs font-bold text-red-600">{err}</p>}
      {cart.couponError && !err && <p role="alert" className="mt-1 text-xs font-bold text-red-600">{cart.couponError}</p>}
    </div>
  );
}

export default function Cart() {
  const { cart, removeLine } = useShop();
  const empty = !cart || cart.lines.length === 0;

  return (
    <div className="container-x py-8">
      <h1 className="text-3xl font-bold">Shopping Cart</h1>
      {!cart ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]"><div className="skeleton h-64" /><div className="skeleton h-64" /></div>
      ) : empty ? (
        <div className="mt-6"><EmptyState title="Your cart is empty" text="Looks like you haven't added anything yet." action={<Link to="/shop" className="btn btn-sm">Continue shopping</Link>} /></div>
      ) : (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_360px]">
          <ul className="space-y-3">
            {cart.lines.map((l) => (
              <li key={l.id} className="card flex flex-wrap items-center gap-4 p-4">
                <LineThumb src={l.image} alt={l.name} size="h-24 w-24" />
                <div className="min-w-[160px] flex-1">
                  <Link to={`/shop/${l.slug}`} className="font-extrabold hover:text-primary">{l.name}</Link>
                  {l.variantName && <p className="text-xs text-choco-soft">{l.variantName}</p>}
                  <p className="mt-1 text-sm font-bold text-choco-soft">{formatPeso(l.unitPrice)} each</p>
                  {l.issue && <p className="mt-1 flex items-center gap-1 text-xs font-bold text-red-600"><AlertTriangle size={13} />{l.issue}</p>}
                </div>
                {l.quantity > 0 && <QtyStepper line={l} />}
                <div className="w-24 text-right text-lg font-extrabold">{formatPeso(l.lineTotal)}</div>
                <button onClick={() => removeLine(l.id)} aria-label={`Remove ${l.name}`} className="rounded-full p-2 text-choco-soft hover:bg-peach hover:text-red-600"><Trash2 size={18} /></button>
              </li>
            ))}
            <li><Link to="/shop" className="text-sm font-extrabold text-link hover:underline">← Continue shopping</Link></li>
          </ul>

          <aside className="card space-y-4 p-5 lg:sticky lg:top-24" aria-label="Order summary">
            <h2 className="text-xl font-semibold">Order Summary</h2>
            <CouponBox />
            <Totals cart={cart} shippingLabel="Shipping (standard)" />
            <FreeShippingHint cart={cart} />
            {cart.hasIssues && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">Some items changed. Please review the notes above.</p>}
            <Link to="/checkout" className={`btn w-full ${cart.itemCount === 0 ? 'pointer-events-none opacity-60' : ''}`} aria-disabled={cart.itemCount === 0}>Proceed to Checkout <ArrowRight size={16} /></Link>
            <p className="text-center text-xs text-choco-soft">Prices and totals are confirmed securely at checkout.</p>
          </aside>
        </div>
      )}
    </div>
  );
}
