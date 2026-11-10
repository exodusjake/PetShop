import { Link } from 'react-router-dom';
import { Heart, ShoppingCart } from 'lucide-react';
import type { Product } from '../lib/types';
import { formatPeso } from '../lib/format';
import { useShop } from '../context/Shop';
import { Stars } from './ui';

export default function ProductCard({ p }: { p: Product }) {
  const { addToCart, wishlist, toggleWish } = useShop();
  const liked = wishlist.has(p.id);
  const badge = p.onSale ? { text: `-${p.discountPercent}%`, cls: 'bg-[#EE4F7A]' }
    : p.isFeatured && p.soldCount > 150 ? { text: 'Bestseller', cls: 'bg-primary' } : null;

  return (
    <article className="card card-hover flex flex-col p-2">
      <div className="relative overflow-hidden rounded-2xl bg-[#FDEEE3]">
        <Link to={`/shop/${p.slug}`} aria-label={p.name}>
          {p.image
            ? <img src={p.image} alt={p.name} loading="lazy" className="aspect-[1.37] w-full object-cover transition duration-300 hover:scale-105" />
            : <div className="aspect-[1.37]" />}
        </Link>
        {badge && <span className={`absolute left-2 top-2 rounded-full px-3 py-1 text-[11px] font-extrabold text-white ${badge.cls}`}>{badge.text}</span>}
        {!p.inStock && <span className="absolute inset-x-0 bottom-0 bg-choco/80 py-1 text-center text-xs font-bold text-white">Out of stock</span>}
        <button onClick={() => toggleWish(p)} aria-pressed={liked} aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'}
          className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/80 backdrop-blur transition hover:scale-110 ${liked ? 'text-[#E0405F]' : 'text-choco'}`}>
          <Heart size={17} fill={liked ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="flex flex-1 flex-col px-2 pb-2 pt-3">
        <Link to={`/shop/${p.slug}`} className="line-clamp-2 min-h-[2.5rem] text-sm font-extrabold leading-tight hover:text-primary">{p.name}</Link>
        <div className="mt-1"><Stars value={p.ratingAvg} size={13} count={p.reviewCount} /></div>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-2 gap-y-2 pt-3">
          <div className="leading-tight">
            <div className="text-lg font-extrabold">{formatPeso(p.effectivePrice)}</div>
            {p.onSale && <div className="text-xs text-choco-soft line-through">{formatPeso(p.price)}</div>}
          </div>
          <button className="btn btn-sm" disabled={!p.inStock} onClick={() => addToCart(p)}>
            <ShoppingCart size={14} /> Add to Cart
          </button>
        </div>
      </div>
    </article>
  );
}
