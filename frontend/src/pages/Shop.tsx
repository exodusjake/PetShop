import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, SlidersHorizontal, Star, X } from 'lucide-react';
import { useApi } from '../lib/api';
import type { Category, ProductPage } from '../lib/types';
import ProductCard from '../components/ProductCard';
import { EmptyState, ProductSkeletons } from '../components/ui';

const SORTS = [
  ['popularity', 'Popularity'], ['newest', 'Newest'], ['price-asc', 'Price: Low to High'],
  ['price-desc', 'Price: High to Low'], ['rating', 'Highest Rated'],
] as const;

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <fieldset className="border-b border-peach/70 py-4 last:border-0"><legend className="mb-2 font-display text-base font-semibold">{title}</legend>{children}</fieldset>;
}

export default function Shop({ dealsOnly = false }: { dealsOnly?: boolean }) {
  const { categorySlug } = useParams();
  const [sp, setSp] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);

  const cats = useApi<{ pets: Category[]; categories: Category[] }>('/catalog/categories').data;
  const facets = useApi<{ brands: { name: string; count: number }[]; priceMin: number; priceMax: number }>('/catalog/facets').data;

  const f = {
    q: sp.get('q') ?? '', pet: sp.get('pet') ?? '', category: categorySlug ?? sp.get('category') ?? '',
    brand: sp.get('brand') ?? '', minPrice: sp.get('minPrice') ?? '', maxPrice: sp.get('maxPrice') ?? '',
    rating: sp.get('rating') ?? '', inStock: sp.get('inStock') === 'true', sort: sp.get('sort') ?? 'popularity',
    page: Number(sp.get('page') ?? 1) || 1,
  };

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (f.q) p.set('q', f.q);
    if (f.pet) p.set('pet', f.pet);
    if (f.category) p.set('category', f.category);
    if (f.brand) p.set('brand', f.brand);
    if (f.minPrice) p.set('minPrice', f.minPrice);
    if (f.maxPrice) p.set('maxPrice', f.maxPrice);
    if (f.rating) p.set('rating', f.rating);
    if (f.inStock) p.set('inStock', 'true');
    if (dealsOnly) p.set('onSale', 'true');
    p.set('sort', f.sort); p.set('page', String(f.page)); p.set('pageSize', '12');
    return p.toString();
  }, [f.q, f.pet, f.category, f.brand, f.minPrice, f.maxPrice, f.rating, f.inStock, f.sort, f.page, dealsOnly]);

  const { data, error, loading } = useApi<ProductPage>(`/catalog/products?${query}`);

  // price inputs apply on submit so we don't refetch on every keystroke
  const [minP, setMinP] = useState(f.minPrice), [maxP, setMaxP] = useState(f.maxPrice);
  useEffect(() => { setMinP(f.minPrice); setMaxP(f.maxPrice); }, [f.minPrice, f.maxPrice]);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    if (!('page' in patch)) next.delete('page');
    setSp(next);
  };
  const toggleBrand = (name: string) => {
    const cur = f.brand ? f.brand.split(',') : [];
    update({ brand: (cur.includes(name) ? cur.filter((b) => b !== name) : [...cur, name]).join(',') || null });
  };
  const applyPrice = (e: FormEvent) => { e.preventDefault(); update({ minPrice: minP || null, maxPrice: maxP || null }); };

  const activeCount = [f.q, f.pet, f.brand, f.minPrice || f.maxPrice, f.rating, f.inStock, !categorySlug && f.category].filter(Boolean).length;
  const title = dealsOnly ? 'Pawzora Deals' : categorySlug ? (cats?.categories.find((c) => c.slug === categorySlug)?.name ?? 'Shop') : f.q ? `Results for “${f.q}”` : 'Shop All Products';

  const sidebar = (
    <aside className="rounded-3xl bg-white p-5 shadow-soft" aria-label="Filters">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">Filters</h2>
        {activeCount > 0 && <button onClick={() => setSp(new URLSearchParams())} className="text-xs font-extrabold text-link hover:underline">Clear all</button>}
      </div>
      <FilterGroup title="Pet Type">
        {[{ slug: '', name: 'All pets' }, ...(cats?.pets ?? [])].map((c) => (
          <label key={c.slug} className="flex cursor-pointer items-center gap-2 py-1 text-sm font-semibold">
            <input type="radio" name="pet" className="accent-primary" checked={f.pet === c.slug} onChange={() => update({ pet: c.slug || null })} />{c.name}
          </label>
        ))}
      </FilterGroup>
      {!categorySlug && (
        <FilterGroup title="Category">
          {[{ slug: '', name: 'All categories' }, ...(cats?.categories ?? [])].map((c) => (
            <label key={c.slug} className="flex cursor-pointer items-center gap-2 py-1 text-sm font-semibold">
              <input type="radio" name="category" className="accent-primary" checked={f.category === c.slug} onChange={() => update({ category: c.slug || null })} />{c.name}
            </label>
          ))}
        </FilterGroup>
      )}
      <FilterGroup title="Price (₱)">
        <form onSubmit={applyPrice} className="flex items-center gap-2">
          <input aria-label="Minimum price" inputMode="numeric" className="input !px-3 !py-2" placeholder="Min" value={minP} onChange={(e) => setMinP(e.target.value.replace(/\D/g, ''))} />
          <span>–</span>
          <input aria-label="Maximum price" inputMode="numeric" className="input !px-3 !py-2" placeholder="Max" value={maxP} onChange={(e) => setMaxP(e.target.value.replace(/\D/g, ''))} />
          <button className="btn btn-sm shrink-0">Go</button>
        </form>
      </FilterGroup>
      <FilterGroup title="Brand">
        <div className="max-h-48 overflow-y-auto pr-1">
          {(facets?.brands ?? []).map((b) => (
            <label key={b.name} className="flex cursor-pointer items-center gap-2 py-1 text-sm font-semibold">
              <input type="checkbox" className="accent-primary" checked={f.brand.split(',').includes(b.name)} onChange={() => toggleBrand(b.name)} />
              {b.name} <span className="text-xs text-choco-soft">({b.count})</span>
            </label>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title="Rating">
        {['4', '3', ''].map((r) => (
          <label key={r || 'any'} className="flex cursor-pointer items-center gap-2 py-1 text-sm font-semibold">
            <input type="radio" name="rating" className="accent-primary" checked={f.rating === r} onChange={() => update({ rating: r || null })} />
            {r ? <span className="flex items-center gap-1">{r}<Star size={14} fill="#F5A623" className="text-[#F5A623]" /> &amp; up</span> : 'Any rating'}
          </label>
        ))}
      </FilterGroup>
      <FilterGroup title="Availability">
        <label className="flex cursor-pointer items-center gap-2 py-1 text-sm font-semibold">
          <input type="checkbox" className="accent-primary" checked={f.inStock} onChange={(e) => update({ inStock: e.target.checked ? 'true' : null })} />In stock only
        </label>
      </FilterGroup>
    </aside>
  );

  return (
    <div className="container-x py-8">
      <nav aria-label="Breadcrumb" className="mb-2 text-xs font-semibold text-choco-soft">
        <Link to="/" className="hover:text-primary">Home</Link> / <span className="text-choco">{dealsOnly ? 'Deals' : 'Shop'}</span>
      </nav>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{title}</h1>
          <p className="text-sm text-choco-soft" aria-live="polite">{loading && !data ? 'Loading…' : data ? `Showing ${data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} of ${data.total} products` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm lg:hidden" onClick={() => setShowFilters(true)}><SlidersHorizontal size={15} /> Filters{activeCount ? ` (${activeCount})` : ''}</button>
          <label className="flex items-center gap-2 text-sm font-bold">Sort by
            <select value={f.sort} onChange={(e) => update({ sort: e.target.value === 'popularity' ? null : e.target.value })} className="input !w-auto !py-2 font-semibold">
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
        <div className="hidden lg:block">{sidebar}</div>
        {showFilters && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-choco/40" onClick={() => setShowFilters(false)} />
            <div className="absolute inset-y-0 right-0 w-[320px] max-w-[88vw] overflow-y-auto bg-cream p-4">
              <button className="mb-2 ml-auto flex items-center gap-1 text-sm font-bold" onClick={() => setShowFilters(false)}><X size={18} /> Close</button>
              {sidebar}
              <button className="btn mt-4 w-full" onClick={() => setShowFilters(false)}>Show {data?.total ?? ''} results</button>
            </div>
          </div>
        )}

        <section aria-label="Products">
          <div className={`grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 ${loading && data ? 'opacity-60 transition' : ''}`}>
            {error && <EmptyState title="We couldn't load products" text={error} />}
            {!data && !error && <ProductSkeletons n={8} />}
            {data && data.items.length === 0 && (
              <EmptyState title="No products found" text="Try removing a filter or searching for something else."
                action={<button className="btn btn-sm" onClick={() => setSp(new URLSearchParams())}>Clear filters</button>} />
            )}
            {data?.items.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>

          {data && data.totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
              <button className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft disabled:opacity-40" disabled={data.page <= 1} onClick={() => update({ page: String(data.page - 1) })} aria-label="Previous page"><ChevronLeft size={18} /></button>
              {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((n) => (
                <button key={n} onClick={() => update({ page: n === 1 ? null : String(n) })} aria-current={n === data.page ? 'page' : undefined}
                  className={`h-10 w-10 rounded-full text-sm font-extrabold shadow-soft ${n === data.page ? 'bg-primary text-white' : 'bg-white hover:bg-peach'}`}>{n}</button>
              ))}
              <button className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft disabled:opacity-40" disabled={data.page >= data.totalPages} onClick={() => update({ page: String(data.page + 1) })} aria-label="Next page"><ChevronRight size={18} /></button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
