import { useState, type FormEvent } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../context/Toast';

export default function Newsletter() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ message: string }>('/catalog/newsletter', { method: 'POST', json: { email } });
      toast(r.message);
      setEmail('');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
    setBusy(false);
  };

  return (
    <section className="mt-16 bg-gradient-to-r from-[#B8532A] to-[#D9743A] text-white [border-radius:50%_50%_0_0/32px_32px_0_0]">
      <div className="container-x flex flex-col items-center justify-between gap-6 py-9 lg:flex-row">
        <div className="flex items-center gap-4">
          <Mail size={52} strokeWidth={1.4} className="shrink-0" />
          <div>
            <h2 className="font-display text-2xl font-semibold sm:text-[28px]">Join the Pawzora Family!</h2>
            <p className="text-sm opacity-95">Get exclusive deals, new arrivals, and pet care tips.</p>
          </div>
        </div>
        <form onSubmit={submit} className="flex w-full max-w-[480px] rounded-full bg-white p-1">
          <label htmlFor="nl-email" className="sr-only">Email address</label>
          <input id="nl-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email address..."
            className="min-w-0 flex-1 bg-transparent px-5 text-sm text-choco outline-none" />
          <button className="btn" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : 'Subscribe'}</button>
        </form>
      </div>
    </section>
  );
}
