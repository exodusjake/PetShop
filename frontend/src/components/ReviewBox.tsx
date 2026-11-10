import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Loader2, Star } from 'lucide-react';
import { ApiError, api, useApi } from '../lib/api';
import { useToast } from '../context/Toast';
import { FormError } from './forms';

type Status = { canReview: boolean; reason: 'login' | 'already' | 'not-purchased' | 'ok' };

/** Reviews are for verified purchases only: the server checks the customer has a delivered order with this product. */
export default function ReviewBox({ slug, onPosted }: { slug: string; onPosted: () => void }) {
  const loc = useLocation();
  const { toast } = useToast();
  const [rk, setRk] = useState(0);
  const { data: st } = useApi<Status>(`/catalog/products/${slug}/review-status?_r=${rk}`);
  const [rating, setRating] = useState(0), [hover, setHover] = useState(0), [title, setTitle] = useState(''), [body, setBody] = useState('');
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  if (!st) return null;

  const note = (text: React.ReactNode) => <p className="mb-4 rounded-2xl bg-beige px-4 py-3 text-sm font-semibold text-choco-soft">{text}</p>;
  if (st.reason === 'login') return note(<>Bought this product? <Link to={`/login?next=${encodeURIComponent(loc.pathname)}`} className="font-extrabold text-link underline">Log in</Link> to share your review.</>);
  if (st.reason === 'not-purchased') return note('Only customers who received this product can review it. Reviews help other pet parents.');
  if (st.reason === 'already') return note("Thanks, you've already reviewed this product.");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    if (!rating) { setErr('Choose a star rating.'); return; }
    setBusy(true);
    try { await api(`/catalog/products/${slug}/reviews`, { method: 'POST', json: { rating, title: title || undefined, body } }); toast('Thanks for your review!'); setRk((n) => n + 1); onPosted(); }
    catch (ex) { setErr(ex instanceof ApiError ? ex.message : 'Something went wrong.'); }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="card mb-5 space-y-3 p-5" aria-label="Write a review">
      <h3 className="text-lg font-semibold">Write a review <span className="text-xs font-bold text-green-700">· Verified purchase</span></h3>
      <FormError message={err} />
      <div role="radiogroup" aria-label="Your rating" className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setRating(n)} className="p-0.5">
            <Star size={28} className="text-[#F5A623]" fill={(hover || rating) >= n ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
      <input className="input" placeholder="Headline (optional)" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Review headline" />
      <textarea className="input" rows={4} placeholder="What did you and your pet think?" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Your review" required minLength={10} maxLength={1500} />
      <button className="btn btn-sm" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : 'Submit review'}</button>
    </form>
  );
}
