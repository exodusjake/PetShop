import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Package, Truck } from 'lucide-react';
import { api, useApi } from '../lib/api';
import type { Order } from '../lib/types';
import { formatDate, formatPeso } from '../lib/format';
import { useToast } from '../context/Toast';
import { EmptyState } from '../components/ui';
import { ConfirmationModal, LineThumb } from '../components/cart';

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800', CONFIRMED: 'bg-blue-100 text-blue-800', PROCESSING: 'bg-indigo-100 text-indigo-800',
  SHIPPED: 'bg-purple-100 text-purple-800', DELIVERED: 'bg-green-100 text-green-800', CANCELLED: 'bg-gray-200 text-gray-700',
};
const PAY_STYLE: Record<string, string> = { UNPAID: 'bg-orange-100 text-orange-800', PAID: 'bg-green-100 text-green-800', FAILED: 'bg-gray-200 text-gray-700', REFUNDED: 'bg-blue-100 text-blue-800' };
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const METHOD: Record<string, string> = { COD: 'Cash on Delivery', GCASH: 'GCash', MAYA: 'Maya', CARD: 'Card' };

export const Badge = ({ text, cls }: { text: string; cls: string }) => <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${cls}`}>{label(text)}</span>;
const range = (o: Order) => o.estimatedDelivery ? `${formatDate(o.estimatedDelivery.from)} – ${formatDate(o.estimatedDelivery.to)}` : null;

function Items({ o }: { o: Order }) {
  return (
    <ul className="divide-y divide-peach">
      {o.items.map((i) => (
        <li key={i.id} className="flex items-center gap-3 py-3">
          <LineThumb src={i.imageUrl} alt="" />
          <div className="min-w-0 flex-1"><Link to={`/shop?q=${encodeURIComponent(i.name.split(' (')[0])}`} className="line-clamp-2 text-sm font-extrabold hover:text-primary">{i.name}</Link><p className="text-xs text-choco-soft">{formatPeso(i.unitPrice)} × {i.quantity}</p></div>
          <span className="font-extrabold">{formatPeso(i.lineTotal)}</span>
        </li>
      ))}
    </ul>
  );
}

function Money({ o }: { o: Order }) {
  const row = 'flex justify-between text-sm';
  return (
    <dl className="space-y-2">
      <div className={row}><dt>Subtotal</dt><dd className="font-bold">{formatPeso(o.subtotal)}</dd></div>
      {o.discountTotal > 0 && <div className={`${row} text-green-700`}><dt>Discount {o.couponCode && `(${o.couponCode})`}</dt><dd className="font-bold">−{formatPeso(o.discountTotal)}</dd></div>}
      <div className={row}><dt>Shipping</dt><dd className="font-bold">{o.shippingFee === 0 ? 'FREE' : formatPeso(o.shippingFee)}</dd></div>
      <div className="flex justify-between border-t border-peach pt-3 text-lg font-extrabold"><dt>Total</dt><dd className="text-primary">{formatPeso(o.total)}</dd></div>
    </dl>
  );
}

export function OrderConfirmation() {
  const { orderId } = useParams(); // the route param carries the order number
  const { data: o, error, loading } = useApi<Order>(orderId ? `/orders/${orderId}` : null);
  if (loading) return <div className="container-x py-12"><div className="skeleton h-72" /></div>;
  if (error || !o) return <div className="container-x py-12"><EmptyState title="Order not found" text="We couldn't find that order on your account." action={<Link to="/account/orders" className="btn btn-sm">My orders</Link>} /></div>;
  return (
    <div className="container-x max-w-3xl py-10">
      <div className="text-center">
        <CheckCircle2 size={64} className="mx-auto text-green-600" />
        <h1 className="mt-3 text-3xl font-bold">Thank you for your order!</h1>
        <p className="mt-1 text-choco-soft">We've received your order and will start preparing it soon.</p>
      </div>
      <div className="card mt-6 space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-extrabold uppercase tracking-wide text-choco-soft">Order number</p><p className="font-display text-2xl font-semibold">{o.orderNumber}</p></div>
          <div className="flex gap-2"><Badge text={o.status} cls={STATUS_STYLE[o.status]} /><Badge text={o.paymentStatus} cls={PAY_STYLE[o.paymentStatus]} /></div>
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-2xl bg-beige p-4"><p className="font-extrabold">Payment</p><p>{METHOD[o.paymentMethod]}</p><p className="text-choco-soft">{o.paymentMethod === 'COD' ? `Pay ${formatPeso(o.total)} when it arrives` : ''}</p></div>
          <div className="rounded-2xl bg-beige p-4"><p className="font-extrabold">Estimated delivery</p><p>{range(o) ?? 'Pending'}</p></div>
          <div className="rounded-2xl bg-beige p-4"><p className="font-extrabold">Ship to</p><p>{o.ship.name}</p><p className="text-choco-soft">{o.ship.address}, {o.ship.barangay}, {o.ship.city}</p></div>
        </div>
        <Items o={o} />
        <Money o={o} />
        <div className="flex flex-wrap gap-3 pt-2">
          <Link to={`/account/orders/${o.orderNumber}`} className="btn"><Truck size={16} /> Track Order</Link>
          <Link to="/shop" className="btn btn-ghost">Continue shopping</Link>
        </div>
      </div>
    </div>
  );
}

export function OrdersPage() {
  const { data, error, loading } = useApi<Order[]>('/orders');
  return (
    <div>
      <h1 className="mb-1 text-3xl font-bold">My Orders</h1>
      <p className="mb-5 text-sm text-choco-soft">Track and manage your purchases.</p>
      {loading && <div className="space-y-3"><div className="skeleton h-28" /><div className="skeleton h-28" /></div>}
      {error && <EmptyState title="Couldn't load your orders" text={error} />}
      {data?.length === 0 && <EmptyState title="No orders yet" text="When you place an order it will show up here." action={<Link to="/shop" className="btn btn-sm">Start shopping</Link>} />}
      <ul className="space-y-3">
        {data?.map((o) => (
          <li key={o.orderNumber} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><Link to={`/account/orders/${o.orderNumber}`} className="font-display text-lg font-semibold hover:text-primary">{o.orderNumber}</Link><p className="text-xs text-choco-soft">{formatDate(o.createdAt)}{o.isDemo && ' · demo order'}</p></div>
              <div className="flex gap-2"><Badge text={o.status} cls={STATUS_STYLE[o.status]} /><Badge text={o.paymentStatus} cls={PAY_STYLE[o.paymentStatus]} /></div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex -space-x-2">{o.items.slice(0, 4).map((i) => <LineThumb key={i.id} src={i.imageUrl} alt="" size="h-12 w-12 ring-2 ring-white" />)}</div>
              <div className="text-right"><p className="text-xs text-choco-soft">{o.items.reduce((s, i) => s + i.quantity, 0)} item(s)</p><p className="text-lg font-extrabold">{formatPeso(o.total)}</p></div>
              <Link to={`/account/orders/${o.orderNumber}`} className="btn btn-ghost btn-sm">View Details</Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const FLOW = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

export function OrderDetailPage() {
  const { orderId } = useParams();
  const { toast } = useToast();
  const { data, error, loading } = useApi<Order>(orderId ? `/orders/${orderId}` : null);
  const [updated, setUpdated] = useState<Order | null>(null);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const o = updated ?? data;

  if (loading) return <div className="skeleton h-80" />;
  if (error || !o) return <EmptyState title="Order not found" text="We couldn't find that order on your account." action={<Link to="/account/orders" className="btn btn-sm">Back to orders</Link>} />;

  const cancel = async () => {
    setBusy(true);
    try { setUpdated(await api<Order>(`/orders/${o.orderNumber}/cancel`, { method: 'POST', json: {} })); toast('Order cancelled'); setAsk(false); }
    catch (e) { toast((e as Error).message, 'error'); setAsk(false); }
    setBusy(false);
  };
  const idx = FLOW.indexOf(o.status as (typeof FLOW)[number]);

  return (
    <div className="space-y-5">
      <Link to="/account/orders" className="text-sm font-extrabold text-link hover:underline">← All orders</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-3xl font-semibold">{o.orderNumber}</h1><p className="text-sm text-choco-soft">Placed {formatDate(o.createdAt)}{o.isDemo && ' · demo order'}</p></div>
        <div className="flex gap-2"><Badge text={o.status} cls={STATUS_STYLE[o.status]} /><Badge text={o.paymentStatus} cls={PAY_STYLE[o.paymentStatus]} /></div>
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-lg font-semibold">Order status</h2>
        {o.status === 'CANCELLED' ? <p className="text-sm font-bold text-choco-soft">This order was cancelled.</p> : (
          <ol className="flex items-start justify-between gap-1">
            {FLOW.map((s, i) => (
              <li key={s} className="flex flex-1 flex-col items-center text-center">
                <span className={`grid h-9 w-9 place-items-center rounded-full ${i <= idx ? 'bg-primary text-white' : 'bg-peach text-choco-soft'}`}>{i < idx ? <CheckCircle2 size={18} /> : <Package size={16} />}</span>
                <span className={`mt-1.5 text-[11px] font-extrabold sm:text-xs ${i <= idx ? '' : 'text-choco-soft'}`}>{label(s)}</span>
              </li>
            ))}
          </ol>
        )}
        {range(o) && <p className="mt-4 text-sm"><b>Estimated delivery:</b> {range(o)}</p>}
        {o.shipments.map((s, i) => (
          <p key={i} className="mt-2 rounded-xl bg-beige px-3 py-2 text-sm"><Truck size={14} className="mr-1 inline text-primary" /> <b>{s.carrier}</b>{s.trackingNumber && <> · Tracking no. <b>{s.trackingNumber}</b></>} · {label(s.status.replace('_', ' '))}</p>
        ))}
      </div>

      <div className="card p-5"><h2 className="mb-2 text-lg font-semibold">Items</h2><Items o={o} /><div className="mt-3"><Money o={o} /></div></div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5 text-sm"><h2 className="mb-2 text-lg font-semibold">Shipping address</h2><p className="font-bold">{o.ship.name}</p><p>{o.ship.address}</p><p>{o.ship.barangay}, {o.ship.city}</p><p>{o.ship.province} {o.ship.postalCode}</p><p>{o.ship.phone}</p>{o.notes && <p className="mt-2 text-choco-soft">Notes: {o.notes}</p>}</div>
        <div className="card p-5 text-sm"><h2 className="mb-2 text-lg font-semibold">Payment</h2><p>{METHOD[o.paymentMethod]}</p><p className="text-choco-soft">{o.paymentMethod === 'COD' && o.paymentStatus === 'UNPAID' ? `Pay ${formatPeso(o.total)} on delivery.` : label(o.paymentStatus)}</p><p className="mt-2 text-choco-soft">Receipts go to {o.email}</p></div>
      </div>

      {o.canCancel && <button className="btn btn-ghost !border-red-300 !text-red-700 hover:!bg-red-50" onClick={() => setAsk(true)}>Cancel Order</button>}
      <ConfirmationModal open={ask} title="Cancel this order?" confirmLabel="Yes, cancel order" danger busy={busy} onConfirm={cancel} onClose={() => setAsk(false)}>
        Order <b>{o.orderNumber}</b> will be cancelled and its items returned to stock. This can't be undone.
      </ConfirmationModal>
    </div>
  );
}
