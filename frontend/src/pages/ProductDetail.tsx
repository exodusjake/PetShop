import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Heart, Minus, Plus, RotateCcw, ShieldCheck, ShoppingCart, Truck } from 'lucide-react';
import { useApi } from '../lib/api';
import type { ProductDetail as PD } from '../lib/types';
import { formatDate, formatPeso } from '../lib/format';
import { useShop } from '../context/Shop';
import ProductCard from '../components/ProductCard';
import { EmptyState, Stars } from '../components/ui';
import ReviewBox from '../components/ReviewBox';

export default function ProductDetail() {
  const { productSlug } = useParams();
  const nav = useNavigate();
  const [rk, setRk] = useState(0); // bumped after a review is posted so the page reloads
  const { data: p, error, loading } = useApi<PD>(productSlug ? `/catalog/products/${productSlug}?_r=${rk}` : null);
  const { addToCart, wishlist, toggleWish } = useShop();
  const [img, setImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [variantId, setVariantId] = useState<number | null>(null);

  useEffect(() => { setImg(0); setQty(1); setVariantId(null); }, [productSlug]);

  if (loading) return <div className="container-x grid gap-8 py-10 md:grid-cols-2" aria-busy="true"><h1 className="sr-only">Loading product</h1><div className="skeleton aspect-square" /><div className="space-y-4"><div className="skeleton h-10 w-3/4" /><div className="skeleton h-6 w-1/3" /><div className="skeleton h-32" /></div></div>;
  if (error || !p) return <div className="container-x py-12"><EmptyState title="Product not found" text="This product may have been removed." action={<Link to="/shop" className="btn btn-sm">Back to shop</Link>} /></div>;

  const variant = p.variants.find((v) => v.id === variantId) ?? null;
  const needsVariant = p.variants.length > 0;
  const stock = variant ? variant.stock : p.stock;
  const unit = p.effectivePrice + (variant?.priceDelta ?? 0);
  const liked = wishlist.has(p.id);
  const images = p.images.length ? p.images : [{ url: p.image ?? '', alt: p.name }];

  const add = async () => {
    if (needsVariant && !variant) return false;
    return addToCart(p, qty, variant ?? undefined);
  };
  const dist = [5, 4, 3, 2, 1].map((s) => ({ s, n: p.reviews.filter((r) => r.rating === s).length }));

  return (
    <div className="container-x py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs font-semibold text-choco-soft">
        <Link to="/" className="hover:text-primary">Home</Link> / <Link to="/shop" className="hover:text-primary">Shop</Link> /{' '}
        <Link to={`/categories/${p.category.slug}`} className="hover:text-primary">{p.category.name}</Link> / <span className="text-choco">{p.name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <div className="overflow-hidden rounded-4xl bg-[#FDEEE3] shadow-soft">
            <img src={images[img].url} alt={images[img].alt ?? p.name} className="aspect-square w-full object-cover md:aspect-[1.1]" />
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2">{images.map((im, i) => (
              <button key={i} onClick={() => setImg(i)} aria-label={`Image ${i + 1}`} className={`overflow-hidden rounded-xl border-2 ${i === img ? 'border-primary' : 'border-transparent'}`}>
                <img src={im.url} alt="" className="h-16 w-16 object-cover" /></button>
            ))}</div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap gap-2 text-xs font-extrabold">
            <Link to={`/categories/${p.category.slug}`} className="rounded-full bg-peach px-3 py-1 hover:bg-primary hover:text-white">{p.category.name}</Link>
            <Link to={`/shop?pet=${p.petType.slug}`} className="rounded-full bg-softgreen px-3 py-1 hover:bg-primary hover:text-white">{p.petType.name}</Link>
            {p.isDemo && <span className="rounded-full bg-beige px-3 py-1 text-choco-soft">Demo product</span>}
          </div>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{p.name}</h1>
          <p className="mt-1 text-sm font-semibold text-choco-soft">by {p.brand}</p>
          <div className="mt-2 flex items-center gap-3"><Stars value={p.ratingAvg} size={17} /><span className="text-sm font-semibold text-choco-soft">{p.ratingAvg.toFixed(1)} · {p.reviewCount} review{p.reviewCount === 1 ? '' : 's'}</span></div>

          <div className="mt-4 flex items-end gap-3">
            <span className="text-4xl font-extrabold text-primary">{formatPeso(unit)}</span>
            {p.onSale && <><span className="pb-1 text-lg text-choco-soft line-through">{formatPeso(p.price + (variant?.priceDelta ?? 0))}</span>
              <span className="mb-1.5 rounded-full bg-[#EE4F7A] px-3 py-0.5 text-xs font-extrabold text-white">Save {p.discountPercent}%</span></>}
          </div>

          <p className="mt-4 leading-relaxed text-choco/90">{p.description}</p>

          {needsVariant && (
            <div className="mt-5">
              <label htmlFor="variant" className="mb-1 block text-sm font-extrabold">Option</label>
              <select id="variant" className="input !w-auto min-w-[200px]" value={variantId ?? ''} onChange={(e) => { setVariantId(e.target.value ? Number(e.target.value) : null); setQty(1); }}>
                <option value="">Select an option…</option>
                {p.variants.map((v) => <option key={v.id} value={v.id} disabled={v.stock <= 0}>{v.name}{v.priceDelta ? ` (+${formatPeso(v.priceDelta)})` : ''}{v.stock <= 0 ? ' – sold out' : ''}</option>)}
              </select>
            </div>
          )}

          <p className={`mt-4 text-sm font-extrabold ${stock <= 0 ? 'text-red-600' : p.lowStock ? 'text-primary' : 'text-green-700'}`}>
            {stock <= 0 ? 'Out of stock' : p.lowStock ? `Only ${stock} left in stock!` : `In stock (${stock} available)`}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-full border-2 border-peach bg-white" role="group" aria-label="Quantity">
              <button className="grid h-11 w-11 place-items-center rounded-full hover:bg-peach disabled:opacity-40" disabled={qty <= 1} onClick={() => setQty(qty - 1)} aria-label="Decrease quantity"><Minus size={16} /></button>
              <span className="w-10 text-center font-extrabold" aria-live="polite">{qty}</span>
              <button className="grid h-11 w-11 place-items-center rounded-full hover:bg-peach disabled:opacity-40" disabled={qty >= stock} onClick={() => setQty(qty + 1)} aria-label="Increase quantity"><Plus size={16} /></button>
            </div>
            <button className="btn" disabled={stock <= 0 || (needsVariant && !variant)} onClick={() => add()}><ShoppingCart size={18} /> Add to Cart</button>
            <button className="btn btn-ghost" disabled={stock <= 0 || (needsVariant && !variant)} onClick={async () => { if (await add()) nav('/checkout'); }}>Buy Now</button>
            <button onClick={() => toggleWish(p)} aria-pressed={liked} aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'}
              className={`grid h-12 w-12 place-items-center rounded-full border-2 border-peach bg-white transition hover:scale-105 ${liked ? 'text-[#E0405F]' : ''}`}><Heart size={20} fill={liked ? 'currentColor' : 'none'} /></button>
          </div>
          {needsVariant && !variant && <p className="mt-2 text-xs font-semibold text-choco-soft">Please choose an option first.</p>}

          <ul className="mt-6 grid gap-2 rounded-2xl bg-white/70 p-4 text-sm font-semibold sm:grid-cols-3">
            <li className="flex items-center gap-2"><Truck size={18} className="text-primary" />Fast delivery</li>
            <li className="flex items-center gap-2"><RotateCcw size={18} className="text-primary" />7-day returns</li>
            <li className="flex items-center gap-2"><ShieldCheck size={18} className="text-primary" />Safe checkout</li>
          </ul>
        </div>
      </div>

      <section className="mt-12" aria-labelledby="reviews-h">
        <h2 id="reviews-h" className="mb-4 text-2xl font-semibold">Customer Reviews</h2>
        <ReviewBox slug={p.slug} onPosted={() => setRk((n) => n + 1)} />
        {p.reviews.length === 0 ? <EmptyState title="No reviews yet" text="Be the first to review this product after your purchase." /> : (
          <div className="grid gap-6 md:grid-cols-[260px_1fr]">
            <div className="card h-fit p-5">
              <div className="text-5xl font-extrabold">{p.ratingAvg.toFixed(1)}</div><Stars value={p.ratingAvg} size={18} />
              <p className="mt-1 text-sm text-choco-soft">{p.reviewCount} review{p.reviewCount === 1 ? '' : 's'}</p>
              <div className="mt-3 space-y-1">{dist.map(({ s, n }) => (
                <div key={s} className="flex items-center gap-2 text-xs font-bold"><span className="w-3">{s}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-peach"><div className="h-full rounded-full bg-[#F5A623]" style={{ width: `${(n / p.reviews.length) * 100}%` }} /></div><span className="w-4 text-right">{n}</span></div>
              ))}</div>
            </div>
            <ul className="space-y-3">{p.reviews.map((r) => (
              <li key={r.id} className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2"><Stars value={r.rating} /><span className="text-xs text-choco-soft">{formatDate(r.createdAt)}</span></div>
                <p className="mt-2 text-sm leading-relaxed">{r.body}</p>
                <p className="mt-2 text-xs font-bold text-choco-soft">{r.author}{r.isDemo && <span className="ml-2 rounded-full bg-peach px-2 py-0.5 text-[10px] uppercase text-choco">Demo review</span>}</p>
              </li>
            ))}</ul>
          </div>
        )}
      </section>

      {p.related.length > 0 && (
        <section className="mt-12" aria-labelledby="rel-h">
          <h2 id="rel-h" className="mb-4 text-2xl font-semibold">You May Also Like</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{p.related.map((r) => <ProductCard key={r.id} p={r} />)}</div>
        </section>
      )}
    </div>
  );
}
