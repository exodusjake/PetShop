import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Search, Truck } from 'lucide-react';
import { api, useApi } from '../../lib/api';
import type { AdminOrderDetail, AdminOrderRow, Paged, PaymentRow } from '../../lib/adminTypes';
import { formatDate, formatDateTime, formatPeso } from '../../lib/format';
import { useToast } from '../../context/Toast';
import { EmptyState } from '../../components/ui';
import { ConfirmationModal, LineThumb } from '../../components/cart';
import { DataTable, PageHeader, Pager, Pill, StatCard, useReload } from '../../components/dashboard';
import { Field, FormError, TextInput } from '../../components/forms';
import { CreditCard } from 'lucide-react';

const STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const NEXT_LABEL: Record<string, string> = { CONFIRMED: 'Confirm order', PROCESSING: 'Start processing', SHIPPED: 'Mark as shipped', DELIVERED: 'Mark as delivered', CANCELLED: 'Cancel order' };

export function OrdersAdmin() {
  const [q, setQ] = useState(''), [term, setTerm] = useState(''), [status, setStatus] = useState(''), [pay, setPay] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState(''), [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setTerm(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const qs = new URLSearchParams({ page: String(page) });
  if (term) qs.set('q', term); if (status) qs.set('status', status); if (pay) qs.set('paymentStatus', pay); if (from) qs.set('from', from); if (to) qs.set('to', to);
  const { data, loading } = useApi<Paged<AdminOrderRow>>(`/admin/orders?${qs}`);
  const reset = () => { setQ(''); setTerm(''); setStatus(''); setPay(''); setFrom(''); setTo(''); setPage(1); };

  return (
    <div>
      <PageHeader title="Orders" subtitle="Review, fulfil and track customer orders." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto]">
        <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-choco-soft" /><input className="input !pl-9" placeholder="Order no., name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" /></div>
        <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Order status"><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}</select>
        <select className="input" value={pay} onChange={(e) => { setPay(e.target.value); setPage(1); }} aria-label="Payment status"><option value="">All payments</option>{['UNPAID', 'PAID', 'FAILED', 'REFUNDED'].map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}</select>
        <input className="input" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label="From date" />
        <input className="input" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label="To date" />
        <button className="btn btn-ghost btn-sm" onClick={reset}>Clear</button>
      </div>
      <DataTable rows={data?.items ?? null} loading={loading} rowKey={(o) => o.orderNumber} empty="No orders match your filters."
        columns={[
          { header: 'Order', cell: (o) => <Link to={`/admin/orders/${o.orderNumber}`} className="font-extrabold text-link hover:underline">{o.orderNumber}</Link> },
          { header: 'Customer', cell: (o) => <div><p className="font-bold">{o.customer}</p><p className="text-xs text-choco-soft">{o.email}</p></div> },
          { header: 'Date', cell: (o) => <span className="whitespace-nowrap">{formatDate(o.createdAt)}</span> },
          { header: 'Items', cell: (o) => o.itemCount }, { header: 'Status', cell: (o) => <Pill value={o.status} /> }, { header: 'Payment', cell: (o) => <div><Pill value={o.paymentStatus} /><p className="mt-0.5 text-xs text-choco-soft">{o.paymentMethod}</p></div> },
          { header: 'Total', cell: (o) => <b>{formatPeso(o.total)}</b>, className: 'text-right' },
        ]} />
      {data && <Pager page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />}
    </div>
  );
}

export function OrderAdminDetail() {
  const { orderNumber } = useParams();
  const { toast } = useToast();
  const { reload, withKey } = useReload();
  const { data: o, error, loading } = useApi<AdminOrderDetail>(orderNumber ? withKey(`/admin/orders/${orderNumber}`) : null);
  const [confirm, setConfirm] = useState<{ title: string; body: string; run: () => Promise<unknown>; danger?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [carrier, setCarrier] = useState(''), [tracking, setTracking] = useState(''), [shipStatus, setShipStatus] = useState('IN_TRANSIT');
  const [shipErr, setShipErr] = useState<string | null>(null);
  const ship = o?.shipments[0];
  useEffect(() => { if (ship) { setCarrier(ship.carrier); setTracking(ship.trackingNumber ?? ''); setShipStatus(ship.status); } }, [ship?.id, ship?.status]);

  if (loading && !o) return <div className="skeleton h-96" />;
  if (error || !o) return <EmptyState title="Order not found" action={<Link to="/admin/orders" className="btn btn-sm">Back to orders</Link>} />;

  const run = async () => {
    if (!confirm) return; setBusy(true);
    try { await confirm.run(); toast('Order updated'); reload(); } catch (e) { toast((e as Error).message, 'error'); }
    setBusy(false); setConfirm(null);
  };
  const setStatus = (s: string) => setConfirm({
    title: `${NEXT_LABEL[s] ?? s}?`, danger: s === 'CANCELLED', body: s === 'CANCELLED' ? 'The items go back into stock and any discount code use is returned. This cannot be undone.' : `Order ${o.orderNumber} will be marked ${s.toLowerCase()}.`,
    run: () => api(`/admin/orders/${o.orderNumber}/status`, { method: 'PATCH', json: { status: s } }),
  });
  const saveShipment = async (e: React.FormEvent) => {
    e.preventDefault(); setShipErr(null);
    try { await api(`/admin/orders/${o.orderNumber}/shipment`, { method: 'POST', json: { carrier, trackingNumber: tracking, status: shipStatus } }); toast('Shipment saved'); reload(); } catch (ex) { setShipErr((ex as Error).message); }
  };

  return (
    <div className="space-y-5">
      <Link to="/admin/orders" className="text-sm font-extrabold text-link hover:underline">← All orders</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-3xl font-semibold">{o.orderNumber}</h1><p className="text-sm text-choco-soft">Placed {formatDateTime(o.createdAt)}{o.isDemo && ' · demo order'}</p></div>
        <div className="flex gap-2"><Pill value={o.status} /><Pill value={o.paymentStatus} /></div>
      </div>

      <section className="card p-5" aria-label="Fulfilment">
        <h2 className="mb-3 text-lg font-semibold">Fulfilment</h2>
        {o.allowedNext.length === 0 ? <p className="text-sm text-choco-soft">This order is {o.status.toLowerCase()}; no further changes are possible.</p> : (
          <div className="flex flex-wrap gap-2">{o.allowedNext.map((s) => <button key={s} className={`btn btn-sm ${s === 'CANCELLED' ? '!bg-red-600 hover:!bg-red-700' : ''}`} onClick={() => setStatus(s)}>{NEXT_LABEL[s] ?? s}</button>)}</div>
        )}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-peach pt-4">
          {o.canMarkPaid && <button className="btn btn-ghost btn-sm" onClick={() => setConfirm({ title: 'Record cash payment?', body: `Confirm that ${formatPeso(o.total)} was collected for this Cash on Delivery order.`, run: () => api(`/admin/orders/${o.orderNumber}/payment`, { method: 'POST', json: { action: 'MARK_PAID' } }) })}><CreditCard size={15} /> Mark COD as paid</button>}
          {o.canRefund && <button className="btn btn-ghost btn-sm" onClick={() => setConfirm({ title: 'Record a refund?', danger: true, body: `Mark ${formatPeso(o.total)} as refunded. Do this after the money has actually been returned to the customer.`, run: () => api(`/admin/orders/${o.orderNumber}/payment`, { method: 'POST', json: { action: 'REFUND' } }) })}>Record refund</button>}
          {!o.canMarkPaid && !o.canRefund && <p className="text-sm text-choco-soft">No payment actions available. {o.paymentMethod !== 'COD' && 'Online payments are confirmed by the payment provider only.'}</p>}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="card p-5" aria-label="Items">
          <h2 className="mb-2 text-lg font-semibold">Items</h2>
          <ul className="divide-y divide-peach">{o.items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-3"><LineThumb src={i.imageUrl} alt="" /><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-extrabold">{i.name}</p><p className="text-xs text-choco-soft">{formatPeso(i.unitPrice)} × {i.quantity}</p></div><b>{formatPeso(i.lineTotal)}</b></li>
          ))}</ul>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPeso(o.subtotal)}</dd></div>
            {o.discountTotal > 0 && <div className="flex justify-between text-green-700"><dt>Discount {o.couponCode && `(${o.couponCode})`}</dt><dd>−{formatPeso(o.discountTotal)}</dd></div>}
            <div className="flex justify-between"><dt>Shipping ({o.shippingMethod.toLowerCase()})</dt><dd>{o.shippingFee === 0 ? 'FREE' : formatPeso(o.shippingFee)}</dd></div>
            <div className="flex justify-between border-t border-peach pt-2 text-lg font-extrabold"><dt>Total</dt><dd className="text-primary">{formatPeso(o.total)}</dd></div>
          </dl>
        </section>

        <div className="space-y-5">
          <section className="card p-5 text-sm" aria-label="Customer and delivery">
            <h2 className="mb-2 text-lg font-semibold">Customer</h2>
            {o.customer ? <p><Link to="/admin/customers" className="font-extrabold text-link hover:underline">{o.customer.name}</Link><br />{o.customer.email}</p> : <p>{o.email}</p>}
            <h3 className="mb-1 mt-4 font-display text-base font-semibold">Ship to</h3>
            <p>{o.ship.name} · {o.ship.phone}<br />{o.ship.address}, {o.ship.barangay}<br />{o.ship.city}, {o.ship.province} {o.ship.postalCode}</p>
            {o.notes && <p className="mt-2 rounded-xl bg-beige p-2"><b>Notes:</b> {o.notes}</p>}
          </section>

          <section className="card p-5" aria-label="Shipment">
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold"><Truck size={18} className="text-primary" />Shipment</h2>
            <form onSubmit={saveShipment} className="space-y-3">
              <FormError message={shipErr} />
              <Field label="Courier" htmlFor="carrier"><TextInput id="carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="e.g. LBC, J&T, Grab Express" /></Field>
              <Field label="Tracking number" htmlFor="track"><TextInput id="track" value={tracking} onChange={(e) => setTracking(e.target.value)} /></Field>
              <Field label="Shipment status" htmlFor="sstat"><select id="sstat" className="input" value={shipStatus} onChange={(e) => setShipStatus(e.target.value)}><option value="PREPARING">Preparing</option><option value="IN_TRANSIT">In transit</option><option value="DELIVERED">Delivered</option></select></Field>
              <button className="btn btn-sm" disabled={o.status === 'CANCELLED'}>Save shipment</button>
              {ship?.shippedAt && <p className="text-xs text-choco-soft">Shipped {formatDateTime(ship.shippedAt)}{ship.deliveredAt && ` · delivered ${formatDateTime(ship.deliveredAt)}`}</p>}
            </form>
          </section>

          <section className="card p-5 text-sm" aria-label="Payments">
            <h2 className="mb-2 text-lg font-semibold">Payment records</h2>
            {o.payments.map((p) => <p key={p.id} className="flex items-center justify-between border-b border-peach/60 py-1.5 last:border-0"><span>{p.provider} · {formatPeso(p.amount)}</span><Pill value={p.status} /></p>)}
          </section>
        </div>
      </div>

      <ConfirmationModal open={!!confirm} title={confirm?.title ?? ''} confirmLabel="Confirm" cancelLabel="Back" danger={confirm?.danger} busy={busy} onConfirm={run} onClose={() => setConfirm(null)}>{confirm?.body}</ConfirmationModal>
    </div>
  );
}

export function PaymentsAdmin() {
  const [status, setStatus] = useState(''), [provider, setProvider] = useState(''), [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page: String(page) });
  if (status) qs.set('status', status); if (provider) qs.set('provider', provider);
  const { data, loading } = useApi<Paged<PaymentRow> & { totals: { paid: number; pending: number; refunded: number } }>(`/admin/payments?${qs}`);
  return (
    <div>
      <PageHeader title="Payments" subtitle="Every payment record. Online payments are confirmed by the provider only." />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Collected" value={formatPeso(data?.totals.paid ?? 0)} icon={<CreditCard />} tone="green" />
        <StatCard label="Awaiting payment" value={formatPeso(data?.totals.pending ?? 0)} icon={<CreditCard />} />
        <StatCard label="Refunded" value={formatPeso(data?.totals.refunded ?? 0)} icon={<CreditCard />} tone="blue" />
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <select className="input !w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Payment status"><option value="">All statuses</option>{['PENDING', 'PAID', 'FAILED', 'REFUNDED'].map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}</select>
        <select className="input !w-auto" value={provider} onChange={(e) => { setProvider(e.target.value); setPage(1); }} aria-label="Method"><option value="">All methods</option>{['COD', 'GCASH', 'MAYA', 'CARD'].map((s) => <option key={s} value={s}>{s}</option>)}</select>
      </div>
      <DataTable rows={data?.items ?? null} loading={loading} rowKey={(p) => p.id} empty="No payments yet."
        columns={[
          { header: 'Order', cell: (p) => <Link to={`/admin/orders/${p.orderNumber}`} className="font-extrabold text-link hover:underline">{p.orderNumber}</Link> },
          { header: 'Customer', cell: (p) => <div><p className="font-bold">{p.customer}</p><p className="text-xs text-choco-soft">{p.email}</p></div> },
          { header: 'Method', cell: (p) => p.provider }, { header: 'Status', cell: (p) => <Pill value={p.status} /> },
          { header: 'Paid at', cell: (p) => (p.paidAt ? formatDateTime(p.paidAt) : '—') }, { header: 'Amount', cell: (p) => <b>{formatPeso(p.amount)}</b>, className: 'text-right' },
        ]} />
      {data && <Pager page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />}
    </div>
  );
}
