import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Clock, Loader2, Mail, MapPin, Phone } from 'lucide-react';
import { ApiError, api, useApi } from '../lib/api';
import type { StoreSettings } from '../lib/types';
import { useAuth } from '../context/Auth';
import { Field, FormError, TextInput, emailField } from '../components/forms';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(120),
  email: emailField,
  subject: z.string().trim().min(2, 'Enter a subject').max(160),
  message: z.string().trim().min(5, 'Write your message (5+ characters)').max(2000),
  website: z.string().optional(), // honeypot: stays empty for real visitors
});
type Form = z.infer<typeof schema>;

export default function Contact() {
  const { user } = useAuth();
  const { data: s } = useApi<StoreSettings>('/catalog/settings');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, setValue, getValues, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { name: user?.fullName ?? '', email: user?.email ?? '' } });
  // the account may finish loading after the form appears: fill in blank fields without overwriting what someone typed
  useEffect(() => {
    if (!user) return;
    if (!getValues('name')) setValue('name', user.fullName);
    if (!getValues('email')) setValue('email', user.email);
  }, [user, getValues, setValue]);

  const submit = handleSubmit(async (v) => {
    setErr(null);
    try { await api('/catalog/contact', { method: 'POST', json: v }); setSent(true); reset(); }
    catch (e) { if (e instanceof ApiError) { for (const [k, m] of Object.entries(e.issues)) if (m[0]) setError(k as keyof Form, { message: m[0] }); setErr(e.message); } else setErr('Something went wrong.'); }
  });

  // contact details come from the admin's Settings; nothing is invented here
  const rows = s ? ([[Mail, s.contact_email], [Phone, s.contact_phone], [MapPin, s.contact_address], [Clock, s.business_hours]] as const).filter(([, v]) => v) : [];

  return (
    <div className="container-x py-10">
      <div className="mb-8 text-center"><h1 className="text-4xl font-bold">Contact Us</h1><p className="mt-2 text-choco-soft">Questions about an order, a product, or adoption? We'd love to hear from you.</p></div>
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[1.4fr_1fr]">
        <section className="card p-6 sm:p-8" aria-label="Send us a message">
          {sent ? (
            <div className="py-8 text-center"><CheckCircle2 size={56} className="mx-auto text-green-600" /><h2 className="mt-3 text-2xl font-semibold">Message sent!</h2><p className="mt-1 text-choco-soft">Thanks for reaching out. We'll reply as soon as we can.</p><button className="btn btn-ghost mt-5" onClick={() => setSent(false)}>Send another message</button></div>
          ) : (
            <form noValidate onSubmit={submit} className="space-y-4">
              <h2 className="text-xl font-semibold">Send us a message</h2>
              <FormError message={err} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="c-name" error={errors.name?.message}><TextInput id="c-name" autoComplete="name" invalid={!!errors.name} {...register('name')} /></Field>
                <Field label="Email" htmlFor="c-email" error={errors.email?.message}><TextInput id="c-email" type="email" autoComplete="email" invalid={!!errors.email} {...register('email')} /></Field>
              </div>
              <Field label="Subject" htmlFor="c-subject" error={errors.subject?.message}><TextInput id="c-subject" invalid={!!errors.subject} {...register('subject')} /></Field>
              <Field label="Message" htmlFor="c-message" error={errors.message?.message}><textarea id="c-message" rows={5} className={`input ${errors.message ? '!border-red-500' : ''}`} {...register('message')} /></Field>
              {/* honeypot: hidden from people and screen readers */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input tabIndex={-1} autoComplete="off" {...register('website')} /></label></div>
              <button className="btn" disabled={isSubmitting}>{isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Send Message'}</button>
            </form>
          )}
        </section>
        <aside className="card h-fit space-y-4 p-6" aria-label="Contact information">
          <h2 className="text-xl font-semibold">Get in touch</h2>
          {rows.length === 0 ? <p className="text-sm text-choco-soft">Use the form and our team will get back to you by email.</p> : rows.map(([Icon, v], i) => <p key={i} className="flex items-start gap-3 text-sm"><Icon size={18} className="mt-0.5 shrink-0 text-primary" /><span className="whitespace-pre-line">{v}</span></p>)}
        </aside>
      </div>
    </div>
  );
}
