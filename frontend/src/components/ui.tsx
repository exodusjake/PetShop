import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import type { ReactNode } from 'react';

export function Logo({ className = 'h-12' }: { className?: string }) {
  return <img src="/img/logo.png" alt="Pawzora" className={`w-auto ${className}`} />;
}

export function Paw({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <ellipse cx="5.5" cy="11" rx="2.2" ry="2.8" transform="rotate(-20 5.5 11)" />
      <ellipse cx="9.5" cy="6.2" rx="2.2" ry="3" transform="rotate(-8 9.5 6.2)" />
      <ellipse cx="14.5" cy="6.2" rx="2.2" ry="3" transform="rotate(8 14.5 6.2)" />
      <ellipse cx="18.5" cy="11" rx="2.2" ry="2.8" transform="rotate(20 18.5 11)" />
      <path d="M12 12c-3.2 0-6 3.2-6 5.7 0 1.9 1.6 2.6 3 2.3 1-.2 1.9-.6 3-.6s2 .4 3 .6c1.4.3 3-.4 3-2.3C18 15.2 15.2 12 12 12Z" />
    </svg>
  );
}

export function Stars({ value, size = 14, count }: { value: number; size?: number; count?: number }) {
  return (
    <span role="img" className="inline-flex items-center gap-0.5 text-[#F5A623]" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={value >= i - 0.25 ? 'currentColor' : value >= i - 0.75 ? 'currentColor' : 'none'}
          className={value >= i - 0.25 ? '' : value >= i - 0.75 ? 'opacity-60' : 'text-[#E8CDB5]'} />
      ))}
      {count !== undefined && <span className="ml-1 text-[11px] font-semibold text-choco-soft">({count.toLocaleString()})</span>}
    </span>
  );
}

export function SectionTitle({ children, paw = false }: { children: ReactNode; paw?: boolean }) {
  return (
    <h2 className="section-title">
      {paw && <Paw size={26} className="text-primary-light" />}
      {children}
      {paw && <Paw size={26} className="text-primary-light" />}
    </h2>
  );
}

/** Slide-up when the block appears. Animates on mount (not on scroll) so content can never get stuck invisible.
 *  Honors the user's reduced-motion setting (MotionConfig in main.tsx). */
export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ y: 14 }} animate={{ y: 0 }} transition={{ duration: 0.4, delay: Math.min(delay, 0.15) }}>
      {children}
    </motion.div>
  );
}

export function ProductSkeletons({ n = 5 }: { n?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="card p-2">
          <div className="skeleton aspect-[1.37]" />
          <div className="skeleton mx-2 mt-3 h-4 w-3/4" />
          <div className="skeleton mx-2 mt-2 h-3 w-1/2" />
          <div className="skeleton mx-2 mb-2 mt-3 h-8" />
        </div>
      ))}
    </>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="col-span-full flex flex-col items-center gap-3 rounded-3xl bg-white/70 px-6 py-14 text-center">
      <Paw size={44} className="text-peach" />
      <h2 className="text-xl font-semibold">{title}</h2>
      {text && <p className="max-w-md text-sm text-choco-soft">{text}</p>}
      {action}
    </div>
  );
}
