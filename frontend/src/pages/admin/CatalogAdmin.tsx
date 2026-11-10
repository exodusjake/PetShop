import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Minus, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api, useApi } from '../../lib/api';
import type { AdminCategory, InventoryRow, Paged } from '../../lib/adminTypes';
import { useToast } from '../../context/Toast';
import { ConfirmationModal } from '../../components/cart';
import { DataTable, ImageUploader, Modal, PageHeader, Pager, Pill, useReload } from '../../components/dashboard';
import { Field, FormError, TextInput } from '../../components/forms';

// ───────────── categories ─────────────
function CategoryForm({ cat, kind, onSaved, onClose }: { cat: AdminCategory | null; kind: 'PRODUCT' | 'PET'; onSaved: () => void; onClose: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(cat?.name ?? ''), [img, setImg] = useState<string[]>(cat?.imageUrl ? [cat.imageUrl] : []), [order, setOrder] = useState(String(cat?.sortOrder ?? 0));
  const [err, setErr] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await api(cat ? `/admin/categories/${cat.id}` : '/admin/categories', { method: cat ? 'PATCH' : 'POST', json: { name, kind, imageUrl: img[0] ?? null, sortOrder: Number(order) || 0 } });
      toast('Saved'); onSaved();
    } catch (ex) { setErr((ex as Error).message); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <FormError message={err} />
      <Field label="Name" htmlFor="cname"><TextInput id="cname" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /></Field>
      <Field label="Sort order" htmlFor="corder" hint="Lower numbers appear first"><TextInput id="corder" type="number" min="0" value={order} onChange={(e) => setOrder(e.target.value)} /></Field>
      <ImageUploader value={img} onChange={setImg} max={1} label="Image" />
      <div className="flex justify-end gap-3"><button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-sm" disabled={busy}>Save</button></div>
    </form>
  );
}

export function Categories() {
  const { toast } = useToast();
  const { reload, withKey } = useReload();
  const { data } = useApi<AdminCategory[]>(withKey('/admin/categories'));
  const [edit, setEdit] = useState<{ cat: AdminCategory | null; kind: 'PRODUCT' | 'PET' } | null>(null);
  const [del, setDel] = useState<AdminCategory | null>(null);

  const table = (kind: 'PRODUCT' | 'PET', title: string) => (
    <section className="min-w-0">
      <div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2><button className="btn btn-sm" onClick={() => setEdit({ cat: null, kind })}><Plus size={15} /> Add</button></div>
      <DataTable label={title} rows={data ? data.filter((c) => c.kind === kind) : null} rowKey={(c) => c.id} empty="None yet."
        columns={[
          { header: 'Name', cell: (c) => <div className="flex items-center gap-3">{c.imageUrl ? <img src={c.imageUrl} alt="" className="h-10 w-10 rounded-lg bg-[#FDEEE3] object-cover" /> : <div className="h-10 w-10 rounded-lg bg-[#FDEEE3]" />}<b>{c.name}</b></div> },
          { header: 'Products', cell: (c) => c.productCount, className: 'text-right' },
          { header: 'Actions', className: 'text-right', cell: (c) => <div className="flex justify-end gap-1"><button className="rounded-full p-2 hover:bg-peach" aria-label={`Edit ${c.name}`} onClick={() => setEdit({ cat: c, kind })}><Pencil size={16} /></button><button className="rounded-full p-2 text-red-600 hover:bg-red-50" aria-label={`Delete ${c.name}`} onClick={() => setDel(c)}><Trash2 size={16} /></button></div> },
        ]} />
    </section>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Categories" subtitle="Product categories and pet types used across the shop." />
      <div className="grid gap-6 xl:grid-cols-2">{table('PRODUCT', 'Product categories')}{table('PET', 'Pet types')}</div>
      <Modal open={!!edit} title={edit?.cat ? 'Edit category' : 'Add category'} onClose={() => setEdit(null)}>
        {edit && <CategoryForm key={edit.cat?.id ?? 'new'} cat={edit.cat} kind={edit.kind} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
      </Modal>
      <ConfirmationModal open={!!del} title="Delete this category?" confirmLabel="Delete" cancelLabel="Cancel" danger onClose={() => setDel(null)}
        onConfirm={async () => { const c = del!; setDel(null); try { await api(`/admin/categories/${c.id}`, { method: 'DELETE' }); toast('Category deleted'); reload(); } catch (e) { toast((e as Error).message, 'error'); } }}>
        <b>{del?.name}</b> will be removed. Categories that still have products can't be deleted.
      </ConfirmationModal>
    </div>
  );
}

// ───────────── inventory ─────────────
function StockCell({ row, onChanged }: { row: InventoryRow; onChanged: () => void }) {
  const { toast } = useToast();
  const [val, setVal] = useState(String(row.quantity));
  useEffect(() => setVal(String(row.quantity)), [row.quantity]);
  const send = async (body: object) => { try { await api(`/admin/inventory/${row.productId}`, { method: 'PATCH', json: body }); onChanged(); } catch (e) { toast((e as Error).message, 'error'); setVal(String(row.quantity)); } };
  return (
    <div className="flex items-center gap-1">
      <button className="grid h-8 w-8 place-items-center rounded-full bg-peach hover:bg-primary hover:text-white disabled:opacity-40" disabled={row.quantity <= 0} onClick={() => send({ delta: -1 })} aria-label={`Remove one ${row.name}`}><Minus size={14} /></button>
      <input aria-label={`Stock for ${row.name}`} className="input !w-20 !px-2 !py-1.5 text-center" inputMode="numeric" value={val} onChange={(e) => setVal(e.target.value.replace(/\D/g, ''))}
        onBlur={() => { if (val !== '' && Number(val) !== row.quantity) send({ quantity: Number(val) }); else setVal(String(row.quantity)); }} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
      <button className="grid h-8 w-8 place-items-center rounded-full bg-peach hover:bg-primary hover:text-white" onClick={() => send({ delta: 1 })} aria-label={`Add one ${row.name}`}><Plus size={14} /></button>
    </div>
  );
}

export function Inventory() {
  const [sp, setSp] = useSearchParams();
  const low = sp.get('low') === 'true';
  const { reload, withKey } = useReload();
  const [q, setQ] = useState(''), [term, setTerm] = useState(''), [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setTerm(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const { data } = useApi<Paged<InventoryRow> & { lowCount: number }>(withKey(`/admin/inventory?page=${page}&pageSize=20${low ? '&low=true' : ''}${term ? `&q=${encodeURIComponent(term)}` : ''}`));

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Change stock on the spot. Edits are saved immediately and logged." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-choco-soft" /><input className="input !pl-9" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search inventory" /></div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-bold"><input type="checkbox" className="accent-primary" checked={low} onChange={(e) => { setSp(e.target.checked ? { low: 'true' } : {}); setPage(1); }} />Low or out of stock only{data ? ` (${data.lowCount})` : ''}</label>
      </div>
      <DataTable rows={data?.items ?? null} rowKey={(r) => r.productId} empty="No products match."
        columns={[
          { header: 'Product', cell: (r) => <div className="flex items-center gap-3">{r.image ? <img src={r.image} alt="" className="h-10 w-10 rounded-lg bg-[#FDEEE3] object-cover" /> : <div className="h-10 w-10 rounded-lg bg-[#FDEEE3]" />}<div><p className="font-extrabold">{r.name}</p><p className="text-xs text-choco-soft">{r.brand}{r.variants.length ? ` · ${r.variants.map((v) => `${v.name}: ${v.stock}`).join(', ')}` : ''}</p></div></div> },
          { header: 'Status', cell: (r) => <Pill value={r.out ? 'OUT' : r.low ? 'LOW' : 'OK'} label={r.out ? 'Out of stock' : r.low ? 'Low stock' : 'In stock'} /> },
          { header: 'Alert at', cell: (r) => r.lowStockThreshold },
          { header: 'Stock', cell: (r) => <StockCell row={r} onChanged={reload} /> },
        ]} />
      {data && <Pager page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />}
    </div>
  );
}
