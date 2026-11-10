import { Link } from 'react-router-dom';
import { Facebook, Instagram, Mail, MapPin, Phone, Clock, Youtube } from 'lucide-react';
import { Logo } from './ui';
import { useApi } from '../lib/api';
import type { Category, StoreSettings } from '../lib/types';

const col = 'text-sm text-choco-soft hover:text-primary';

export default function Footer() {
  const { data: s } = useApi<StoreSettings>('/catalog/settings');
  const { data: cats } = useApi<{ pets: Category[]; categories: Category[] }>('/catalog/categories');
  const socials = [
    [s?.social_facebook, Facebook, 'Facebook'], [s?.social_instagram, Instagram, 'Instagram'], [s?.social_youtube, Youtube, 'YouTube'],
  ] as const;

  return (
    <footer className="mt-16 border-t border-peach bg-beige">
      <div className="container-x grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.3fr]">
        <div>
          <Logo className="h-16" />
          <p className="mt-3 max-w-xs text-sm text-choco-soft">Everything for your furry friends: premium food, toys, beds and care, delivered with love.</p>
          <div className="mt-4 flex gap-2">
            {socials.filter(([url]) => url).map(([url, Icon, name]) => (
              <a key={name} href={url} target="_blank" rel="noopener noreferrer" aria-label={name} className="grid h-9 w-9 place-items-center rounded-full bg-white text-choco shadow-soft hover:bg-primary hover:text-white"><Icon size={17} /></a>
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-3 font-display text-lg font-semibold">Quick Links</h2>
          <ul className="space-y-2">{[['/shop', 'Shop All'], ['/deals', 'Deals'], ['/adoption', 'Adoption'], ['/blog', 'Blog'], ['/about', 'About Us']].map(([to, l]) => <li key={to}><Link className={col} to={to}>{l}</Link></li>)}</ul>
        </div>
        <div>
          <h2 className="mb-3 font-display text-lg font-semibold">Categories</h2>
          <ul className="space-y-2">{(cats?.categories ?? []).map((c) => <li key={c.id}><Link className={col} to={`/categories/${c.slug}`}>{c.name}</Link></li>)}</ul>
        </div>
        <div>
          <h2 className="mb-3 font-display text-lg font-semibold">Support</h2>
          <ul className="space-y-2">{[['/contact', 'Contact Us'], ['/account/orders', 'Track Order'], ['/account', 'My Account'], ['/privacy', 'Privacy Policy'], ['/terms', 'Terms & Conditions']].map(([to, l]) => <li key={to}><Link className={col} to={to}>{l}</Link></li>)}</ul>
        </div>
        <div>
          <h2 className="mb-3 font-display text-lg font-semibold">Contact</h2>
          <ul className="space-y-2 text-sm text-choco-soft">
            {s?.contact_email && <li className="flex gap-2"><Mail size={16} className="mt-0.5 shrink-0 text-primary" />{s.contact_email}</li>}
            {s?.contact_phone && <li className="flex gap-2"><Phone size={16} className="mt-0.5 shrink-0 text-primary" />{s.contact_phone}</li>}
            {s?.contact_address && <li className="flex gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-primary" />{s.contact_address}</li>}
            {s?.business_hours && <li className="flex gap-2"><Clock size={16} className="mt-0.5 shrink-0 text-primary" />{s.business_hours}</li>}
            {s && !s.contact_email && !s.contact_phone && !s.contact_address && (
              <li>Use our <Link to="/contact" className="font-bold text-link underline">contact form</Link> to reach us.</li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-peach py-4 text-center text-xs text-choco-soft">© {new Date().getFullYear()} Pawzora. All rights reserved. Products, reviews and sales figures shown during development are demo data.</div>
    </footer>
  );
}
