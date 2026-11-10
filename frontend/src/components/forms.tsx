import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';

export const emailField = z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address');
export const passwordField = z.string().min(8, 'Use at least 8 characters').max(72, 'Use 72 characters or fewer')
  .regex(/[A-Za-z]/, 'Include at least one letter').regex(/[0-9]/, 'Include at least one number');

export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: ReactNode; children: ReactNode; htmlFor: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-extrabold">{label}</label>
      {children}
      {error ? <p role="alert" className="mt-1 text-xs font-bold text-red-600">{error}</p> : hint ? <p className="mt-1 text-xs text-choco-soft">{hint}</p> : null}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  ({ invalid, className = '', ...rest }, ref) => (
    <input ref={ref} aria-invalid={invalid || undefined} className={`input ${invalid ? '!border-red-500' : ''} ${className}`} {...rest} />
  ),
);

export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  ({ invalid, ...rest }, ref) => {
    const [show, setShow] = useState(false);
    return (
      <div className="relative">
        <TextInput ref={ref} invalid={invalid} type={show ? 'text' : 'password'} className="pr-11" {...rest} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-choco-soft hover:text-primary">
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    );
  },
);

export function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

export function StrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const s = strength(password);
  const label = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'][s];
  const color = ['bg-red-500', 'bg-red-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-600'][s];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1">{[1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= s ? color : 'bg-peach'}`} />)}</div>
      <p className="mt-1 text-xs font-bold text-choco-soft">Password strength: {label}</p>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700">{message}</p> : null;
}
