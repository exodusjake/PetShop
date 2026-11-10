import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import type { CartData, CartLine } from '../lib/types';
import { formatPeso } from '../lib/format';
import { useShop } from '../context/Shop';
import { EmptyState } from './ui';

export function QtyStepper({ line, compact = false }: { line: CartLine; compact?: boolean }) {
  const { setQty } = useShop();
  const sz = compact ? 'h-8 w-8' : 'h-10 w-10';
  return (
    <div className="flex items-center rounded-full border-2 border-peach bg-white" role="group" aria-label={`Quantity for ${line.name}`}>
      <button className={`grid ${sz} place-items-center rounded-full hover:bg-peach disabled:opacity-40`} disabled={line.quantity <= 1} onClick={() => setQty(line.id, line.quantity - 1)} aria-label="Decrease quantity"><Minus size={14} /></button>
      <span className="w-8 text-center text-sm font-extrabold" aria-live="polite">{line.quantity}</span>
      <button className={`grid ${sz} place-items-center rounded-full hover:bg-peach disabled:opacity-40`} disabled={line.quantity >= line.stock} onClick={() => setQty(line.id, line.quantity + 1)} aria-label="Increase quantity"><Plus size={14} /></button>
    </div>
  );
}

export function LineThumb({ src, alt, size = 'h-16 w-16' }: { src: string | null; alt: string; size?: string }) {
  return src ? <img src={src} alt={alt} className={`${size} shrink-0 rounded-xl bg-[#FDEEE3] object-cover`} /> : <div className={`${size} shrink-0 rounded-xl bg-[#FDEEE3]`} />;
}

export function Totals({ cart, shippingLabel }: { cart: CartData; shippingLabel?: string }) {
  const row = 'flex justify-between text-sm';
  return (
    <dl className="space-y-2">
      <div className={row}><dt>Subtotal</dt><dd className="font-bold">{formatPeso(cart.subtotal)}</dd></div>
      {cart.discount > 0 && <div className={`${row} text-green-700`}><dt>Discount {cart.coupon && <span className="text-xs">({cart.coupon.code})</span>}</dt><dd className="font-bold">−{formatPeso(cart.discount)}</dd></div>}
      <div className={row}><dt>{shippingLabel ?? 'Shipping'}</dt><dd className="font-bold">{cart.shippingFee === 0 ? 'FREE' : formatPeso(cart.shippingFee)}</dd></div>
      <div className="flex justify-between border-t border-peach pt-3 text-lg font-extrabold"><dt>Total</dt><dd className="text-primary">{formatPeso(cart.total)}</dd></div>
    </dl>
  );
}

export function FreeShippingHint({ cart }: { cart: CartData }) {
  const std = cart.shippingOptions.find((o) => o.code === 'STANDARD');
  if (!cart.freeShippingOver || cart.itemCount === 0 || std?.free) return null;
  const left = cart.freeShippingOver - (cart.subtotal - cart.discount);
  if (left <= 0) return null;
  return <p className="rounded-xl bg-softgreen px-3 py-2 text-xs font-bold text-green-900">Add {formatPeso(left)} more for free standard shipping!</p>;
}

export function CartDrawer() {
  const { cart, cartOpen, setCartOpen, removeLine } = useShop();
  useEffect(() => {
    if (!cartOpen) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setCartOpen(false); };
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = ''; };
  }, [cartOpen, setCartOpen]);
  const close = () => setCartOpen(false);

  return (
    <AnimatePresence>
      {cartOpen && (
        <>
          <motion.div className="fixed inset-0 z-[60] bg-choco/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
          <motion.aside role="dialog" aria-modal="true" aria-label="Shopping cart" className="fixed inset-y-0 right-0 z-[61] flex w-[400px] max-w-[92vw] flex-col bg-cream shadow-lift"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.22 }}>
            <div className="flex items-center justify-between border-b border-peach px-5 py-4">
              <h2 className="text-xl font-semibold">Your Cart {cart && cart.itemCount > 0 && <span className="text-sm text-choco-soft">({cart.itemCount})</span>}</h2>
              <button onClick={close} aria-label="Close cart" className="rounded-full p-2 hover:bg-peach"><X size={20} /></button>
            </div>

            {!cart || cart.lines.length === 0 ? (
              <div className="flex-1 p-5"><EmptyState title="Your cart is empty" text="Add something your furry friend will love." action={<Link to="/shop" onClick={close} className="btn btn-sm">Start shopping</Link>} /></div>
            ) : (
              <>
                <ul className="flex-1 space-y-3 overflow-y-auto p-5">
                  {cart.lines.map((l) => (
                    <li key={l.id} className="card flex gap-3 p-3">
                      <LineThumb src={l.image} alt="" />
                      <div className="min-w-0 flex-1">
                        <Link to={`/shop/${l.slug}`} onClick={close} className="line-clamp-2 text-sm font-extrabold leading-tight hover:text-primary">{l.name}</Link>
                        {l.variantName && <p className="text-xs text-choco-soft">{l.variantName}</p>}
                        {l.issue && <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-red-600"><AlertTriangle size={12} />{l.issue}</p>}
                        <div className="mt-2 flex items-center justify-between">
                          {l.quantity > 0 ? <QtyStepper line={l} compact /> : <span />}
                          <span className="text-sm font-extrabold">{formatPeso(l.lineTotal || l.unitPrice)}</span>
                        </div>
                      </div>
                      <button onClick={() => removeLine(l.id)} aria-label={`Remove ${l.name}`} className="self-start rounded-full p-1.5 text-choco-soft hover:bg-peach hover:text-red-600"><Trash2 size={16} /></button>
                    </li>
                  ))}
                </ul>
                <div className="space-y-3 border-t border-peach bg-white p-5">
                  <FreeShippingHint cart={cart} />
                  <div className="flex justify-between text-base font-extrabold"><span>Subtotal</span><span>{formatPeso(cart.subtotal)}</span></div>
                  <p className="text-xs text-choco-soft">Shipping and discounts are calculated at checkout.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Link to="/cart" onClick={close} className="btn btn-ghost">View Cart</Link>
                    <Link to="/checkout" onClick={close} className="btn">Checkout</Link>
                  </div>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export function ConfirmationModal({ open, title, children, confirmLabel, cancelLabel = 'Keep it', danger = false, busy = false, onConfirm, onClose }: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string; cancelLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-choco/50" onClick={onClose} />
          <motion.div role="alertdialog" aria-modal="true" aria-label={title} className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-lift"
            initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}>
            <div className="mb-3 flex items-center gap-3"><span className={`grid h-10 w-10 place-items-center rounded-full ${danger ? 'bg-red-100 text-red-600' : 'bg-peach text-primary'}`}><ShoppingBag size={20} /></span><h2 className="text-xl font-semibold">{title}</h2></div>
            <div className="text-sm text-choco-soft">{children}</div>
            <div className="mt-6 flex justify-end gap-3">
              <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>{cancelLabel}</button>
              <button className={`btn btn-sm ${danger ? '!bg-red-600 hover:!bg-red-700' : ''}`} onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : confirmLabel}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
