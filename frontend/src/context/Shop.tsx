// Cart: lives on the server (guest cookie, merged into the account at login). Every price shown comes from the API.
// Wishlist: guests use localStorage; logged-in users use the database, and the guest list is merged in at login.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CartData, Product } from '../lib/types';
import { useToast } from './Toast';
import { useAuth } from './Auth';
import { api } from '../lib/api';

interface ShopCtx {
  cart: CartData | null; cartCount: number; cartOpen: boolean; setCartOpen: (o: boolean) => void;
  addToCart: (p: Product, qty?: number, variant?: { id: number }) => Promise<boolean>;
  setQty: (lineId: number, qty: number) => Promise<void>;
  removeLine: (lineId: number) => Promise<void>;
  applyCoupon: (code: string) => Promise<string | null>;
  removeCoupon: () => Promise<void>;
  refreshCart: () => Promise<void>;
  wishlist: Set<number>; toggleWish: (p: Product) => void;
}
const Ctx = createContext<ShopCtx>(null as never);
export const useShop = () => useContext(Ctx);

function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function save(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } }

export function ShopProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [cart, setCart] = useState<CartData | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [wish, setWish] = useState<number[]>(() => load('pz_wish', []));
  const uid = user?.id ?? null;
  const prevUid = useRef<number | null>(null);

  // ── cart: (re)load when auth state settles or changes (login merges the guest cart on the server)
  const refreshCart = useCallback(async () => {
    try { setCart(await api<CartData>('/cart')); } catch { /* keep the previous cart */ }
  }, []);
  useEffect(() => {
    if (authLoading) return;
    (async () => {
      // one-time migration of a cart saved by an older version of the site in this browser
      const legacy = load<{ productId: number; variantId: number | null; qty: number }[]>('pz_cart', []);
      if (legacy.length) {
        for (const l of legacy) { try { await api('/cart/items', { method: 'POST', json: { productId: l.productId, variantId: l.variantId, quantity: l.qty } }); } catch { /* skip */ } }
        try { localStorage.removeItem('pz_cart'); } catch { /* ignore */ }
      }
      await refreshCart();
    })();
  }, [uid, authLoading, refreshCart]);

  const run = useCallback(async (fn: () => Promise<CartData>) => {
    try { setCart(await fn()); return null; } catch (e) { return (e as Error).message; }
  }, []);

  const addToCart: ShopCtx['addToCart'] = useCallback(async (p, qty = 1, variant) => {
    const err = await run(() => api<CartData>('/cart/items', { method: 'POST', json: { productId: p.id, variantId: variant?.id ?? null, quantity: qty } }));
    if (err) { toast(err, 'error'); return false; }
    toast(`Added "${p.name}" to your cart`);
    return true;
  }, [run, toast]);

  const setQty: ShopCtx['setQty'] = useCallback(async (lineId, qty) => {
    const err = await run(() => api<CartData>(`/cart/items/${lineId}`, { method: 'PATCH', json: { quantity: qty } }));
    if (err) toast(err, 'error');
  }, [run, toast]);
  const removeLine: ShopCtx['removeLine'] = useCallback(async (lineId) => { await run(() => api<CartData>(`/cart/items/${lineId}`, { method: 'DELETE' })); }, [run]);
  const applyCoupon: ShopCtx['applyCoupon'] = useCallback((code) => run(() => api<CartData>('/cart/coupon', { method: 'POST', json: { code } })), [run]);
  const removeCoupon: ShopCtx['removeCoupon'] = useCallback(async () => { await run(() => api<CartData>('/cart/coupon', { method: 'DELETE' })); }, [run]);

  // ── wishlist
  useEffect(() => { if (!user) save('pz_wish', wish); }, [wish, user]);
  useEffect(() => {
    if (authLoading) return;
    if (uid) {
      api<number[]>('/wishlist/merge', { method: 'POST', json: { productIds: wish } }).then((ids) => { setWish(ids); save('pz_wish', []); }).catch(() => {});
    } else if (prevUid.current) {
      // just logged out: don't leave the previous user's wishlist on this device
      setWish([]);
      save('pz_wish', []);
    }
    prevUid.current = uid;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, authLoading]);

  const toggleWish = useCallback((p: Product) => {
    const has = wish.includes(p.id);
    setWish(has ? wish.filter((x) => x !== p.id) : [...wish, p.id]);
    toast(has ? `Removed "${p.name}" from your wishlist` : `Saved "${p.name}" to your wishlist`);
    if (user) {
      api(`/wishlist/${p.id}`, { method: has ? 'DELETE' : 'PUT' }).catch(() => {
        setWish((w) => (has ? [...w, p.id] : w.filter((x) => x !== p.id))); // roll back
        toast('Could not update your wishlist. Please try again.', 'error');
      });
    }
  }, [wish, toast, user]);

  const value = useMemo<ShopCtx>(() => ({
    cart, cartCount: cart?.itemCount ?? 0, cartOpen, setCartOpen,
    addToCart, setQty, removeLine, applyCoupon, removeCoupon, refreshCart, wishlist: new Set(wish), toggleWish,
  }), [cart, cartOpen, addToCart, setQty, removeLine, applyCoupon, removeCoupon, refreshCart, wish, toggleWish]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
