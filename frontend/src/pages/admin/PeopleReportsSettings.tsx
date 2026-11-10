import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Loader2, Search } from 'lucide-react';
import { api, useApi } from '../../lib/api';
import type { CustomerDetail, CustomerRow, Paged } from '../../lib/adminTypes';
import { formatDate, formatPeso } from '../../lib/format';
import { useToast } from '../../context/Toast';
import { ConfirmationModal } from '../../components/cart';
import { DataTable, Modal, PageHeader, Pager, Pill, useReload } from '../../components/dashboard';
import { Field, FormError, TextInput } from '../../components/forms';

// ───────────── customers ─────────────
export function Customers() {
  const { toast } = useToast();
  const { reload, withKey } = useReload();
  const [q, setQ] = useState(''), [term, setTerm] = useState(''), [page, setPage] = useState(1), [open, setOpen] = useState<number | null>(null);
  const [toggle, setToggle] = useState<CustomerRow | CustomerDetail | null>(null);
  useEffect(() => { const t = setTimeout(() => { setTerm(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const { data, loading } = useApi<Paged<CustomerRow>>(withKey(`/admin/customers?page=${page}${term ? `&q=${encodeURIComponent(term)}` : ''}`));
  const detail = useApi<CustomerDetail>(open ? withKey(`/admin/customers/${open}`) : null).data;

  const doToggle = async () => {
    const c = toggle!; setToggle(null);
    try { await api(`/admin/customers/${c.id}/status`, { method: 'PATCH', json: { status: c.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' } }); toast(c.status === 'ACTIVE' ? 'Account suspended' : 'Account reactivated'); reload(); }
    catch (e) { toast((e as Error).message, 'error'); }
  };

  return (
    <div>
      <PageHeader title="Customers" subtitle="Find customers, see their orders and manage account access." />
      <div className="relative mb-4 max-w-md"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-choco-soft" /><input className="input !pl-9" placeholder="Search by name or email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" /></div>
      <DataTable rows={data?.items ?? null} loading={loading} rowKey={(c) => c.id} empty="No customers found."
        columns={[
          { header: 'Customer', cell: (c) => <button className="text-left" onClick={() => setOpen(c.id)}><p className="font-extrabold text-link hover:underline">{c.name}{c.isDemo && <span className="ml-2 text-xs font-bold text-choco-soft">(demo)</span>}</p><p className="text-xs text-choco-soft">{c.email}</p></button> },
          { header: 'Joined', cell: (c) => formatDate(c.joinedAt) }, { header: 'Orders', cell: (c) => c.orders }, { header: 'Total spent', cell: (c) => <b>{formatPeso(c.totalSpent)}</b> },
          { header: 'Status', cell: (c) => <Pill value={c.status} /> },
          { header: '', className: 'text-right', cell: (c) => <button className={`btn btn-sm ${c.status === 'ACTIVE' ? 'btn-ghost !border-red-300 !text-red-700' : ''}`} onClick={() => setToggle(c)}>{c.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}</button> },
        ]} />
      {data && <Pager page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />}

      <Modal open={open !== null} title="Customer details" onClose={() => setOpen(null)} wide>
        {!detail ? <div className="skeleton h-40" /> : (
          <div className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-beige p-4"><p className="text-lg font-extrabold">{detail.name}</p><p>{detail.email}</p><p>{detail.phone || 'No phone on file'}</p><p className="mt-1 text-choco-soft">Joined {formatDate(detail.joinedAt)}</p></div>
              <div className="rounded-2xl bg-beige p-4"><p><b>{detail.orders.length}</b> recent order(s)</p><p><b>{detail.pets}</b> registered pet(s)</p><p><b>{detail.wishlistItems}</b> wishlist item(s)</p><p className="mt-1"><Pill value={detail.status} /></p></div>
            </div>
            <DataTable rows={detail.orders} rowKey={(o) => o.orderNumber} empty="No orders yet."
              columns={[{ header: 'Order', cell: (o) => <Link to={`/admin/orders/${o.orderNumber}`} className="font-extrabold text-link hover:underline">{o.orderNumber}</Link> }, { header: 'Date', cell: (o) => formatDate(o.createdAt) }, { header: 'Status', cell: (o) => <Pill value={o.status} /> }, { header: 'Total', cell: (o) => <b>{formatPeso(o.total)}</b>, className: 'text-right' }]} />
          </div>
        )}
      </Modal>
      <ConfirmationModal open={!!toggle} title={toggle?.status === 'ACTIVE' ? 'Suspend this account?' : 'Reactivate this account?'} confirmLabel={toggle?.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'} cancelLabel="Cancel" danger={toggle?.status === 'ACTIVE'} onConfirm={doToggle} onClose={() => setToggle(null)}>
        {toggle?.status === 'ACTIVE' ? <><b>{toggle?.name}</b> will be signed out everywhere and won't be able to log in until reactivated.</> : <><b>{toggle?.name}</b> will be able to log in again.</>}
      </ConfirmationModal>
    </div>
  );
}

// ───────────── reports ─────────────
const REPORTS = [['sales', 'Sales'], ['orders', 'Orders'], ['products', 'Products'], ['inventory', 'Inventory'], ['customers', 'Customers']] as const;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function Reports() {
  const today = new Date(), monthAgo = new Date(Date.now() - 29 * 864e5);
  const [type, setType] = useState<(typeof REPORTS)[number][0]>('sales');
  const [from, setFrom] = useState(iso(monthAgo)), [to, setTo] = useState(iso(today));
  const qs = `from=${from}&to=${to}`;
  const { data, error, loading } = useApi<{ headers: string[]; rows: (string | number | null)[][] }>(`/admin/reports/${type}?${qs}`);
  const usesDates = type !== 'inventory';
  const preview = data?.rows.slice(0, 200) ?? null;

  return (
    <div>
      <PageHeader title="Reports" subtitle="Filter by date, preview the data, then export it as CSV." actions={
        <a className="btn btn-sm" href={`/api/admin/reports/${type}?${qs}&format=csv`} download><Download size={15} /> Export CSV</a>} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Report type">
          {REPORTS.map(([k, l]) => <button key={k} role="tab" aria-selected={type === k} onClick={() => setType(k)} className={`rounded-full px-4 py-2 text-sm font-extrabold ${type === k ? 'bg-primary text-white' : 'bg-white shadow-soft hover:bg-peach'}`}>{l}</button>)}
        </div>
        {usesDates && <div className="ml-auto flex items-center gap-2">
          <label className="text-sm font-bold">From <input type="date" className="input !w-auto" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="text-sm font-bold">To <input type="date" className="input !w-auto" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
        </div>}
      </div>
      {error && <FormError message={error} />}
      {loading && !data && <div className="skeleton h-64" />}
      {data && (
        <>
          <p className="mb-2 text-sm text-choco-soft">{data.rows.length} row{data.rows.length === 1 ? '' : 's'}{data.rows.length > 200 && ' (preview shows the first 200; the CSV has everything)'}</p>
          <div className="card relative overflow-x-auto" tabIndex={0} role="region" aria-label={`${type} report (scrollable)`}><table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="border-b border-peach text-xs font-extrabold uppercase tracking-wide text-choco-soft">{data.headers.map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
            <tbody>{preview?.length === 0 && <tr><td colSpan={data.headers.length} className="px-4 py-10 text-center text-choco-soft">No data for this period.</td></tr>}
              {preview?.map((r, i) => <tr key={i} className="border-b border-peach/60 last:border-0">{r.map((c, j) => <td key={j} className="whitespace-nowrap px-4 py-2.5">{c ?? ''}</td>)}</tr>)}</tbody></table></div>
        </>
      )}
    </div>
  );
}

// ───────────── store settings ─────────────
const GROUPS: { title: string; fields: [string, string, string?][] }[] = [
  { title: 'Store', fields: [['store_name', 'Store name'], ['tagline', 'Tagline']] },
  { title: 'Contact details (shown in the footer)', fields: [['contact_email', 'Email'], ['contact_phone', 'Phone'], ['contact_address', 'Address'], ['business_hours', 'Business hours']] },
  { title: 'Social links (https://…)', fields: [['social_facebook', 'Facebook'], ['social_instagram', 'Instagram'], ['social_tiktok', 'TikTok'], ['social_youtube', 'YouTube']] },
  { title: 'Shipping (₱)', fields: [['shipping_standard_fee', 'Standard delivery fee'], ['shipping_express_fee', 'Express delivery fee'], ['free_shipping_over', 'Free standard shipping over', 'Set to 0 to disable free shipping']] },
];

export function SettingsAdmin() {
  const { toast } = useToast();
  const { data } = useApi<Record<string, string>>('/admin/settings');
  const [v, setV] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  useEffect(() => { if (data) setV(data); }, [data]);
  if (!data) return <div className="skeleton h-96" />;

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErrs({});
    try { await api('/admin/settings', { method: 'PUT', json: v }); toast('Settings saved'); }
    catch (ex) {
      const issues = (ex as { issues?: Record<string, string[]> }).issues ?? {};
      setErrs(Object.fromEntries(Object.entries(issues).map(([k, m]) => [k, m[0]])));
      toast((ex as Error).message, 'error');
    }
    setBusy(false);
  };

  return (
    <form onSubmit={save} noValidate className="max-w-3xl space-y-5">
      <PageHeader title="Settings" subtitle="These appear on your storefront. Nothing is shown publicly until you fill it in." />
      {GROUPS.map((g) => (
        <section key={g.title} className="card space-y-4 p-6">
          <h2 className="text-lg font-semibold">{g.title}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {g.fields.map(([k, label, hint]) => (
              <Field key={k} label={label} htmlFor={k} error={errs[k]} hint={hint}><TextInput id={k} value={v[k] ?? ''} invalid={!!errs[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>
            ))}
          </div>
        </section>
      ))}
      <button className="btn" disabled={busy}>{busy ? <Loader2 size={18} className="animate-spin" /> : 'Save settings'}</button>
    </form>
  );
}
