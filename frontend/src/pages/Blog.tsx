import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, Search } from 'lucide-react';
import { useApi } from '../lib/api';
import type { BlogCard, BlogDetail } from '../lib/types';
import { formatDate } from '../lib/format';
import { EmptyState } from '../components/ui';
import Newsletter from '../components/Newsletter';

function Card({ p }: { p: BlogCard }) {
  return (
    <article className="card card-hover flex h-full flex-col overflow-hidden">
      <Link to={`/blog/${p.slug}`} aria-label={p.title}>{p.coverUrl ? <img src={p.coverUrl} alt="" loading="lazy" className="aspect-[1.9] w-full bg-[#FDEEE3] object-cover" /> : <div className="aspect-[1.9] bg-[#FDEEE3]" />}</Link>
      <div className="flex flex-1 flex-col p-4">
        <Link to={`/blog?category=${p.categorySlug}`} className="text-xs font-extrabold uppercase tracking-wide text-link hover:underline">{p.category}</Link>
        <h2 className="mt-1 text-lg font-semibold leading-snug"><Link to={`/blog/${p.slug}`} className="hover:text-primary">{p.title}</Link></h2>
        <p className="mt-1 line-clamp-3 text-sm text-choco-soft">{p.excerpt}</p>
        <div className="mt-auto flex items-center justify-between pt-3 text-xs text-choco-soft">
          <span className="flex items-center gap-1"><Clock size={12} />{formatDate(p.publishedAt)} · {p.readMinutes} min read</span>
          <Link to={`/blog/${p.slug}`} className="font-extrabold text-link hover:underline">Read More</Link>
        </div>
      </div>
    </article>
  );
}

export function BlogList() {
  const [sp, setSp] = useSearchParams();
  const category = sp.get('category') ?? '', page = Number(sp.get('page') ?? 1) || 1, q = sp.get('q') ?? '';
  const [term, setTerm] = useState(q);
  useEffect(() => setTerm(q), [q]);
  const cats = useApi<{ id: number; name: string; slug: string; count: number }[]>('/catalog/blog/categories').data;
  const qs = new URLSearchParams({ page: String(page) });
  if (category) qs.set('category', category); if (q) qs.set('q', q);
  const { data, error } = useApi<{ items: BlogCard[]; total: number; totalPages: number }>(`/catalog/blog/posts?${qs}`);
  const set = (patch: Record<string, string | null>) => { const n = new URLSearchParams(sp); for (const [k, v] of Object.entries(patch)) v ? n.set(k, v) : n.delete(k); if (!('page' in patch)) n.delete('page'); setSp(n); };
  const chip = (on: boolean) => `rounded-full px-4 py-2 text-sm font-extrabold transition ${on ? 'bg-primary text-white' : 'bg-white shadow-soft hover:bg-peach'}`;

  return (
    <>
      <div className="container-x py-10">
        <div className="mb-8 text-center"><h1 className="text-4xl font-bold">The Pawzora Blog</h1><p className="mt-2 text-choco-soft">Pet care tips, product guides and heartwarming adoption stories.</p></div>
        <form onSubmit={(e) => { e.preventDefault(); set({ q: term.trim() || null }); }} role="search" aria-label="Search articles" className="mx-auto mb-5 flex max-w-md items-center gap-2 rounded-full border-2 border-peach bg-white px-4 py-2">
          <Search size={18} className="text-choco-soft" /><input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search articles…" aria-label="Search articles" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </form>
        <div className="mb-8 flex flex-wrap justify-center gap-2" role="group" aria-label="Categories">
          <button className={chip(!category)} onClick={() => set({ category: null })}>All</button>
          {cats?.filter((c) => c.count > 0 || c.slug === category).map((c) => <button key={c.id} className={chip(category === c.slug)} onClick={() => set({ category: c.slug })}>{c.name} <span className="opacity-70">({c.count})</span></button>)}
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {error && <EmptyState title="We couldn't load the articles" text={error} />}
          {!data && !error && Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton h-72" />)}
          {data?.items.length === 0 && <EmptyState title="No articles found" text="Try another search or category." action={<button className="btn btn-sm" onClick={() => setSp(new URLSearchParams())}>Show all articles</button>} />}
          {data?.items.map((p) => <Card key={p.id} p={p} />)}
        </div>
        {data && data.totalPages > 1 && (
          <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
            <button className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft disabled:opacity-40" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })} aria-label="Previous page"><ChevronLeft size={18} /></button>
            <span className="text-sm font-bold">Page {page} of {data.totalPages}</span>
            <button className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-soft disabled:opacity-40" disabled={page >= data.totalPages} onClick={() => set({ page: String(page + 1) })} aria-label="Next page"><ChevronRight size={18} /></button>
          </nav>
        )}
      </div>
      <Newsletter />
    </>
  );
}

/** Plain text only: blank line = paragraph, "## " = heading. Nothing is ever injected as HTML. */
function Article({ text }: { text: string }) {
  return (
    <div className="space-y-4 text-[17px] leading-relaxed">
      {text.split(/\n{2,}/).map((block, i) => block.startsWith('## ')
        ? <h2 key={i} className="pt-3 text-2xl font-semibold">{block.slice(3)}</h2>
        : <p key={i} className="whitespace-pre-line">{block}</p>)}
    </div>
  );
}

export function BlogPostPage() {
  const { slug } = useParams();
  const { data: p, error, loading } = useApi<BlogDetail>(slug ? `/catalog/blog/posts/${slug}` : null);
  if (loading) return <div className="container-x py-10" aria-busy="true"><h1 className="sr-only">Loading article</h1><div className="skeleton h-96" /></div>;
  if (error || !p) return <div className="container-x py-12"><EmptyState title="Article not found" text="It may have been unpublished." action={<Link to="/blog" className="btn btn-sm">Back to the blog</Link>} /></div>;
  return (
    <>
      <article className="container-x max-w-3xl py-10">
        <nav aria-label="Breadcrumb" className="mb-4 text-xs font-semibold text-choco-soft"><Link to="/" className="hover:text-primary">Home</Link> / <Link to="/blog" className="hover:text-primary">Blog</Link> / <Link to={`/blog?category=${p.categorySlug}`} className="hover:text-primary">{p.category}</Link></nav>
        <h1 className="text-4xl font-bold leading-tight">{p.title}</h1>
        <p className="mt-2 flex items-center gap-1 text-sm text-choco-soft"><Clock size={14} />{formatDate(p.publishedAt)} · {p.readMinutes} min read{p.isDemo && ' · demo article'}</p>
        {p.coverUrl && <img src={p.coverUrl} alt="" className="mt-6 aspect-[1.9] w-full rounded-4xl bg-[#FDEEE3] object-cover" />}
        <p className="mt-6 text-lg font-semibold text-choco-soft">{p.excerpt}</p>
        <div className="mt-6"><Article text={p.content} /></div>
      </article>
      {p.related.length > 0 && (
        <section className="container-x pb-6"><h2 className="mb-4 text-2xl font-semibold">Related articles</h2><div className="grid gap-5 md:grid-cols-3">{p.related.map((r) => <Card key={r.id} p={r} />)}</div></section>
      )}
      <Newsletter />
    </>
  );
}
