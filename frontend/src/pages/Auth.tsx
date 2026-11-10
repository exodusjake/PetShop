import { useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { ApiError, api } from '../lib/api';
import { useAuth } from '../context/Auth';
import { useToast } from '../context/Toast';
import { Logo } from '../components/ui';
import { safeNext } from '../lib/safeNext';
import { Field, FormError, PasswordInput, StrengthMeter, TextInput, emailField, passwordField } from '../components/forms';

/** Only allow same-site relative redirects (prevents open-redirect abuse of ?next=). */

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-peach/60 to-cream px-4 py-10 sm:py-14">
      <img src="/img/pet-dogs.png" alt="" aria-hidden="true" className="pointer-events-none absolute -bottom-2 left-0 hidden w-48 rounded-3xl opacity-90 [mask-image:linear-gradient(90deg,#000_60%,transparent)] lg:block" />
      <img src="/img/pet-cats.png" alt="" aria-hidden="true" className="pointer-events-none absolute -bottom-2 right-0 hidden w-48 rounded-3xl opacity-90 [mask-image:linear-gradient(270deg,#000_60%,transparent)] lg:block" />
      <div className="relative mx-auto w-full max-w-[440px] rounded-4xl bg-white/90 p-7 shadow-lift sm:p-9">
        <div className="mb-4 flex justify-center"><Logo className="h-20" /></div>
        <h1 className="text-center text-3xl font-bold">{title}</h1>
        <p className="mb-6 mt-1 text-center text-sm text-choco-soft">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

const Submit = ({ busy, children }: { busy: boolean; children: ReactNode }) => (
  <button className="btn w-full" disabled={busy}>{busy ? <Loader2 size={18} className="animate-spin" /> : children}</button>
);

/** Copy server-side field errors (e.g. "email already registered") onto the matching form fields. */
function applyServerErrors(e: unknown, setError: (n: any, o: { message: string }) => void, fields: string[]) {
  if (e instanceof ApiError) {
    let placed = false;
    for (const [k, msgs] of Object.entries(e.issues)) if (fields.includes(k) && msgs[0]) { setError(k, { message: msgs[0] }); placed = true; }
    return placed ? null : e.message;
  }
  return 'Something went wrong. Please try again.';
}

// ───────────── Login ─────────────
const loginSchema = z.object({ email: emailField, password: z.string().min(1, 'Enter your password'), remember: z.boolean().optional() });

export function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [sp] = useSearchParams();
  const next = safeNext(sp.get('next') ?? (loc.state as { from?: string } | null)?.from ?? null);
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { remember: true } });

  const landing = (role?: string) => (next === '/' && role === 'ADMIN' ? '/admin' : next);
  if (user) return <Navigate to={landing(user.role)} replace />;

  return (
    <Shell title="Welcome Back!" subtitle="Sign in to your Pawzora account.">
      <form noValidate className="space-y-4" onSubmit={handleSubmit(async (v) => {
        setErr(null);
        try { const u = await login(v.email, v.password, !!v.remember); nav(landing(u.role), { replace: true }); }
        catch (e) { setErr((e as Error).message); }
      })}>
        <FormError message={err} />
        <Field label="Email Address" htmlFor="email" error={errors.email?.message}>
          <TextInput id="email" type="email" autoComplete="email" placeholder="Enter your email" invalid={!!errors.email} {...register('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <PasswordInput id="password" autoComplete="current-password" placeholder="Enter your password" invalid={!!errors.password} {...register('password')} />
        </Field>
        <div className="flex items-center justify-between text-sm">
          <label className="flex cursor-pointer items-center gap-2 font-semibold"><input type="checkbox" className="accent-primary" {...register('remember')} /> Remember me</label>
          <Link to="/forgot-password" className="font-extrabold text-link hover:underline">Forgot password?</Link>
        </div>
        <Submit busy={isSubmitting}>Sign In</Submit>
      </form>
      <p className="mt-6 text-center text-sm">Don't have an account? <Link to={`/register${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-extrabold text-link hover:underline">Sign Up</Link></p>
    </Shell>
  );
}

// ───────────── Register ─────────────
const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(120),
  email: emailField, password: passwordField, confirm: z.string().min(1, 'Confirm your password'),
  acceptTerms: z.boolean().refine((v) => v, 'You must accept the Terms and Conditions'),
}).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export function Register() {
  const { user, register: signUp } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const next = safeNext(sp.get('next'));
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, watch, setError, formState: { errors, isSubmitting } } = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema), defaultValues: { acceptTerms: false } });
  const pw = watch('password') ?? '';

  if (user) return <Navigate to={next} replace />;

  return (
    <Shell title="Create an Account" subtitle="Join Pawzora and give your pets the best!">
      <form noValidate className="space-y-4" onSubmit={handleSubmit(async (v) => {
        setErr(null);
        try { await signUp({ fullName: v.fullName, email: v.email, password: v.password, acceptTerms: true }); nav(next, { replace: true }); }
        catch (e) { setErr(applyServerErrors(e, setError, ['email', 'password', 'fullName'])); }
      })}>
        <FormError message={err} />
        <Field label="Full Name" htmlFor="fullName" error={errors.fullName?.message}>
          <TextInput id="fullName" autoComplete="name" placeholder="Enter your full name" invalid={!!errors.fullName} {...register('fullName')} />
        </Field>
        <Field label="Email Address" htmlFor="email" error={errors.email?.message}>
          <TextInput id="email" type="email" autoComplete="email" placeholder="Enter your email" invalid={!!errors.email} {...register('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters with a letter and a number.">
          <PasswordInput id="password" autoComplete="new-password" placeholder="Create a password" invalid={!!errors.password} {...register('password')} />
          <StrengthMeter password={pw} />
        </Field>
        <Field label="Confirm Password" htmlFor="confirm" error={errors.confirm?.message}>
          <PasswordInput id="confirm" autoComplete="new-password" placeholder="Re-enter your password" invalid={!!errors.confirm} {...register('confirm')} />
        </Field>
        <div>
          <label className="flex cursor-pointer items-start gap-2 text-sm font-semibold">
            <input type="checkbox" className="mt-1 accent-primary" {...register('acceptTerms')} />
            <span>I agree to the <Link to="/terms" className="font-extrabold text-link hover:underline">Terms and Conditions</Link> and <Link to="/privacy" className="font-extrabold text-link hover:underline">Privacy Policy</Link>.</span>
          </label>
          {errors.acceptTerms && <p role="alert" className="mt-1 text-xs font-bold text-red-600">{errors.acceptTerms.message}</p>}
        </div>
        <Submit busy={isSubmitting}>Sign Up</Submit>
      </form>
      <p className="mt-6 text-center text-sm">Already have an account? <Link to="/login" className="font-extrabold text-link hover:underline">Sign In</Link></p>
    </Shell>
  );
}

// ───────────── Forgot / reset password ─────────────
export function ForgotPassword() {
  const [done, setDone] = useState<{ message: string; devLink?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>({ resolver: zodResolver(z.object({ email: emailField })) });
  return (
    <Shell title="Forgot Password?" subtitle="Enter your email and we'll send you a reset link.">
      {done ? (
        <div className="space-y-4 text-center">
          <p className="rounded-xl bg-softgreen px-4 py-3 text-sm font-bold text-green-900">{done.message}</p>
          {done.devLink && <p className="rounded-xl bg-peach/60 p-3 text-xs">Development only (email is not set up yet): <a className="break-all font-extrabold text-link underline" href={done.devLink}>open reset link</a></p>}
          <Link to="/login" className="btn btn-ghost w-full">Back to sign in</Link>
        </div>
      ) : (
        <form noValidate className="space-y-4" onSubmit={handleSubmit(async (v) => {
          setErr(null);
          try { const r = await api<{ message: string; devResetLink?: string }>('/auth/forgot-password', { method: 'POST', json: v }); setDone({ message: r.message, devLink: r.devResetLink }); }
          catch (e) { setErr((e as Error).message); }
        })}>
          <FormError message={err} />
          <Field label="Email Address" htmlFor="email" error={errors.email?.message}>
            <TextInput id="email" type="email" autoComplete="email" placeholder="Enter your email" invalid={!!errors.email} {...register('email')} />
          </Field>
          <Submit busy={isSubmitting}>Send Reset Link</Submit>
          <p className="text-center text-sm"><Link to="/login" className="font-extrabold text-link hover:underline">Back to sign in</Link></p>
        </form>
      )}
    </Shell>
  );
}

const resetSchema = z.object({ password: passwordField, confirm: z.string().min(1, 'Confirm your password') })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export function ResetPassword() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { toast } = useToast();
  const token = sp.get('token') ?? '';
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });
  return (
    <Shell title="Reset Password" subtitle="Choose a new password for your account.">
      {!token ? (
        <div className="space-y-4 text-center"><FormError message="This reset link is missing its token." /><Link to="/forgot-password" className="btn w-full">Request a new link</Link></div>
      ) : (
        <form noValidate className="space-y-4" onSubmit={handleSubmit(async (v) => {
          setErr(null);
          try { await api('/auth/reset-password', { method: 'POST', json: { token, password: v.password } }); toast('Password updated. Please sign in.'); nav('/login', { replace: true }); }
          catch (e) { setErr((e as Error).message); }
        })}>
          <FormError message={err} />
          <Field label="New Password" htmlFor="password" error={errors.password?.message}>
            <PasswordInput id="password" autoComplete="new-password" invalid={!!errors.password} {...register('password')} />
            <StrengthMeter password={watch('password') ?? ''} />
          </Field>
          <Field label="Confirm New Password" htmlFor="confirm" error={errors.confirm?.message}>
            <PasswordInput id="confirm" autoComplete="new-password" invalid={!!errors.confirm} {...register('confirm')} />
          </Field>
          <Submit busy={isSubmitting}>Update Password</Submit>
        </form>
      )}
    </Shell>
  );
}
