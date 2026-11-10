import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, ClipboardCheck, Home, Loader2, MapPin, ShieldCheck } from 'lucide-react';
import { ApiError, api, useApi } from '../lib/api';
import type { AdoptionPet, MyApplication } from '../lib/types';
import { formatAge, formatDate } from '../lib/format';
import { useAuth } from '../context/Auth';
import { useToast } from '../context/Toast';
import PetCard from '../components/PetCard';
import { EmptyState, Paw } from '../components/ui';
import { Pill } from '../components/dashboard';
import { Field, FormError, TextInput } from '../components/forms';

const STATUS_FILTERS = [['', 'All'], ['AVAILABLE', 'Available'], ['PENDING', 'Adoption pending'], ['ADOPTED', 'Adopted']] as const;

export function AdoptionList() {
  const { data, error } = useApi<AdoptionPet[]>('/catalog/adoption');
  const [species, setSpecies] = useState(''), [status, setStatus] = useState('');
  const kinds = useMemo(() => [...new Set((data ?? []).map((p) => p.species))].sort(), [data]);
  const shown = (data ?? []).filter((p) => (!species || p.species === species) && (!status || p.status === status));
  const chip = (on: boolean) => `rounded-full px-4 py-2 text-sm font-extrabold transition ${on ? 'bg-primary text-white' : 'bg-white shadow-soft hover:bg-peach'}`;

  return (
    <div className="container-x py-10">
      <div className="mb-8 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#FDE6D2] px-4 py-1.5 text-[13px] font-bold"><Paw size={14} className="text-primary" /> Pet Adoption</span>
        <h1 className="mt-3 text-4xl font-bold">Find Your New Best Friend</h1>
        <p className="mx-auto mt-2 max-w-xl text-choco-soft">Every pet here is waiting for a loving home. Browse, learn their story, and apply. Our team reviews every application personally.</p>
      </div>

      <div className="mb-3 flex flex-wrap justify-center gap-2" role="group" aria-label="Filter by species">
        <button className={chip(species === '')} onClick={() => setSpecies('')}>All pets</button>
        {kinds.map((k) => <button key={k} className={chip(species === k)} onClick={() => setSpecies(k)}>{k}</button>)}
      </div>
      <div className="mb-8 flex flex-wrap justify-center gap-2" role="group" aria-label="Filter by status">
        {STATUS_FILTERS.map(([v, l]) => <button key={l} className={`${chip(status === v)} !px-3 !py-1.5 !text-xs`} onClick={() => setStatus(v)}>{l}</button>)}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {error && <EmptyState title="We couldn't load the pets" text={error} />}
        {!data && !error && Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-80" />)}
        {data && shown.length === 0 && <EmptyState title="No pets match" text="Try a different filter. New pets are added often." action={<button className="btn btn-sm" onClick={() => { setSpecies(''); setStatus(''); }}>Show all pets</button>} />}
        {shown.map((p) => <PetCard key={p.id} pet={p} heading="h2" />)}
      </div>

      <section className="mt-14 grid gap-4 rounded-4xl bg-white/70 p-6 sm:grid-cols-3" aria-label="How adoption works">
        {[[ClipboardCheck, '1. Apply', 'Tell us about you and your home.'], [ShieldCheck, '2. We review', 'Our team reviews every application by hand.'], [Home, '3. Welcome home', 'Approved families meet their new friend.']].map(([Icon, t, s]) => {
          const I = Icon as typeof Home;
          return <div key={t as string} className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-softgreen text-primary"><I size={22} /></span><div><h2 className="text-base font-semibold">{t as string}</h2><p className="text-sm text-choco-soft">{s as string}</p></div></div>;
        })}
      </section>
    </div>
  );
}

const schema = z.object({
  applicantName: z.string().trim().min(2, 'Enter your full name').max(120),
  phone: z.string().trim().regex(/^[0-9+()\-\s]{7,20}$/, 'Enter a valid phone number'),
  address: z.string().trim().min(8, 'Enter your complete address').max(300),
  livingSituation: z.string().trim().min(5, 'Tell us about your home (house, apartment, yard…)').max(300),
  experience: z.string().trim().min(10, 'Tell us a little about your pet care experience').max(600),
  reason: z.string().trim().min(10, 'Tell us why you would like to adopt').max(800),
});
type Form = z.infer<typeof schema>;

function ApplyForm({ pet, onDone }: { pet: AdoptionPet; onDone: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { applicantName: user?.fullName ?? '', phone: user?.phone ?? '' } });
  const submit = handleSubmit(async (v) => {
    setErr(null);
    try { const r = await api<{ message: string }>(`/adoption/${pet.id}/apply`, { method: 'POST', json: v }); toast(r.message); onDone(); }
    catch (e) { if (e instanceof ApiError) { for (const [k, m] of Object.entries(e.issues)) if (m[0]) setError(k as keyof Form, { message: m[0] }); setErr(e.message); } else setErr('Something went wrong.'); }
  });
  const area = (k: keyof Form, label: string, hint?: string) => (
    <Field label={label} htmlFor={`ap-${k}`} error={errors[k]?.message} hint={hint}><textarea id={`ap-${k}`} rows={3} className={`input ${errors[k] ? '!border-red-500' : ''}`} {...register(k)} /></Field>
  );
  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <FormError message={err} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="ap-name" error={errors.applicantName?.message}><TextInput id="ap-name" autoComplete="name" invalid={!!errors.applicantName} {...register('applicantName')} /></Field>
        <Field label="Phone number" htmlFor="ap-phone" error={errors.phone?.message}><TextInput id="ap-phone" inputMode="tel" autoComplete="tel" invalid={!!errors.phone} {...register('phone')} /></Field>
      </div>
      <Field label="Complete address" htmlFor="ap-address" error={errors.address?.message}><TextInput id="ap-address" autoComplete="street-address" invalid={!!errors.address} {...register('address')} /></Field>
      {area('livingSituation', 'Living situation', 'House or apartment, yard, other pets, who lives with you…')}
      {area('experience', 'Pet care experience')}
      {area('reason', `Why would you like to adopt ${pet.name}?`)}
      <p className="text-xs text-choco-soft">Submitting an application does not guarantee adoption. Every application is reviewed by our team, and approval is a manual decision.</p>
      <button className="btn" disabled={isSubmitting}>{isSubmitting ? <Loader2 size={18} className="animate-spin" /> : `Apply to adopt ${pet.name}`}</button>
    </form>
  );
}

export function AdoptionDetail() {
  const { petId } = useParams();
  const loc = useLocation();
  const { user } = useAuth();
  const { data: pet, error, loading } = useApi<AdoptionPet>(petId ? `/catalog/adoption/${petId}` : null);
  const [rk, setRk] = useState(0);
  const apps = useApi<MyApplication[]>(user ? `/account/adoption-applications?_r=${rk}` : null).data;
  const mine = apps?.find((a) => pet && a.pet.id === pet.id && a.status !== 'REJECTED');

  useEffect(() => { if (pet && loc.hash === '#apply') document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth' }); }, [pet, loc.hash]);

  if (loading) return <div className="container-x py-10" aria-busy="true"><h1 className="sr-only">Loading pet</h1><div className="skeleton h-96" /></div>;
  if (error || !pet) return <div className="container-x py-12"><EmptyState title="Pet not found" action={<Link to="/adoption" className="btn btn-sm">See all pets</Link>} /></div>;

  const facts: [string, string][] = [['Species', pet.species], ['Breed', pet.breed], ['Age', formatAge(pet.ageMonths)], ['Gender', pet.gender], ['Location', pet.location]];

  return (
    <div className="container-x py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs font-semibold text-choco-soft"><Link to="/" className="hover:text-primary">Home</Link> / <Link to="/adoption" className="hover:text-primary">Adoption</Link> / <span className="text-choco">{pet.name}</span></nav>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-4xl bg-[#FDEEE3] shadow-soft">{pet.photoUrl && <img src={pet.photoUrl} alt={`${pet.name}, a ${pet.breed}`} className="aspect-square w-full object-cover" />}</div>
        <div>
          <div className="flex flex-wrap items-center gap-3"><h1 className="text-4xl font-bold">{pet.name}</h1><Pill value={pet.status} label={pet.status === 'PENDING' ? 'Adoption pending' : undefined} />{pet.isDemo && <span className="rounded-full bg-beige px-3 py-1 text-xs font-extrabold text-choco-soft">Demo listing</span>}</div>
          <dl className="mt-4 grid grid-cols-2 gap-3">
            {facts.map(([k, v]) => <div key={k} className="rounded-2xl bg-white p-3 shadow-soft"><dt className="text-xs font-extrabold uppercase tracking-wide text-choco-soft">{k}</dt><dd className="font-bold">{k === 'Location' ? <span className="flex items-center gap-1"><MapPin size={14} />{v}</span> : v}</dd></div>)}
          </dl>
          <h2 className="mb-1 mt-6 text-xl font-semibold">About {pet.name}</h2>
          <p className="leading-relaxed">{pet.description}</p>
          <h2 className="mb-1 mt-6 text-xl font-semibold">Adoption requirements</h2>
          <p className="rounded-2xl bg-beige p-4 text-sm leading-relaxed">{pet.requirements}</p>
        </div>
      </div>

      <section id="apply" className="card mx-auto mt-10 max-w-3xl scroll-mt-28 p-6 sm:p-8" aria-label="Apply to adopt">
        <h2 className="text-2xl font-semibold">Apply to adopt {pet.name}</h2>
        {pet.status === 'ADOPTED' ? (
          <p className="mt-3 text-choco-soft">{pet.name} has found a home. <Link to="/adoption" className="font-extrabold text-link hover:underline">Meet other pets looking for a family →</Link></p>
        ) : !user ? (
          <div className="mt-3"><p className="text-choco-soft">Please log in or create an account to apply, so we can keep you updated.</p>
            <div className="mt-4 flex gap-3"><Link to={`/login?next=${encodeURIComponent(`/adoption/${pet.id}`)}`} className="btn">Log in</Link><Link to={`/register?next=${encodeURIComponent(`/adoption/${pet.id}`)}`} className="btn btn-ghost">Create account</Link></div></div>
        ) : mine ? (
          <div className="mt-4 rounded-2xl bg-softgreen p-5">
            <p className="flex items-center gap-2 font-extrabold text-green-900"><CheckCircle2 size={20} />You've applied for {pet.name}</p>
            <p className="mt-2 flex items-center gap-2 text-sm">Status: <Pill value={mine.status} /> <span className="text-choco-soft">Submitted {formatDate(mine.createdAt)}</span></p>
            {mine.adminNote && <p className="mt-2 text-sm"><b>Note from our team:</b> {mine.adminNote}</p>}
            <Link to="/account/adoption-applications" className="mt-3 inline-block text-sm font-extrabold text-link hover:underline">View all my applications</Link>
          </div>
        ) : (
          <div className="mt-5"><ApplyForm pet={pet} onDone={() => setRk((n) => n + 1)} /></div>
        )}
      </section>
    </div>
  );
}

export function ApplicationsPage() {
  const { data, error } = useApi<MyApplication[]>('/account/adoption-applications');
  return (
    <div>
      <h1 className="mb-1 text-3xl font-bold">Adoption Applications</h1>
      <p className="mb-5 text-sm text-choco-soft">Follow the progress of your applications. Our team reviews each one personally.</p>
      {error && <EmptyState title="Couldn't load your applications" text={error} />}
      {data?.length === 0 && <EmptyState title="No applications yet" text="When you apply to adopt a pet, you can follow it here." action={<Link to="/adoption" className="btn btn-sm">Meet adoptable pets</Link>} />}
      {!data && !error && <div className="skeleton h-32" />}
      <ul className="space-y-3">
        {data?.map((a) => (
          <li key={a.id} className="card flex gap-4 p-4">
            {a.pet.photoUrl ? <img src={a.pet.photoUrl} alt="" className="h-24 w-24 shrink-0 rounded-2xl bg-[#FDEEE3] object-cover" /> : <div className="h-24 w-24 shrink-0 rounded-2xl bg-[#FDEEE3]" />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2"><Link to={`/adoption/${a.pet.id}`} className="font-display text-xl font-semibold hover:text-primary">{a.pet.name}</Link><Pill value={a.status} /></div>
              <p className="text-sm text-choco-soft">{a.pet.species} · {a.pet.breed}</p>
              <p className="text-xs text-choco-soft">Applied {formatDate(a.createdAt)}{a.updatedAt !== a.createdAt && ` · updated ${formatDate(a.updatedAt)}`}</p>
              {a.adminNote && <p className="mt-2 rounded-xl bg-beige p-2 text-sm"><b>Note from our team:</b> {a.adminNote}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
