import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { ApiError, api, useApi } from '../../lib/api';
import type { Paged } from '../../lib/adminTypes';
import { formatAge, formatDate } from '../../lib/format';
import { useToast } from '../../context/Toast';
import { ConfirmationModal } from '../../components/cart';
import { DataTable, ImageUploader, Modal, PageHeader, Pager, Pill, useReload } from '../../components/dashboard';
import { Field, FormError, TextInput } from '../../components/forms';

interface Listing { id: number; name: string; species: string; breed: string; ageMonths: number; gender: string; description: string; status: string; location: string; requirements: string; photoUrl: string | null; isDemo: boolean; applications: number }
interface Application {
  id: number; status: string; adminNote: string | null; createdAt: string; applicantName: string; email: string; phone: string; address: string; livingSituation: string; experience: string; reason: string;
  pet: { id: number; name: string; species: string; breed: string; photoUrl: string | null; status: string }; account: { id: number; name: string }; allowedNext: string[];
}

const LABEL: Record<string, string> = { UNDER_REVIEW: 'Mark under review', APPROVED: 'Approve', REJECTED: 'Reject', PENDING: 'Back to pending' };
const SPECIES = ['Dog', 'Cat', 'Rabbit', 'Hamster', 'Guinea Pig', 'Bird', 'Fish', 'Reptile', 'Other'];

// ───────────── applications ─────────────
function ReviewModal({ app, onClose, onDone }: { app: Application; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [note, setNote] = useState(app.adminNote ?? '');
  const [busy, setBusy] = useState(false), [pending, setPending] = useState<string | null>(null);
  const decide = async (status: string) => {
    setBusy(true);
    try { await api(`/admin/adoption/applications/${app.id}`, { method: 'PATCH', json: { status, adminNote: note || null } }); toast(`Application ${status.replace('_', ' ').toLowerCase()}`); onDone(); }
    catch (e) { toast((e as Error).message, 'error'); }
    setBusy(false); setPending(null);
  };
  const row = (k: string, v: string) => <div><dt className="text-xs font-extrabold uppercase tracking-wide text-choco-soft">{k}</dt><dd className="whitespace-pre-line text-sm">{v}</dd></div>;
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl bg-beige p-3">
          {app.pet.photoUrl && <img src={app.pet.photoUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />}
          <div className="flex-1"><p className="font-extrabold">{app.pet.name} <span className="font-normal text-choco-soft">· {app.pet.species}, {app.pet.breed}</span></p><p className="text-xs text-choco-soft">Pet status: {app.pet.status.toLowerCase()}</p></div><Pill value={app.status} />
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">{row('Applicant', app.account.name === app.applicantName ? app.applicantName : `${app.applicantName} (account: ${app.account.name})`)}{row('Email', app.email)}{row('Phone', app.phone)}{row('Submitted', formatDate(app.createdAt))}</dl>
        <dl className="space-y-3">{row('Address', app.address)}{row('Living situation', app.livingSituation)}{row('Pet care experience', app.experience)}{row('Reason for adopting', app.reason)}</dl>
        {app.allowedNext.length > 0 ? (
          <>
            <Field label="Note for the applicant (optional)" htmlFor="appnote" hint="Shown to the applicant with their decision."><textarea id="appnote" rows={3} maxLength={500} className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            <div className="flex flex-wrap justify-end gap-2">
              {app.allowedNext.map((s) => <button key={s} className={`btn btn-sm ${s === 'REJECTED' ? '!bg-red-600 hover:!bg-red-700' : s === 'APPROVED' ? '!bg-green-600 hover:!bg-green-700' : 'btn-ghost'}`} disabled={busy} onClick={() => (s === 'APPROVED' || s === 'REJECTED') ? setPending(s) : decide(s)}>{LABEL[s]}</button>)}
            </div>
          </>
        ) : <p className="rounded-2xl bg-beige p-3 text-sm text-choco-soft">This decision is final.{app.adminNote && <> Note sent: “{app.adminNote}”</>}</p>}
      </div>
      <ConfirmationModal open={!!pending} title={pending === 'APPROVED' ? 'Approve this application?' : 'Reject this application?'} confirmLabel={pending === 'APPROVED' ? 'Approve' : 'Reject'} cancelLabel="Back" danger={pending === 'REJECTED'} busy={busy} onConfirm={() => decide(pending!)} onClose={() => setPending(null)}>
        This is a final decision and the applicant will see it{note ? ' along with your note' : ''}. Approving does not change the pet's status. Update it yourself in the Pets tab when the adoption is complete.
      </ConfirmationModal>
    </>
  );
}

function Applications() {
  const { reload, withKey } = useReload();
  const [status, setStatus] = useState(''), [page, setPage] = useState(1), [open, setOpen] = useState<Application | null>(null);
  const { data, loading } = useApi<Paged<Application>>(withKey(`/admin/adoption/applications?page=${page}${status ? `&status=${status}` : ''}`));
  return (
    <div>
      <div className="mb-4"><select className="input !w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status"><option value="">All applications</option>{['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].map((s) => <option key={s} value={s}>{s.replace('_', ' ').charAt(0) + s.replace('_', ' ').slice(1).toLowerCase()}</option>)}</select></div>
      <DataTable rows={data?.items ?? null} loading={loading} rowKey={(a) => a.id} empty="No applications yet."
        columns={[
          { header: 'Applicant', cell: (a) => <button className="text-left" onClick={() => setOpen(a)}><p className="font-extrabold text-link hover:underline">{a.applicantName}</p><p className="text-xs text-choco-soft">{a.email}</p></button> },
          { header: 'Pet', cell: (a) => <div className="flex items-center gap-2">{a.pet.photoUrl && <img src={a.pet.photoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />}<span className="font-bold">{a.pet.name}</span></div> },
          { header: 'Submitted', cell: (a) => formatDate(a.createdAt) }, { header: 'Status', cell: (a) => <Pill value={a.status} /> },
          { header: '', className: 'text-right', cell: (a) => <button className="btn btn-ghost btn-sm" onClick={() => setOpen(a)}>Review</button> },
        ]} />
      {data && <Pager page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />}
      <Modal open={!!open} title="Adoption application" onClose={() => setOpen(null)} wide>{open && <ReviewModal key={open.id} app={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); reload(); }} />}</Modal>
    </div>
  );
}

// ───────────── pet listings ─────────────
const schema = z.object({
  name: z.string().trim().min(1, "Enter the pet's name"), species: z.string().min(1), breed: z.string().trim().min(1, 'Enter the breed (or "Mixed")'),
  ageMonths: z.number({ invalid_type_error: 'Enter the age in months' }).int().min(0, 'Cannot be negative').max(600), gender: z.enum(['Male', 'Female']),
  description: z.string().trim().min(10, 'Write a short description (10+ characters)'), status: z.enum(['AVAILABLE', 'PENDING', 'ADOPTED']),
  location: z.string().trim().min(2, 'Enter the location'), requirements: z.string().trim().min(10, 'List the adoption requirements'),
});
type Form = z.infer<typeof schema>;

function ListingForm({ pet, onSaved, onClose }: { pet: Listing | null; onSaved: () => void; onClose: () => void }) {
  const { toast } = useToast();
  const [photo, setPhoto] = useState<string[]>(pet?.photoUrl ? [pet.photoUrl] : []);
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: pet ? { ...pet, status: pet.status as Form['status'], gender: pet.gender as Form['gender'] } : { name: '', species: 'Dog', breed: '', ageMonths: 12, gender: 'Male', description: '', status: 'AVAILABLE', location: '', requirements: 'Valid ID, a home visit, and a signed adoption agreement. Adoption is subject to manual approval.' },
  });
  const e = (k: keyof Form) => errors[k]?.message as string | undefined;
  const submit = handleSubmit(async (v) => {
    setErr(null);
    try { await api(pet ? `/admin/adoption/listings/${pet.id}` : '/admin/adoption/listings', { method: pet ? 'PATCH' : 'POST', json: { ...v, photoUrl: photo[0] ?? null } }); toast('Saved'); onSaved(); }
    catch (ex) { if (ex instanceof ApiError) { for (const [k, m] of Object.entries(ex.issues)) if (m[0]) setError(k as keyof Form, { message: m[0] }); setErr(ex.message); } else setErr('Something went wrong.'); }
  });
  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <FormError message={err} />
      <ImageUploader value={photo} onChange={setPhoto} max={1} label="Photo" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="l-name" error={e('name')}><TextInput id="l-name" invalid={!!errors.name} {...register('name')} /></Field>
        <Field label="Species" htmlFor="l-species"><select id="l-species" className="input" {...register('species')}>{SPECIES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Breed" htmlFor="l-breed" error={e('breed')}><TextInput id="l-breed" invalid={!!errors.breed} {...register('breed')} /></Field>
        <Field label="Gender" htmlFor="l-gender"><select id="l-gender" className="input" {...register('gender')}><option>Male</option><option>Female</option></select></Field>
        <Field label="Age (months)" htmlFor="l-age" error={e('ageMonths')}><TextInput id="l-age" type="number" min="0" invalid={!!errors.ageMonths} {...register('ageMonths', { valueAsNumber: true })} /></Field>
        <Field label="Status" htmlFor="l-status"><select id="l-status" className="input" {...register('status')}><option value="AVAILABLE">Available</option><option value="PENDING">Adoption pending</option><option value="ADOPTED">Adopted</option></select></Field>
      </div>
      <Field label="Location" htmlFor="l-loc" error={e('location')}><TextInput id="l-loc" invalid={!!errors.location} {...register('location')} /></Field>
      <Field label="Description" htmlFor="l-desc" error={e('description')}><textarea id="l-desc" rows={3} className="input" {...register('description')} /></Field>
      <Field label="Adoption requirements" htmlFor="l-req" error={e('requirements')}><textarea id="l-req" rows={2} className="input" {...register('requirements')} /></Field>
      <div className="flex justify-end gap-3"><button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-sm" disabled={isSubmitting}>{isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Save pet'}</button></div>
    </form>
  );
}

function Listings() {
  const { toast } = useToast();
  const { reload, withKey } = useReload();
  const [page, setPage] = useState(1), [edit, setEdit] = useState<Listing | 'new' | null>(null), [del, setDel] = useState<Listing | null>(null);
  const { data, loading } = useApi<Paged<Listing>>(withKey(`/admin/adoption/listings?page=${page}`));
  return (
    <div>
      <div className="mb-4 flex justify-end"><button className="btn btn-sm" onClick={() => setEdit('new')}><Plus size={16} /> Add pet</button></div>
      <DataTable rows={data?.items ?? null} loading={loading} rowKey={(p) => p.id} empty="No pets listed yet."
        columns={[
          { header: 'Pet', cell: (p) => <div className="flex items-center gap-3">{p.photoUrl ? <img src={p.photoUrl} alt="" className="h-11 w-11 rounded-lg bg-[#FDEEE3] object-cover" /> : <div className="h-11 w-11 rounded-lg bg-[#FDEEE3]" />}<div><p className="font-extrabold">{p.name}{p.isDemo && <span className="ml-2 text-xs font-bold text-choco-soft">(demo)</span>}</p><p className="text-xs text-choco-soft">{p.species} · {p.breed} · {formatAge(p.ageMonths)} · {p.gender}</p></div></div> },
          { header: 'Status', cell: (p) => <Pill value={p.status} label={p.status === 'PENDING' ? 'Adoption pending' : undefined} /> }, { header: 'Applications', cell: (p) => p.applications },
          { header: 'Actions', className: 'text-right', cell: (p) => <div className="flex justify-end gap-1"><button className="rounded-full p-2 hover:bg-peach" aria-label={`Edit ${p.name}`} onClick={() => setEdit(p)}><Pencil size={16} /></button><button className="rounded-full p-2 text-red-600 hover:bg-red-50" aria-label={`Delete ${p.name}`} onClick={() => setDel(p)}><Trash2 size={16} /></button></div> },
        ]} />
      {data && <Pager page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />}
      <Modal open={edit !== null} title={edit === 'new' ? 'Add a pet for adoption' : 'Edit pet'} onClose={() => setEdit(null)} wide>
        {edit !== null && <ListingForm key={edit === 'new' ? 'new' : edit.id} pet={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
      </Modal>
      <ConfirmationModal open={!!del} title={`Delete ${del?.name}?`} confirmLabel="Delete" cancelLabel="Keep" danger onClose={() => setDel(null)}
        onConfirm={async () => { const p = del!; setDel(null); try { await api(`/admin/adoption/listings/${p.id}`, { method: 'DELETE' }); toast('Pet deleted'); reload(); } catch (e) { toast((e as Error).message, 'error'); } }}>
        Pets that have applications can't be deleted. Mark them as Adopted instead.
      </ConfirmationModal>
    </div>
  );
}

export default function AdoptionAdmin() {
  const [tab, setTab] = useState<'apps' | 'pets'>('apps');
  const t = (on: boolean) => `rounded-full px-5 py-2 text-sm font-extrabold ${on ? 'bg-primary text-white' : 'bg-white shadow-soft hover:bg-peach'}`;
  return (
    <div>
      <PageHeader title="Adoption" subtitle="Review applications and manage the pets listed for adoption. Approval is always your decision." />
      <div className="mb-5 flex gap-2" role="tablist"><button role="tab" aria-selected={tab === 'apps'} className={t(tab === 'apps')} onClick={() => setTab('apps')}>Applications</button><button role="tab" aria-selected={tab === 'pets'} className={t(tab === 'pets')} onClick={() => setTab('pets')}>Pets</button></div>
      {tab === 'apps' ? <Applications /> : <Listings />}
    </div>
  );
}
