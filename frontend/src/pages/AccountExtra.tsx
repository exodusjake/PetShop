import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, MapPin, Pencil, PawPrint, Plus, Trash2 } from 'lucide-react';
import { ApiError, api, useApi } from '../lib/api';
import { formatAgeFromDate } from '../lib/format';
import { useToast } from '../context/Toast';
import { EmptyState } from '../components/ui';
import { ConfirmationModal } from '../components/cart';
import { ImageUploader, Modal, PageHeader, useReload } from '../components/dashboard';
import { Field, FormError, TextInput } from '../components/forms';

// ───────────── pets ─────────────
interface Pet { id: number; name: string; species: string; breed: string | null; birthDate: string | null; gender: string | null; photoUrl: string | null; notes: string | null }
const SPECIES = ['Dog', 'Cat', 'Rabbit', 'Hamster', 'Guinea Pig', 'Bird', 'Fish', 'Reptile', 'Other'];

const petSchema = z.object({
  name: z.string().trim().min(1, "Enter your pet's name").max(80),
  species: z.string().min(1, 'Choose a species'),
  breed: z.string().trim().max(80).optional(),
  birthDate: z.string().optional().refine((v) => !v || new Date(v) <= new Date(), 'Birth date must be in the past'),
  gender: z.enum(['Male', 'Female', 'Unknown']),
  notes: z.string().trim().max(500).optional(),
});
type PetForm = z.infer<typeof petSchema>;

function PetEditor({ pet, onSaved, onClose }: { pet: Pet | null; onSaved: () => void; onClose: () => void }) {
  const { toast } = useToast();
  const [photo, setPhoto] = useState<string[]>(pet?.photoUrl ? [pet.photoUrl] : []);
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<PetForm>({
    resolver: zodResolver(petSchema),
    defaultValues: { name: pet?.name ?? '', species: pet?.species ?? 'Dog', breed: pet?.breed ?? '', birthDate: pet?.birthDate?.slice(0, 10) ?? '', gender: (pet?.gender as PetForm['gender']) ?? 'Unknown', notes: pet?.notes ?? '' },
  });
  const submit = handleSubmit(async (v) => {
    setErr(null);
    try {
      await api(pet ? `/account/pets/${pet.id}` : '/account/pets', { method: pet ? 'PATCH' : 'POST', json: { ...v, breed: v.breed || null, birthDate: v.birthDate || null, notes: v.notes || null, photoUrl: photo[0] ?? null } });
      toast(pet ? 'Pet updated' : 'Pet added'); onSaved();
    } catch (e) {
      if (e instanceof ApiError) { for (const [k, m] of Object.entries(e.issues)) if (m[0]) setError(k as keyof PetForm, { message: m[0] }); setErr(e.message); } else setErr('Something went wrong.');
    }
  });
  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <FormError message={err} />
      <ImageUploader value={photo} onChange={setPhoto} max={1} label="Photo" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="pet-name" error={errors.name?.message}><TextInput id="pet-name" invalid={!!errors.name} {...register('name')} /></Field>
        <Field label="Species" htmlFor="pet-species" error={errors.species?.message}><select id="pet-species" className="input" {...register('species')}>{SPECIES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Breed" htmlFor="pet-breed"><TextInput id="pet-breed" {...register('breed')} /></Field>
        <Field label="Gender" htmlFor="pet-gender"><select id="pet-gender" className="input" {...register('gender')}><option>Male</option><option>Female</option><option>Unknown</option></select></Field>
        <Field label="Birth date" htmlFor="pet-birth" error={errors.birthDate?.message} hint="An estimate is fine"><TextInput id="pet-birth" type="date" max={new Date().toISOString().slice(0, 10)} {...register('birthDate')} /></Field>
      </div>
      <Field label="Notes" htmlFor="pet-notes" hint="Allergies, favourite treats, vet info…"><textarea id="pet-notes" rows={3} className="input" {...register('notes')} /></Field>
      <div className="flex justify-end gap-3"><button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-sm" disabled={isSubmitting}>{isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Save'}</button></div>
    </form>
  );
}

export function PetsPage() {
  const { toast } = useToast();
  const { reload, withKey } = useReload();
  const { data, error } = useApi<Pet[]>(withKey('/account/pets'));
  const [edit, setEdit] = useState<Pet | 'new' | null>(null);
  const [del, setDel] = useState<Pet | null>(null);
  return (
    <div>
      <PageHeader title="My Pets" subtitle="Keep a profile for each of your furry family members." actions={<button className="btn btn-sm" onClick={() => setEdit('new')}><Plus size={16} /> Add pet</button>} />
      {error && <EmptyState title="Couldn't load your pets" text={error} />}
      {data?.length === 0 && <EmptyState title="No pets yet" text="Add your first pet to start a profile." action={<button className="btn btn-sm" onClick={() => setEdit('new')}>Add a pet</button>} />}
      <div className="grid gap-4 sm:grid-cols-2">
        {!data && !error && <><div className="skeleton h-40" /><div className="skeleton h-40" /></>}
        {data?.map((p) => (
          <article key={p.id} className="card flex gap-4 p-4">
            {p.photoUrl ? <img src={p.photoUrl} alt={p.name} className="h-24 w-24 shrink-0 rounded-2xl bg-[#FDEEE3] object-cover" /> : <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-[#FDEEE3] text-primary"><PawPrint size={34} /></div>}
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-semibold">{p.name}</h2>
              <p className="text-sm font-bold text-choco-soft">{p.species}{p.breed ? ` · ${p.breed}` : ''}</p>
              <p className="text-sm text-choco-soft">{[p.gender && p.gender !== 'Unknown' ? p.gender : '', formatAgeFromDate(p.birthDate)].filter(Boolean).join(' · ')}</p>
              {p.notes && <p className="mt-1 line-clamp-2 text-xs text-choco-soft">{p.notes}</p>}
            </div>
            <div className="flex flex-col gap-1"><button className="rounded-full p-2 hover:bg-peach" aria-label={`Edit ${p.name}`} onClick={() => setEdit(p)}><Pencil size={16} /></button><button className="rounded-full p-2 text-red-600 hover:bg-red-50" aria-label={`Delete ${p.name}`} onClick={() => setDel(p)}><Trash2 size={16} /></button></div>
          </article>
        ))}
      </div>
      <Modal open={edit !== null} title={edit === 'new' ? 'Add a pet' : 'Edit pet'} onClose={() => setEdit(null)}>
        {edit !== null && <PetEditor key={edit === 'new' ? 'new' : edit.id} pet={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
      </Modal>
      <ConfirmationModal open={!!del} title={`Remove ${del?.name}?`} confirmLabel="Remove" cancelLabel="Keep" danger onClose={() => setDel(null)}
        onConfirm={async () => { const p = del!; setDel(null); try { await api(`/account/pets/${p.id}`, { method: 'DELETE' }); toast('Pet removed'); reload(); } catch (e) { toast((e as Error).message, 'error'); } }}>
        {del?.name}'s profile will be deleted.
      </ConfirmationModal>
    </div>
  );
}

// ───────────── addresses ─────────────
export interface Address { id: number; label: string; fullName: string; phone: string; line1: string; barangay: string; city: string; province: string; postalCode: string; isDefault: boolean }
const addrSchema = z.object({
  label: z.string().trim().min(1, 'Name this address').max(40),
  fullName: z.string().trim().min(2, "Enter the recipient's name").max(120),
  phone: z.string().trim().regex(/^[0-9+()\-\s]{7,20}$/, 'Enter a valid phone number'),
  line1: z.string().trim().min(5, 'Enter your complete address').max(300),
  barangay: z.string().trim().min(1, 'Enter your barangay'), city: z.string().trim().min(1, 'Enter your city or municipality'),
  province: z.string().trim().min(1, 'Enter your province'), postalCode: z.string().trim().regex(/^[0-9]{4}$/, 'Enter a 4-digit postal code'),
  isDefault: z.boolean(),
});
type AddrForm = z.infer<typeof addrSchema>;

function AddressEditor({ addr, onSaved, onClose }: { addr: Address | null; onSaved: () => void; onClose: () => void }) {
  const { toast } = useToast();
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<AddrForm>({
    resolver: zodResolver(addrSchema),
    defaultValues: addr ?? { label: 'Home', fullName: '', phone: '', line1: '', barangay: '', city: '', province: '', postalCode: '', isDefault: false },
  });
  const f = (k: keyof AddrForm, label: string, extra: object = {}) => <Field label={label} htmlFor={`a-${k}`} error={errors[k]?.message as string | undefined}><TextInput id={`a-${k}`} invalid={!!errors[k]} {...extra} {...register(k as Exclude<keyof AddrForm, 'isDefault'>)} /></Field>;
  const submit = handleSubmit(async (v) => {
    setErr(null);
    try { await api(addr ? `/account/addresses/${addr.id}` : '/account/addresses', { method: addr ? 'PATCH' : 'POST', json: v }); toast(addr ? 'Address updated' : 'Address added'); onSaved(); }
    catch (e) { if (e instanceof ApiError) { for (const [k, m] of Object.entries(e.issues)) if (m[0]) setError(k as keyof AddrForm, { message: m[0] }); setErr(e.message); } else setErr('Something went wrong.'); }
  });
  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <FormError message={err} />
      <div className="grid gap-4 sm:grid-cols-2">{f('label', 'Label (Home, Work…)')}{f('fullName', 'Recipient name')}{f('phone', 'Phone number', { inputMode: 'tel' })}{f('postalCode', 'Postal code', { inputMode: 'numeric', maxLength: 4 })}</div>
      {f('line1', 'Complete address (house no., street)')}
      <div className="grid gap-4 sm:grid-cols-3">{f('barangay', 'Barangay')}{f('city', 'City / Municipality')}{f('province', 'Province')}</div>
      <label className="flex cursor-pointer items-center gap-2 text-sm font-bold"><input type="checkbox" className="accent-primary" {...register('isDefault')} />Make this my default address</label>
      <div className="flex justify-end gap-3"><button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-sm" disabled={isSubmitting}>{isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Save address'}</button></div>
    </form>
  );
}

export function AddressesPage() {
  const { toast } = useToast();
  const { reload, withKey } = useReload();
  const { data, error } = useApi<Address[]>(withKey('/account/addresses'));
  const [edit, setEdit] = useState<Address | 'new' | null>(null);
  const [del, setDel] = useState<Address | null>(null);
  const run = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast(ok); reload(); } catch (e) { toast((e as Error).message, 'error'); } };
  return (
    <div>
      <PageHeader title="My Addresses" subtitle="Saved addresses speed up checkout." actions={<button className="btn btn-sm" onClick={() => setEdit('new')}><Plus size={16} /> Add address</button>} />
      {error && <EmptyState title="Couldn't load your addresses" text={error} />}
      {data?.length === 0 && <EmptyState title="No saved addresses" text="Add one to fill in your details automatically at checkout." action={<button className="btn btn-sm" onClick={() => setEdit('new')}>Add an address</button>} />}
      <div className="grid gap-4 sm:grid-cols-2">
        {!data && !error && <><div className="skeleton h-40" /><div className="skeleton h-40" /></>}
        {data?.map((a) => (
          <article key={a.id} className={`card p-5 text-sm ${a.isDefault ? 'ring-2 ring-primary' : ''}`}>
            <div className="mb-2 flex items-center justify-between"><h2 className="flex items-center gap-2 font-display text-lg font-semibold"><MapPin size={17} className="text-primary" />{a.label}</h2>{a.isDefault && <span className="rounded-full bg-peach px-3 py-1 text-xs font-extrabold">Default</span>}</div>
            <p className="font-bold">{a.fullName} · {a.phone}</p><p>{a.line1}, {a.barangay}</p><p>{a.city}, {a.province} {a.postalCode}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setEdit(a)}>Edit</button>
              {!a.isDefault && <button className="btn btn-ghost btn-sm" onClick={() => run(() => api(`/account/addresses/${a.id}/default`, { method: 'POST', json: {} }), 'Default address updated')}>Set as default</button>}
              <button className="btn btn-ghost btn-sm !border-red-300 !text-red-700" onClick={() => setDel(a)}>Delete</button>
            </div>
          </article>
        ))}
      </div>
      <Modal open={edit !== null} title={edit === 'new' ? 'Add address' : 'Edit address'} onClose={() => setEdit(null)} wide>
        {edit !== null && <AddressEditor key={edit === 'new' ? 'new' : edit.id} addr={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
      </Modal>
      <ConfirmationModal open={!!del} title="Delete this address?" confirmLabel="Delete" cancelLabel="Keep" danger onClose={() => setDel(null)}
        onConfirm={() => { const a = del!; setDel(null); run(() => api(`/account/addresses/${a.id}`, { method: 'DELETE' }), 'Address deleted'); }}>
        {del?.label}: {del?.line1}, {del?.city}
      </ConfirmationModal>
    </div>
  );
}
