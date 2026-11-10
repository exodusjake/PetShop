import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Archive, Loader2, Pencil, Plus, RotateCcw, Search } from 'lucide-react';
import { ApiError, api, useApi } from '../../lib/api';
import type { AdminCategory, AdminProduct, Paged } from '../../lib/adminTypes';
import { formatPeso } from '../../lib/format';
import { useToast } from '../../context/Toast';
import { ConfirmationModal } from '../../components/cart';
import { DataTable, ImageUploader, Modal, PageHeader, Pager, Pill, useReload } from '../../components/dashboard';
import { Field, FormError, TextInput } from '../../components/forms';

const optNum = (v: unknown) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));

const schema = z.object({
  name: z.string().trim().min(2, 'Enter a product name'),
  brand: z.string().trim().min(1, 'Enter a brand'),
  description: z.string().trim().min(10, 'Write a short description (10+ characters)'),
  price: z.number({ invalid_type_error: 'Enter a price' }).positive('Price must be more than 0'),
  salePrice: z.number().positive('Sale price must be more than 0').nullable(),
  saleEndsAt: z.string().nullable(),
  categoryId: z.number({ invalid_type_error: 'Choose a category' }).int().positive('Choose a category'),
  petTypeId: z.number({ invalid_type_error: 'Choose a pet type' }).int().positive('Choose a pet type'),
  stock: z.number({ invalid_type_error: 'Enter the stock' }).int().min(0, 'Stock cannot be negative'),
  lowStockThreshold: z.number({ invalid_type_error: 'Enter a number' }).int().min(0),
  isFeatured: z.boolean(),
  isActive: z.boolean(),
}).refine((v) => v.salePrice == null || v.salePrice < v.price, { path: ['salePrice'], message: 'Must be lower than the regular price' });
type Form = z.infer<typeof schema>;

const toInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

function ProductForm({ product, cats, pets, onSaved, onClose }: { product: AdminProduct | null; cats: AdminCategory[]; pets: AdminCategory[]; onSaved: () => void; onClose: () => void }) {
  const { toast } = useToast();
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: product
      ? { name: product.name, brand: product.brand, description: product.description, price: product.price, salePrice: product.salePrice, saleEndsAt: toInput(product.saleEndsAt), categoryId: product.categoryId, petTypeId: product.petTypeId, stock: product.stock, lowStockThreshold: product.lowStockThreshold, isFeatured: product.isFeatured, isActive: product.isActive }
      : { name: '', brand: '', description: '', price: undefined, salePrice: null, saleEndsAt: '', categoryId: cats[0]?.id, petTypeId: pets[0]?.id, stock: 0, lowStockThreshold: 5, isFeatured: false, isActive: true },
  });
  const e = (k: keyof Form) => errors[k]?.message as string | undefined;

  const save = handleSubmit(async (v) => {
    setErr(null);
    const body = { ...v, saleEndsAt: v.saleEndsAt ? new Date(`${v.saleEndsAt}T23:59:59`).toISOString() : null, images };
    try {
      await api(product ? `/admin/products/${product.id}` : '/admin/products', { method: product ? 'PATCH' : 'POST', json: body });
      toast(product ? 'Product updated' : 'Product created');
      onSaved();
    } catch (ex) {
      if (ex instanceof ApiError) { for (const [k, m] of Object.entries(ex.issues)) if (m[0]) setError(k as keyof Form, { message: m[0] }); setErr(ex.message); } else setErr('Something went wrong.');
    }
  });

  return (
    <form noValidate onSubmit={save} className="space-y-4">
      <FormError message={err} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Product name" htmlFor="pname" error={e('name')}><TextInput id="pname" invalid={!!errors.name} {...register('name')} /></Field>
        <Field label="Brand" htmlFor="pbrand" error={e('brand')}><TextInput id="pbrand" invalid={!!errors.brand} {...register('brand')} /></Field>
      </div>
      <Field label="Description" htmlFor="pdesc" error={e('description')}><textarea id="pdesc" rows={4} className={`input ${errors.description ? '!border-red-500' : ''}`} {...register('description')} /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Price (₱)" htmlFor="pprice" error={e('price')}><TextInput id="pprice" type="number" step="0.01" min="0" invalid={!!errors.price} {...register('price', { valueAsNumber: true })} /></Field>
        <Field label="Sale price (₱)" htmlFor="psale" error={e('salePrice')} hint="Leave empty for no discount"><TextInput id="psale" type="number" step="0.01" min="0" invalid={!!errors.salePrice} {...register('salePrice', { setValueAs: optNum })} /></Field>
        <Field label="Sale ends" htmlFor="psend" hint="Optional"><TextInput id="psend" type="date" {...register('saleEndsAt')} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="pcat" error={e('categoryId')}><select id="pcat" className="input" {...register('categoryId', { valueAsNumber: true })}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Pet type" htmlFor="ppet" error={e('petTypeId')}><select id="ppet" className="input" {...register('petTypeId', { valueAsNumber: true })}>{pets.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Stock" htmlFor="pstock" error={e('stock')}><TextInput id="pstock" type="number" min="0" invalid={!!errors.stock} {...register('stock', { valueAsNumber: true })} /></Field>
        <Field label="Low-stock alert at" htmlFor="pth" error={e('lowStockThreshold')}><TextInput id="pth" type="number" min="0" {...register('lowStockThreshold', { valueAsNumber: true })} /></Field>
      </div>
      <ImageUploader value={images} onChange={setImages} max={6} label="Product images (first is the main photo)" />
      <div className="flex flex-wrap gap-6 text-sm font-bold">
        <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="accent-primary" {...register('isActive')} />Visible in shop</label>
        <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="accent-primary" {...register('isFeatured')} />Featured on homepage</label>
      </div>
      <div className="flex justify-end gap-3 pt-2"><button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-sm" disabled={isSubmitting}>{isSubmitting ? <Loader2 size={16} className="animate-spin" /> : product ? 'Save changes' : 'Create product'}</button></div>
    </form>
  );
}

export default function Products() {
  const { toast } = useToast();
  const { n, reload, withKey } = useReload();
  const [q, setQ] = useState(''), [term, setTerm] = useState(''), [status, setStatus] = useState('active'), [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminProduct | 'new' | null>(null);
  const [archiving, setArchiving] = useState<AdminProduct | null>(null);
  useEffect(() => { const t = setTimeout(() => { setTerm(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);

  const { data, loading } = useApi<Paged<AdminProduct>>(withKey(`/admin/products?page=${page}&status=${status}${term ? `&q=${encodeURIComponent(term)}` : ''}`));
  const cats = useApi<AdminCategory[]>('/admin/categories').data ?? [];
  const productCats = cats.filter((c) => c.kind === 'PRODUCT'), petCats = cats.filter((c) => c.kind === 'PET');
  void n;

  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast(ok); reload(); } catch (e) { toast((e as Error).message, 'error'); } };

  return (
    <div>
      <PageHeader title="Products" subtitle="Add, edit and archive what you sell." actions={<button className="btn btn-sm" onClick={() => setEditing('new')} disabled={!productCats.length}><Plus size={16} /> Add product</button>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-choco-soft" /><input className="input !pl-9" placeholder="Search products or brands…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" /></div>
        <select className="input !w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status"><option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option></select>
      </div>

      <DataTable rows={data?.items ?? null} loading={loading} rowKey={(p) => p.id} empty="No products found."
        columns={[
          { header: 'Product', cell: (p) => <div className="flex items-center gap-3">{p.images[0] ? <img src={p.images[0]} alt="" className="h-11 w-11 rounded-lg bg-[#FDEEE3] object-cover" /> : <div className="h-11 w-11 rounded-lg bg-[#FDEEE3]" />}<div><p className="font-extrabold">{p.name}</p><p className="text-xs text-choco-soft">{p.brand} · {p.category} · {p.petType}</p></div></div> },
          { header: 'Price', cell: (p) => p.salePrice != null ? <div><b className="text-primary">{formatPeso(p.salePrice)}</b><p className="text-xs text-choco-soft line-through">{formatPeso(p.price)}</p></div> : <b>{formatPeso(p.price)}</b> },
          { header: 'Stock', cell: (p) => <Pill value={p.stock === 0 ? 'OUT' : p.stock <= p.lowStockThreshold ? 'LOW' : 'OK'} label={`${p.stock}`} /> },
          { header: 'Sold', cell: (p) => p.soldCount },
          { header: 'Status', cell: (p) => <div className="flex flex-wrap gap-1">{p.archivedAt ? <Pill value="ARCHIVED" /> : p.isActive ? <Pill value="ACTIVE" /> : <Pill value="DRAFT" label="Hidden" />}{p.isFeatured && <Pill value="CONFIRMED" label="Featured" />}{p.isDemo && <Pill value="DRAFT" label="Demo" />}</div> },
          { header: 'Actions', className: 'text-right', cell: (p) => (
            <div className="flex justify-end gap-1">
              <button className="rounded-full p-2 hover:bg-peach" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}><Pencil size={16} /></button>
              {p.archivedAt
                ? <button className="rounded-full p-2 hover:bg-peach" onClick={() => act(() => api(`/admin/products/${p.id}/restore`, { method: 'POST', json: {} }), 'Product restored')} aria-label={`Restore ${p.name}`}><RotateCcw size={16} /></button>
                : <button className="rounded-full p-2 text-red-600 hover:bg-red-50" onClick={() => setArchiving(p)} aria-label={`Archive ${p.name}`}><Archive size={16} /></button>}
            </div>) },
        ]} />
      {data && <Pager page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />}

      <Modal open={editing !== null} title={editing === 'new' ? 'Add product' : 'Edit product'} onClose={() => setEditing(null)} wide>
        {editing !== null && <ProductForm key={editing === 'new' ? 'new' : editing.id} product={editing === 'new' ? null : editing} cats={productCats} pets={petCats} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      </Modal>
      <ConfirmationModal open={!!archiving} title="Archive this product?" confirmLabel="Archive" cancelLabel="Cancel" danger onClose={() => setArchiving(null)}
        onConfirm={() => { const p = archiving!; setArchiving(null); act(() => api(`/admin/products/${p.id}`, { method: 'DELETE' }), 'Product archived'); }}>
        <b>{archiving?.name}</b> will disappear from the shop. Past orders keep their history, and you can restore it later.
      </ConfirmationModal>
    </div>
  );
}
