import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Mail, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react';
import { ApiError, api, useApi } from '../../lib/api';
import type { Paged } from '../../lib/adminTypes';
import { formatDate, formatDateTime, formatPeso } from '../../lib/format';
import { useToast } from '../../context/Toast';
import { ConfirmationModal } from '../../components/cart';
import { DataTable, Modal, PageHeader, Pager, Pill, useReload } from '../../components/dashboard';
import { Field, FormError, TextInput } from '../../components/forms';

// ───────────── reviews ─────────────
interface ReviewRow { id: number; product: { name: string; slug: string }; author: string; rating: number; title: string | null; body: string; status: string; isDemo: boolean; verified: boolean; createdAt: string }

export function ReviewsAdmin() {
  const { toast } = useToast();
  const { reload, withKey } = useReload();
  const [q, setQ] = useState(''), [term, setTerm] = useState(''), [status, setStatus] = useState(''), [page, setPage] = useState(1), [del, setDel] = useState<ReviewRow | null>(null);
  useEffect(() => { const t = setTimeout(() => { setTerm(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const { data, loading } = useApi<Paged<ReviewRow>>(withKey(`/admin/reviews?page=${page}${status ? `&status=${status}` : ''}${term ? `&q=${encodeURIComponent(term)}` : ''}`));
  const setSt = async (r: ReviewRow, s: string) => { try { await api(`/admin/reviews/${r.id}`, { method: 'PATCH', json: { status: s } }); toast(s === 'HIDDEN' ? 'Review hidden' : 'Review published'); reload(); } catch (e) { toast((e as Error).message, 'error'); } };

  return (
    <div>
      <PageHeader title="Reviews" subtitle="Moderate customer reviews. Hiding a review removes it from the shop and updates the product's rating." />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-choco-soft" /><input className="input !pl-9" placeholder="Search reviews, authors or products…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search reviews" /></div>
        <select className="input !w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status"><option value="">All</option><option value="PUBLISHED">Published</option><option value="HIDDEN">Hidden</option></select>
      </div>
      <DataTable rows={data?.items ?? null} loading={loading} rowKey={(r) => r.id} empty="No reviews found."
        columns={[
          { header: 'Review', className: 'max-w-md', cell: (r) => (
            <div><p className="flex items-center gap-1 text-[#F5A623]">{Array.from({ length: 5 }, (_, i) => <Star key={i} size={13} fill={i < r.rating ? 'currentColor' : 'none'} />)}<span className="ml-2 text-xs font-bold text-choco-soft">{r.author}</span></p>
              {r.title && <p className="font-extrabold">{r.title}</p>}<p className="line-clamp-2 text-sm">{r.body}</p></div>) },
          { header: 'Product', cell: (r) => <Link to={`/shop/${r.product.slug}`} className="font-bold text-link hover:underline">{r.product.name}</Link> },
          { header: 'Type', cell: (r) => <div className="flex flex-wrap gap-1">{r.verified && <Pill value="PAID" label="Verified" />}{r.isDemo && <Pill value="DRAFT" label="Demo" />}</div> },
          { header: 'Date', cell: (r) => formatDate(r.createdAt) }, { header: 'Status', cell: (r) => <Pill value={r.status} /> },
          { header: 'Actions', className: 'text-right', cell: (r) => (
            <div className="flex justify-end gap-1">
              {r.status === 'PUBLISHED' ? <button className="rounded-full p-2 hover:bg-peach" aria-label="Hide review" onClick={() => setSt(r, 'HIDDEN')}><EyeOff size={16} /></button> : <button className="rounded-full p-2 hover:bg-peach" aria-label="Publish review" onClick={() => setSt(r, 'PUBLISHED')}><Eye size={16} /></button>}
              <button className="rounded-full p-2 text-red-600 hover:bg-red-50" aria-label="Delete review" onClick={() => setDel(r)}><Trash2 size={16} /></button>
            </div>) },
        ]} />
      {data && <Pager page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />}
      <ConfirmationModal open={!!del} title="Delete this review?" confirmLabel="Delete" cancelLabel="Keep" danger onClose={() => setDel(null)}
        onConfirm={async () => { const r = del!; setDel(null); try { await api(`/admin/reviews/${r.id}`, { method: 'DELETE' }); toast('Review deleted'); reload(); } catch (e) { toast((e as Error).message, 'error'); } }}>
        This permanently deletes the review. To remove it from the shop but keep it, hide it instead.
      </ConfirmationModal>
    </div>
  );
}

// ───────────── promotions ─────────────
interface Coupon { id: number; code: string; type: 'PERCENT' | 'FIXED'; value: number; minSubtotal: number; startsAt: string | null; expiresAt: string | null; usageLimit: number | null; usedCount: number; isActive: boolean; state: string }
const toDate = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
const num = (v: string) => (v.trim() === '' ? null : Number(v));

function CouponForm({ coupon, onSaved, onClose }: { coupon: Coupon | null; onSaved: () => void; onClose: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({ code: coupon?.code ?? '', type: coupon?.type ?? 'PERCENT', value: String(coupon?.value ?? ''), minSubtotal: String(coupon?.minSubtotal ?? 0), startsAt: toDate(coupon?.startsAt ?? null), expiresAt: toDate(coupon?.expiresAt ?? null), usageLimit: coupon?.usageLimit != null ? String(coupon.usageLimit) : '', isActive: coupon?.isActive ?? true });
  const [err, setErr] = useState<string | null>(null), [fe, setFe] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false);
  const set = (k: string, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null); setFe({});
    const body = { ...(coupon ? {} : { code: f.code }), type: f.type, value: num(f.value) ?? 0, minSubtotal: num(f.minSubtotal) ?? 0, startsAt: f.startsAt ? new Date(`${f.startsAt}T00:00:00`).toISOString() : null, expiresAt: f.expiresAt ? new Date(`${f.expiresAt}T23:59:59`).toISOString() : null, usageLimit: num(f.usageLimit), isActive: f.isActive };
    try { await api(coupon ? `/admin/coupons/${coupon.id}` : '/admin/coupons', { method: coupon ? 'PATCH' : 'POST', json: body }); toast('Saved'); onSaved(); }
    catch (ex) { if (ex instanceof ApiError) { setFe(Object.fromEntries(Object.entries(ex.issues).map(([k, m]) => [k, m[0]]))); setErr(ex.message); } else setErr('Something went wrong.'); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <FormError message={err} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Code" htmlFor="cp-code" error={fe.code} hint={coupon ? 'The code can\'t be changed.' : 'Letters, numbers, - or _ (saved in capitals)'}><TextInput id="cp-code" value={f.code} onChange={(e) => set('code', e.target.value)} disabled={!!coupon} invalid={!!fe.code} placeholder="SUMMER15" /></Field>
        <Field label="Type" htmlFor="cp-type"><select id="cp-type" className="input" value={f.type} onChange={(e) => set('type', e.target.value)}><option value="PERCENT">Percentage off</option><option value="FIXED">Fixed amount off (₱)</option></select></Field>
        <Field label={f.type === 'PERCENT' ? 'Discount (%)' : 'Discount (₱)'} htmlFor="cp-val" error={fe.value}><TextInput id="cp-val" type="number" min="0" step="0.01" value={f.value} onChange={(e) => set('value', e.target.value)} invalid={!!fe.value} /></Field>
        <Field label="Minimum spend (₱)" htmlFor="cp-min" error={fe.minSubtotal}><TextInput id="cp-min" type="number" min="0" value={f.minSubtotal} onChange={(e) => set('minSubtotal', e.target.value)} /></Field>
        <Field label="Starts" htmlFor="cp-start" hint="Optional"><TextInput id="cp-start" type="date" value={f.startsAt} onChange={(e) => set('startsAt', e.target.value)} /></Field>
        <Field label="Expires" htmlFor="cp-end" hint="Optional"><TextInput id="cp-end" type="date" value={f.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} /></Field>
        <Field label="Usage limit" htmlFor="cp-limit" error={fe.usageLimit} hint="Leave empty for unlimited"><TextInput id="cp-limit" type="number" min="1" value={f.usageLimit} onChange={(e) => set('usageLimit', e.target.value)} invalid={!!fe.usageLimit} /></Field>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm font-bold"><input type="checkbox" className="accent-primary" checked={f.isActive} onChange={(e) => set('isActive', e.target.checked)} />Enabled</label>
      <div className="flex justify-end gap-3"><button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-sm" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : 'Save code'}</button></div>
    </form>
  );
}

export function PromotionsAdmin() {
  const { toast } = useToast();
  const { reload, withKey } = useReload();
  const { data } = useApi<Coupon[]>(withKey('/admin/coupons'));
  const [edit, setEdit] = useState<Coupon | 'new' | null>(null), [del, setDel] = useState<Coupon | null>(null);
  const toggle = async (c: Coupon) => {
    try { await api(`/admin/coupons/${c.id}`, { method: 'PATCH', json: { type: c.type, value: c.value, minSubtotal: c.minSubtotal, startsAt: c.startsAt, expiresAt: c.expiresAt, usageLimit: c.usageLimit, isActive: !c.isActive } }); toast(c.isActive ? 'Code disabled' : 'Code enabled'); reload(); } catch (e) { toast((e as Error).message, 'error'); }
  };
  return (
    <div>
      <PageHeader title="Promotions" subtitle="Discount codes shoppers can enter at the cart. Sale prices are set on each product." actions={<button className="btn btn-sm" onClick={() => setEdit('new')}><Plus size={16} /> New code</button>} />
      <DataTable rows={data ?? null} rowKey={(c) => c.id} empty="No discount codes yet."
        columns={[
          { header: 'Code', cell: (c) => <b className="font-mono">{c.code}</b> },
          { header: 'Discount', cell: (c) => <span className="font-bold">{c.type === 'PERCENT' ? `${c.value}% off` : `${formatPeso(c.value)} off`}{c.minSubtotal > 0 && <span className="block text-xs font-normal text-choco-soft">min. spend {formatPeso(c.minSubtotal)}</span>}</span> },
          { header: 'Valid', cell: (c) => <span className="whitespace-nowrap text-xs">{c.startsAt ? formatDate(c.startsAt) : 'Now'} → {c.expiresAt ? formatDate(c.expiresAt) : 'No end'}</span> },
          { header: 'Used', cell: (c) => `${c.usedCount}${c.usageLimit != null ? ` / ${c.usageLimit}` : ''}` }, { header: 'Status', cell: (c) => <Pill value={c.state} /> },
          { header: 'Actions', className: 'text-right', cell: (c) => (
            <div className="flex justify-end gap-1">
              <button className="btn btn-ghost btn-sm" onClick={() => toggle(c)}>{c.isActive ? 'Disable' : 'Enable'}</button>
              <button className="rounded-full p-2 hover:bg-peach" aria-label={`Edit ${c.code}`} onClick={() => setEdit(c)}><Pencil size={16} /></button>
              <button className="rounded-full p-2 text-red-600 hover:bg-red-50" aria-label={`Delete ${c.code}`} onClick={() => setDel(c)}><Trash2 size={16} /></button>
            </div>) },
        ]} />
      <Modal open={edit !== null} title={edit === 'new' ? 'New discount code' : `Edit ${(edit as Coupon | null)?.code ?? ''}`} onClose={() => setEdit(null)} wide>
        {edit !== null && <CouponForm key={edit === 'new' ? 'new' : edit.id} coupon={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
      </Modal>
      <ConfirmationModal open={!!del} title={`Delete ${del?.code}?`} confirmLabel="Delete" cancelLabel="Keep" danger onClose={() => setDel(null)}
        onConfirm={async () => { const c = del!; setDel(null); try { await api(`/admin/coupons/${c.id}`, { method: 'DELETE' }); toast('Code deleted'); reload(); } catch (e) { toast((e as Error).message, 'error'); } }}>
        Codes that customers have already used can't be deleted. Disable them instead.
      </ConfirmationModal>
    </div>
  );
}

// ───────────── messages ─────────────
interface Msg { id: number; name: string; email: string; subject: string; message: string; read: boolean; createdAt: string }

export function MessagesAdmin() {
  const { toast } = useToast();
  const { reload, withKey } = useReload();
  const [unread, setUnread] = useState(false), [page, setPage] = useState(1), [open, setOpen] = useState<Msg | null>(null), [del, setDel] = useState<Msg | null>(null);
  const { data, loading } = useApi<Paged<Msg> & { unread: number }>(withKey(`/admin/messages?page=${page}${unread ? '&unread=true' : ''}`));
  const mark = async (m: Msg, read: boolean) => { try { await api(`/admin/messages/${m.id}`, { method: 'PATCH', json: { read } }); reload(); } catch (e) { toast((e as Error).message, 'error'); } };
  const view = (m: Msg) => { setOpen(m); if (!m.read) mark(m, true); };

  return (
    <div>
      <PageHeader title="Messages" subtitle="Messages from the contact form." />
      <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm font-bold"><input type="checkbox" className="accent-primary" checked={unread} onChange={(e) => { setUnread(e.target.checked); setPage(1); }} />Unread only{data ? ` (${data.unread})` : ''}</label>
      <DataTable rows={data?.items ?? null} loading={loading} rowKey={(m) => m.id} empty="No messages."
        columns={[
          { header: 'From', cell: (m) => <button className="text-left" onClick={() => view(m)}><p className={`${m.read ? 'font-bold' : 'font-extrabold'}`}>{!m.read && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-primary" aria-label="Unread" />}{m.name}</p><p className="text-xs text-choco-soft">{m.email}</p></button> },
          { header: 'Subject', cell: (m) => <button className={`text-left ${m.read ? '' : 'font-extrabold'}`} onClick={() => view(m)}>{m.subject}<span className="block max-w-xs truncate text-xs font-normal text-choco-soft">{m.message}</span></button> },
          { header: 'Received', cell: (m) => <span className="whitespace-nowrap">{formatDateTime(m.createdAt)}</span> }, { header: 'Status', cell: (m) => <Pill value={m.read ? 'READ' : 'PENDING'} label={m.read ? 'Read' : 'New'} /> },
          { header: '', className: 'text-right', cell: (m) => <div className="flex justify-end gap-1"><button className="rounded-full p-2 hover:bg-peach" aria-label="Open message" onClick={() => view(m)}><Mail size={16} /></button><button className="rounded-full p-2 text-red-600 hover:bg-red-50" aria-label="Delete message" onClick={() => setDel(m)}><Trash2 size={16} /></button></div> },
        ]} />
      {data && <Pager page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />}
      <Modal open={!!open} title={open?.subject ?? ''} onClose={() => setOpen(null)}>
        {open && (
          <div className="space-y-3 text-sm">
            <p><b>{open.name}</b> · <a className="text-link underline" href={`mailto:${open.email}?subject=${encodeURIComponent(`Re: ${open.subject}`)}`}>{open.email}</a></p>
            <p className="text-xs text-choco-soft">{formatDateTime(open.createdAt)}</p>
            <p className="whitespace-pre-line rounded-2xl bg-beige p-4 leading-relaxed">{open.message}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => { mark(open, false); setOpen(null); }}>Mark as unread</button>
              <a className="btn btn-sm" href={`mailto:${open.email}?subject=${encodeURIComponent(`Re: ${open.subject}`)}`}>Reply by email</a>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmationModal open={!!del} title="Delete this message?" confirmLabel="Delete" cancelLabel="Keep" danger onClose={() => setDel(null)}
        onConfirm={async () => { const m = del!; setDel(null); try { await api(`/admin/messages/${m.id}`, { method: 'DELETE' }); toast('Message deleted'); reload(); } catch (e) { toast((e as Error).message, 'error'); } }}>
        The message from <b>{del?.name}</b> will be permanently deleted.
      </ConfirmationModal>
    </div>
  );
}
