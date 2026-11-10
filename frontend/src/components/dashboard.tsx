import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, X } from 'lucide-react';
import { uploadImage } from '../lib/api';
import { useToast } from '../context/Toast';

/** Appends a counter to a path so useApi() re-fetches after a change. */
export function useReload() {
  const [n, setN] = useState(0);
  return { n, reload: () => setN((x) => x + 1), withKey: (path: string) => `${path}${path.includes('?') ? '&' : '?'}_r=${n}` };
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-3xl font-bold">{title}</h1>{subtitle && <p className="text-sm text-choco-soft">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon, tone = 'peach' }: { label: string; value: ReactNode; hint?: string; icon: ReactNode; tone?: 'peach' | 'green' | 'red' | 'blue' }) {
  const tones = { peach: 'bg-peach text-primary', green: 'bg-softgreen text-green-700', red: 'bg-red-100 text-red-600', blue: 'bg-blue-100 text-blue-700' };
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tones[tone]}`}>{icon}</span>
      <div className="min-w-0"><p className="truncate text-2xl font-extrabold">{value}</p><p className="text-sm font-bold text-choco-soft">{label}</p>{hint && <p className="text-xs text-choco-soft">{hint}</p>}</div>
    </div>
  );
}

export interface Column<T> { header: string; cell: (row: T) => ReactNode; className?: string }

export function DataTable<T>({ columns, rows, rowKey, empty = 'Nothing here yet.', loading, compact = false, label }: { columns: Column<T>[]; rows: T[] | null; rowKey: (r: T) => string | number; empty?: string; loading?: boolean; compact?: boolean; label?: string }) {
  return (
    <div className="card relative overflow-x-auto" tabIndex={0} role="region" aria-label={`${label ?? columns.map((c) => c.header).filter(Boolean).slice(0, 3).join(", ")} table (scrollable)`}>
      <table className={`w-full ${compact ? '' : 'min-w-[640px]'} text-left text-sm`}>
        <thead><tr className="border-b border-peach text-xs font-extrabold uppercase tracking-wide text-choco-soft">{columns.map((c) => <th key={c.header} scope="col" className={`px-4 py-3 ${c.className ?? ''}`}>{c.header || <span className="sr-only">Actions</span>}</th>)}</tr></thead>
        <tbody className={loading && rows ? 'opacity-60' : ''}>
          {!rows && Array.from({ length: 5 }, (_, i) => <tr key={i}><td colSpan={columns.length} className="px-4 py-3"><div className="skeleton h-6" /></td></tr>)}
          {rows?.length === 0 && <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-choco-soft">{empty}</td></tr>}
          {rows?.map((r) => <tr key={rowKey(r)} className="border-b border-peach/60 last:border-0 hover:bg-cream/60">{columns.map((c) => <td key={c.header} className={`px-4 py-3 align-middle ${c.className ?? ''}`}>{c.cell(r)}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({ page, totalPages, total, onPage }: { page: number; totalPages: number; total?: number; onPage: (p: number) => void }) {
  if (totalPages <= 1 && !total) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <span className="text-choco-soft">{total !== undefined ? `${total} result${total === 1 ? '' : 's'}` : ''}</span>
      <div className="flex items-center gap-2">
        <button className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-soft disabled:opacity-40" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
        <span className="font-bold">Page {page} of {totalPages}</span>
        <button className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-soft disabled:opacity-40" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

export function Modal({ open, title, onClose, children, wide = false }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = ''; };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="fixed inset-0 bg-choco/50" onClick={onClose} />
          <motion.div role="dialog" aria-modal="true" aria-label={title} className={`relative my-6 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-3xl bg-white p-6 shadow-lift`} initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">{title}</h2><button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-peach"><X size={18} /></button></div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const PILL: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800', CONFIRMED: 'bg-blue-100 text-blue-800', PROCESSING: 'bg-indigo-100 text-indigo-800', SHIPPED: 'bg-purple-100 text-purple-800',
  DELIVERED: 'bg-green-100 text-green-800', CANCELLED: 'bg-gray-200 text-gray-700', UNPAID: 'bg-orange-100 text-orange-800', PAID: 'bg-green-100 text-green-800',
  FAILED: 'bg-gray-200 text-gray-700', REFUNDED: 'bg-blue-100 text-blue-800', ACTIVE: 'bg-green-100 text-green-800', SUSPENDED: 'bg-red-100 text-red-700',
  LOW: 'bg-orange-100 text-orange-800', UNDER_REVIEW: 'bg-indigo-100 text-indigo-800', APPROVED: 'bg-green-100 text-green-800', REJECTED: 'bg-red-100 text-red-700', AVAILABLE: 'bg-green-100 text-green-800', ADOPTED: 'bg-gray-200 text-gray-700', READ: 'bg-gray-100 text-gray-600', SCHEDULED: 'bg-blue-100 text-blue-800', EXPIRED: 'bg-gray-200 text-gray-700', DISABLED: 'bg-gray-200 text-gray-700', USED_UP: 'bg-gray-200 text-gray-700', HIDDEN: 'bg-gray-200 text-gray-700', PUBLISHED: 'bg-green-100 text-green-800', OUT: 'bg-red-100 text-red-700', OK: 'bg-green-100 text-green-800', ARCHIVED: 'bg-gray-200 text-gray-700', DRAFT: 'bg-gray-200 text-gray-700',
};
export const Pill = ({ value, label }: { value: string; label?: string }) => (
  <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-extrabold ${PILL[value] ?? 'bg-gray-100 text-gray-700'}`}>{label ?? value.charAt(0) + value.slice(1).toLowerCase().replace('_', ' ')}</span>
);

/** Upload one or more images. `max` = 1 behaves as a single photo picker. */
export function ImageUploader({ value, onChange, max = 5, label = 'Images' }: { value: string[]; onChange: (urls: string[]) => void; max?: number; label?: string }) {
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const next = [...value];
    for (const f of Array.from(files).slice(0, max - value.length)) {
      try { next.push(await uploadImage(f)); } catch (e) { toast((e as Error).message, 'error'); }
    }
    onChange(max === 1 ? next.slice(-1) : next);
    setBusy(false);
    if (input.current) input.current.value = '';
  };
  return (
    <div>
      <p className="mb-1 text-sm font-extrabold">{label}</p>
      <div className="flex flex-wrap gap-3">
        {value.map((u, i) => (
          <div key={u} className="relative">
            <img src={u} alt="" className="h-20 w-20 rounded-xl bg-[#FDEEE3] object-cover" />
            {i === 0 && max > 1 && <span className="absolute bottom-1 left-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-extrabold text-white">Main</span>}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== u))} aria-label="Remove image" className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-choco text-white"><X size={12} /></button>
          </div>
        ))}
        {value.length < max && (
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className="grid h-20 w-20 place-items-center rounded-xl border-2 border-dashed border-peach text-choco-soft hover:border-primary hover:text-primary" aria-label="Upload image">
            {busy ? <Loader2 className="animate-spin" size={20} /> : <ImagePlus size={22} />}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple={max > 1} className="hidden" onChange={(e) => pick(e.target.files)} />
      <p className="mt-1 text-xs text-choco-soft">JPEG, PNG or WebP, up to 5 MB each.</p>
    </div>
  );
}
