import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Gem, Headphones, HeartPulse, PiggyBank, RotateCcw, ShieldCheck, ShoppingCart, Stethoscope, Truck, Heart } from 'lucide-react';
import { useApi } from '../lib/api';
import type { AdoptionPet, BlogPreview, Category, FeaturedReview, ProductPage } from '../lib/types';
import { formatDate } from '../lib/format';
import ProductCard from '../components/ProductCard';
import PetCard from '../components/PetCard';
import Newsletter from '../components/Newsletter';
import { EmptyState, Paw, ProductSkeletons, Reveal, SectionTitle, Stars } from '../components/ui';

const PET_BG: Record<string, string> = {
  dogs: '#FEEDD8', cats: '#FEE8E7', 'small-pets': '#EFF8E2', birds: '#E1F2FD', fish: '#EBE6FE', reptiles: '#FEECD5',
};

function Hero() {
  return (
    <section className="container-x grid items-center gap-6 pb-4 pt-8 lg:grid-cols-[1fr_1.15fr] lg:pt-12">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#FDE6D2] px-4 py-1.5 text-[13px] font-bold">
          <Paw size={14} className="text-primary" /> Everything for Your Furry Friends
        </span>
        <h1 className="mt-5 text-[44px] font-bold leading-[1.05] sm:text-[58px]">
          Welcome to
          <em className="block text-[56px] not-italic text-primary sm:text-[76px]">Pawzora <Paw size={44} className="inline text-primary-light" /></em>
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed">
          Your one-stop shop for happy, healthy, and spoiled pets. Discover premium pet essentials, delicious treats, fun toys, and everything your furry friends deserve!
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/shop" className="btn"><ShoppingCart size={18} /> Shop Now <ArrowRight size={16} /></Link>
          <a href="#categories" className="btn btn-ghost">Explore Categories</a>
          <Link to="/adoption" className="btn btn-ghost"><Heart size={16} /> Adopt a Pet</Link>
        </div>
      </div>
      <div className="relative">
        <img src="/img/hero.png" alt="A golden retriever, cat, rabbit and parakeet relaxing together"
          className="w-full rounded-4xl [mask-image:radial-gradient(ellipse_74%_74%_at_52%_50%,#000_66%,transparent_100%)]" />
      </div>
    </section>
  );
}

function Benefits() {
  const items = [
    [Truck, 'Fast & Reliable', 'Delivery'], [ShieldCheck, 'Safe & Trusted', 'Products'],
    [RotateCcw, 'Easy Returns', '(7 Days)'], [Headphones, 'Pet-Lover', 'Customer Support'],
  ] as const;
  return (
    <section className="container-x py-5">
      <div className="grid grid-cols-2 gap-4 rounded-3xl bg-white/70 px-5 py-5 shadow-soft lg:grid-cols-4">
        {items.map(([Icon, a, b]) => (
          <div key={a} className="flex items-center gap-3"><Icon size={30} strokeWidth={1.6} className="shrink-0 text-primary" />
            <p className="text-sm font-bold leading-tight">{a}<br />{b}</p></div>
        ))}
      </div>
    </section>
  );
}

function Tiles({ cats }: { cats: { pets: Category[]; categories: Category[] } | null }) {
  const skeleton = Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton aspect-[1.1]" />);
  return (
    <>
      <section className="container-x py-6" id="pets">
        <SectionTitle paw>Shop by Pet</SectionTitle>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {!cats ? skeleton : cats.pets.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.04}>
              <Link to={`/shop?pet=${c.slug}`} style={{ background: PET_BG[c.slug] ?? '#FEEDD8' }}
                className="group block rounded-3xl p-1.5 pb-3 shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
                {c.imageUrl && <img src={c.imageUrl} alt="" loading="lazy" className="aspect-[1.9] w-full rounded-2xl object-cover" />}
                <span className="mt-1 flex items-center justify-between px-3 text-sm font-extrabold">{c.name}<ArrowRight size={16} className="transition group-hover:translate-x-1" /></span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
      <section className="container-x py-6" id="categories">
        <SectionTitle>Shop by Category</SectionTitle>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {!cats ? skeleton : cats.categories.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.04}>
              <Link to={`/categories/${c.slug}`} className="block rounded-3xl bg-[#FEF1E5] p-1.5 pb-3 text-center shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
                {c.imageUrl && <img src={c.imageUrl} alt="" loading="lazy" className="aspect-[1.9] w-full rounded-2xl object-cover" />}
                <span className="mt-1 block px-2 text-sm font-extrabold">{c.name}</span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}

/** Only shown when the admin has real discounts configured. The badge percentage comes from the data. */
function DealsBanner() {
  const { data } = useApi<ProductPage>('/catalog/products?onSale=true&pageSize=48');
  if (!data || data.total === 0) return null;
  const best = Math.max(...data.items.map((p) => p.discountPercent));
  return (
    <section className="container-x py-5">
      <div className="relative flex min-h-[150px] items-center gap-5 overflow-hidden rounded-[30px] bg-gradient-to-r from-[#EC7A2C] via-[#F2994F] to-[#F9B98A] px-6 text-white sm:px-10">
        <Paw size={46} className="hidden shrink-0 opacity-90 sm:block" />
        <div className="relative z-10 py-6">
          <h2 className="text-3xl font-semibold sm:text-4xl">Pawzora Deals!</h2>
          <p className="mb-3 mt-1 text-base sm:text-lg">Save more on your pet's favorites!</p>
          <Link to="/deals" className="btn btn-white btn-sm !px-5 !py-2.5 !text-sm">Shop Deals <ArrowRight size={15} /></Link>
        </div>
        <img src="/img/deals.png" alt="" aria-hidden="true" className="absolute bottom-0 right-[150px] top-0 hidden h-full w-auto [mask-image:linear-gradient(90deg,transparent,#000_22%)] md:block" />
        <div className="absolute right-4 top-1/2 flex h-[104px] w-[104px] -translate-y-1/2 flex-col items-center justify-center rounded-full bg-[#D4521B] leading-none shadow-[0_0_0_5px_rgba(249,204,170,.4),inset_0_0_0_3px_#FFB98A] sm:right-9 sm:h-[122px] sm:w-[122px]">
          <span className="text-sm font-extrabold">Up to</span>
          <b className="font-display text-[34px] sm:text-[38px]">{best}%</b>
          <span className="text-sm font-extrabold">OFF</span>
        </div>
      </div>
    </section>
  );
}

function Featured() {
  const { data, error } = useApi<ProductPage>('/catalog/products?featured=true&pageSize=5&sort=popularity');
  return (
    <section className="container-x py-8">
      <SectionTitle>Featured Products</SectionTitle>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {error && <EmptyState title="We couldn't load products" text="Please check that the API server is running, then refresh." />}
        {!data && !error && <ProductSkeletons />}
        {data?.items.map((p, i) => <Reveal key={p.id} delay={i * 0.05}><ProductCard p={p} /></Reveal>)}
      </div>
      <div className="mt-7 text-center"><Link to="/shop" className="btn btn-ghost">View all products <ArrowRight size={16} /></Link></div>
    </section>
  );
}

function Adoption() {
  const { data } = useApi<AdoptionPet[]>('/catalog/adoption');
  const pets = (data ?? []).slice(0, 4);
  return (
    <section className="container-x py-8">
      <div className="overflow-hidden rounded-4xl bg-gradient-to-br from-peach/70 to-beige p-6 sm:p-9">
        <div className="mb-6 text-center">
          <h2 className="font-display text-[28px] font-semibold sm:text-[32px]">Find Your New Best Friend</h2>
          <p className="mt-1 text-sm text-choco-soft">Give a pet a loving home. Browse adoptable pets and make a difference today!</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {!data ? Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-72" />) : pets.map((p) => <PetCard key={p.id} pet={p} />)}
        </div>
        <div className="mt-6 text-center"><Link to="/adoption" className="btn">View Adoptable Pets <ArrowRight size={16} /></Link></div>
      </div>
    </section>
  );
}

function Why() {
  const items = [
    [Gem, 'Premium Quality', 'Safe, durable, and pet-approved products.'], [Stethoscope, 'Pet Care Experts', 'Tips, guides, and advice from pet professionals.'],
    [PiggyBank, 'Great Savings', 'Exclusive deals, bundles, and loyalty rewards.'], [HeartPulse, 'A Healthier, Happier Pet Life', 'Everything for your pet\'s health, comfort and happiness.'],
  ] as const;
  return (
    <section className="container-x py-8" id="why">
      <SectionTitle>Why Choose Pawzora?</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([Icon, t, s], i) => (
          <Reveal key={t} delay={i * 0.05}>
            <div className="card flex h-full items-start gap-4 p-5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-softgreen text-primary"><Icon size={26} strokeWidth={1.6} /></span>
              <div><h3 className="text-base font-semibold">{t}</h3><p className="mt-1 text-sm text-choco-soft">{s}</p></div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function BlogPreviewSection() {
  const { data } = useApi<BlogPreview[]>('/catalog/blog?limit=3');
  if (data && data.length === 0) return null;
  return (
    <section className="container-x py-8">
      <SectionTitle>From Our Blog</SectionTitle>
      <div className="grid gap-4 md:grid-cols-3">
        {!data ? Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton h-64" />) : data.map((p, i) => (
          <Reveal key={p.id} delay={i * 0.05}>
            <article className="card card-hover flex h-full flex-col overflow-hidden">
              {p.coverUrl && <img src={p.coverUrl} alt="" loading="lazy" className="aspect-[1.9] w-full bg-[#FDEEE3] object-cover" />}
              <div className="flex flex-1 flex-col p-4">
                <span className="text-xs font-extrabold uppercase tracking-wide text-link">{p.category}</span>
                <h3 className="mt-1 text-base font-semibold leading-snug">{p.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-choco-soft">{p.excerpt}</p>
                <div className="mt-auto flex items-center justify-between pt-3 text-xs text-choco-soft">
                  <span>{formatDate(p.publishedAt)} · {p.readMinutes} min read</span>
                  <Link to={`/blog/${p.slug}`} className="font-extrabold text-link hover:underline">Read More</Link>
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Reviews() {
  const { data } = useApi<FeaturedReview[]>('/catalog/reviews/featured');
  const [i, setI] = useState(0);
  if (!data || data.length === 0) return null;
  const r = data[i % data.length];
  const n = data.length;
  return (
    <section className="container-x py-8">
      <SectionTitle><Heart size={26} className="text-primary-light" />Loved by Pet Parents<Heart size={26} className="text-primary-light" /></SectionTitle>
      <div className="mx-auto flex max-w-3xl items-center gap-3 sm:gap-5">
        <button onClick={() => setI((i + n - 1) % n)} aria-label="Previous review" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white shadow-soft hover:bg-peach"><ChevronLeft size={20} /></button>
        <figure className="card flex-1 p-6 text-center sm:text-left">
          <Stars value={r.rating} size={17} />
          <blockquote className="mt-2 text-[15px] leading-relaxed">“{r.body}”</blockquote>
          <figcaption className="mt-3 text-sm font-bold text-choco-soft">
            — {r.author} on <Link to={`/shop/${r.product.slug}`} className="text-link underline">{r.product.name}</Link>
            {r.isDemo && <span className="ml-2 rounded-full bg-peach px-2 py-0.5 text-[10px] font-extrabold uppercase text-choco">Demo review</span>}
          </figcaption>
        </figure>
        <button onClick={() => setI((i + 1) % n)} aria-label="Next review" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white shadow-soft hover:bg-peach"><ChevronRight size={20} /></button>
      </div>
      <div className="mt-4 flex justify-center gap-2">
        {data.map((_, k) => <button key={k} onClick={() => setI(k)} aria-label={`Review ${k + 1}`} className={`h-2 rounded-full transition-all ${k === i % n ? 'w-5 bg-primary' : 'w-2 bg-peach'}`} />)}
      </div>
    </section>
  );
}

export default function Home() {
  const { data: cats } = useApi<{ pets: Category[]; categories: Category[] }>('/catalog/categories');
  return (
    <>
      <Hero />
      <Benefits />
      <Tiles cats={cats} />
      <DealsBanner />
      <Featured />
      <Adoption />
      <Why />
      <BlogPreviewSection />
      <Reviews />
      <Newsletter />
    </>
  );
}
