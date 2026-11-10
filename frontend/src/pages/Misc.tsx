import { Link, Navigate, useParams } from 'react-router-dom';
import { Paw } from '../components/ui';
import Newsletter from '../components/Newsletter';

/** Shown for any address that doesn't exist. */
export function NotFound() {
  return (
    <div className="container-x py-20 text-center">
      <Paw size={56} className="mx-auto text-peach" />
      <p className="mt-4 font-display text-6xl font-bold text-primary">404</p>
      <h1 className="mt-2 text-3xl font-semibold">We couldn't find that page</h1>
      <p className="mx-auto mt-2 max-w-md text-choco-soft">The link may be old, or the page may have moved. Let's get you back to the good stuff.</p>
      <div className="mt-6 flex justify-center gap-3"><Link to="/shop" className="btn">Browse products</Link><Link to="/" className="btn btn-ghost">Back home</Link></div>
    </div>
  );
}

export function CategoryRedirect() {
  const { categorySlug } = useParams();
  return <Navigate to={`/categories/${categorySlug}`} replace />;
}

export function About() {
  return (
    <>
      <div className="container-x py-12">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold">About <span className="text-primary">Pawzora</span></h1>
          <p className="mt-4 text-lg leading-relaxed">Pawzora is a pet shop built by pet lovers, for pet lovers. We believe every furry, feathered and finned friend deserves quality food, comfy beds, fun toys and a loving home.</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[['Premium quality', 'We choose safe, durable and pet-approved products.'], ['Pet care you can trust', 'Guides and advice from people who care about animals.'], ['Giving pets a home', 'Our adoption program connects pets with loving families.']].map(([t, s]) => (
            <div key={t} className="card p-6"><h2 className="text-xl font-semibold">{t}</h2><p className="mt-2 text-sm text-choco-soft">{s}</p></div>
          ))}
        </div>
      </div>
      <Newsletter />
    </>
  );
}
