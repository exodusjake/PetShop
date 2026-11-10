import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../lib/api';
import type { StoreSettings } from '../lib/types';

const UPDATED = 'November 8, 2026';

function Page({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <article className="container-x max-w-3xl py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs font-semibold text-choco-soft"><Link to="/" className="hover:text-primary">Home</Link> / <span className="text-choco">{title}</span></nav>
      <h1 className="text-4xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-choco-soft">Last updated: {UPDATED}</p>
      <p className="mt-4 text-lg leading-relaxed">{intro}</p>
      <div className="mt-6 space-y-8 leading-relaxed">{children}</div>
    </article>
  );
}
const S = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
  <section aria-labelledby={id}><h2 id={id} className="mb-2 text-2xl font-semibold">{title}</h2><div className="space-y-3">{children}</div></section>
);
const List = ({ items }: { items: ReactNode[] }) => <ul className="list-disc space-y-1.5 pl-6">{items.map((i, k) => <li key={k}>{i}</li>)}</ul>;

/** The admin's contact email (Admin → Settings) if set; otherwise point to the contact form. Nothing is invented. */
function ContactLine() {
  const { data: s } = useApi<StoreSettings>('/catalog/settings');
  return <p>Questions? {s?.contact_email ? <>Email us at <a className="font-bold text-link underline" href={`mailto:${s.contact_email}`}>{s.contact_email}</a> or use</> : 'Use'} our <Link to="/contact" className="font-bold text-link underline">contact form</Link>.</p>;
}

export function Privacy() {
  return (
    <Page title="Privacy Policy" intro="This policy explains what personal information Pawzora collects when you use this website, why we collect it, how we protect it, and the rights you have over it, including your rights under the Philippine Data Privacy Act of 2012 (Republic Act No. 10173).">
      <S id="collect" title="1. What we collect">
        <List items={[
          <><b>Account details:</b> your name, email address and password. Passwords are stored only as a one-way hash, so no one at Pawzora can read them. Optionally your phone number.</>,
          <><b>Orders and delivery:</b> the items you buy, your delivery name, phone number, email and address, your delivery notes, and your order and payment status.</>,
          <><b>Pets and addresses you save:</b> pet profiles (name, species, breed, birth date, photo, notes) and saved addresses.</>,
          <><b>Adoption applications:</b> your contact details, address, living situation, pet care experience and reasons for adopting.</>,
          <><b>Content you write:</b> product reviews, and messages you send through the contact form.</>,
          <><b>Newsletter:</b> your email address, if you subscribe.</>,
          <><b>Technical data:</b> your IP address and browser type are recorded with login sessions and in server logs for security and troubleshooting.</>,
        ]} />
        <p>We do <b>not</b> collect or store payment card numbers. Today, orders are paid by Cash on Delivery. If online payments are added, card and e-wallet details will be handled by the payment provider, not by this website.</p>
      </S>
      <S id="cookies" title="2. Cookies and local storage">
        <p>We use only what the site needs to work. We do not use advertising or analytics cookies.</p>
        <List items={[
          <><code className="rounded bg-beige px-1.5 text-sm">pz_session</code>: keeps you logged in. It is an essential, HTTP-only cookie. It lasts until you close your browser, or up to 30 days if you choose “Remember me”.</>,
          <><code className="rounded bg-beige px-1.5 text-sm">pz_guest</code>: remembers your shopping cart while you are not logged in (up to 30 days).</>,
          <><code className="rounded bg-beige px-1.5 text-sm">pz_wish</code> (browser storage): remembers a wishlist you build before logging in. It is cleared when you log in or log out.</>,
        ]} />
        <p>To display our fonts, your browser requests them from Google Fonts, which means Google receives your IP address with that request.</p>
      </S>
      <S id="use" title="3. How we use your information">
        <List items={['To create and manage your account and keep it secure.', 'To process, deliver and support your orders, returns and refunds.', 'To review adoption applications and contact you about them.', 'To answer your messages and send order updates.', 'To send deals and pet care tips, only if you subscribed or opted in. You can opt out any time in Account Settings or by contacting us.', 'To prevent fraud and abuse, and to keep the site running and secure.']} />
      </S>
      <S id="share" title="4. Who we share it with">
        <p>We do not sell your personal information. We share only what is necessary with:</p>
        <List items={['Couriers and delivery partners: your name, phone number and delivery address.', 'Our hosting provider (Amazon Web Services), which stores the website and its database.', 'A payment provider, if and when online payments are introduced.', 'Authorities, when we are legally required to.']} />
      </S>
      <S id="keep" title="5. How long we keep it">
        <p>We keep your account information until you ask us to delete your account. Order and payment records are kept for as long as needed for accounting, tax and legal obligations. Contact messages are kept only as long as needed to answer and follow up on them.</p>
      </S>
      <S id="security" title="6. How we protect it">
        <p>Passwords are hashed; sessions use secure, HTTP-only cookies; staff access is limited by role and admin actions are logged; connections to the site should use HTTPS; and the database is not open to the public internet. No system is perfectly secure, but we work to protect your information and fix problems promptly.</p>
      </S>
      <S id="rights" title="7. Your rights">
        <p>Under the Data Privacy Act you have the right to be informed, to access your personal data, to correct it, to object to its processing, to ask for it to be blocked or deleted, to data portability, and to claim damages if it is misused. You can edit your profile, pets and addresses in your account at any time.</p>
        <p>To use any of these rights, contact us. If you believe your rights were violated, you may also file a complaint with the National Privacy Commission (privacy.gov.ph).</p>
      </S>
      <S id="children" title="8. Children">
        <p>This site is for adults. Please do not create an account or apply to adopt if you are under 18 without a parent or guardian.</p>
      </S>
      <S id="changes" title="9. Changes and contact">
        <p>We may update this policy. The “last updated” date above shows when it last changed, and we will highlight significant changes on the site.</p>
        <ContactLine />
      </S>
    </Page>
  );
}

export function Terms() {
  return (
    <Page title="Terms & Conditions" intro="These terms apply when you browse, shop, adopt or create an account on Pawzora. By using the site you agree to them. If you do not agree, please do not use it.">
      <S id="accounts" title="1. Your account">
        <p>You must give accurate information and keep your password private. You are responsible for activity on your account. We may suspend accounts that are used for fraud, abuse or to break these terms.</p>
      </S>
      <S id="prices" title="2. Products and prices">
        <p>Prices are in Philippine Pesos (₱). Product photos and descriptions are as accurate as we can make them, but packaging and appearance may vary slightly. Sale prices apply while stocks last and until the end date shown. We may correct pricing or stock errors, and if an error affects an order you have already placed we will contact you and you may cancel it.</p>
      </S>
      <S id="orders" title="3. Orders and payment">
        <List items={[
          'Your order is a request to buy. We confirm it when we start preparing it, and may cancel an order if an item is unavailable.',
          'The total you see at checkout (items, discount, shipping) is calculated by our system and is the amount you pay.',
          <><b>Payment:</b> we currently accept Cash on Delivery. You pay the courier in cash when your order arrives. Online payment methods will be added later and will show as available at checkout only when they work.</>,
          'Discount codes are single-use per order, may have a minimum spend, an expiry date and a usage limit, and cannot be combined unless stated.',
        ]} />
      </S>
      <S id="cancel" title="4. Cancelling an order">
        <p>You can cancel an order yourself from <Link to="/account/orders" className="font-bold text-link underline">My Orders</Link> while it is still Pending or Confirmed and unpaid. Once it is being processed or shipped, please contact us and we will do our best to help.</p>
      </S>
      <S id="shipping" title="5. Shipping and delivery">
        <p>Shipping fees and delivery speeds are shown at checkout. Delivery dates are estimates, not guarantees, and may be affected by couriers, weather or location. Please provide a complete, correct address and a phone number the courier can reach. Orders over the free-shipping amount shown on the site qualify for free standard delivery.</p>
      </S>
      <S id="returns" title="6. Returns and refunds">
        <List items={[
          'You may request a return within 7 days of receiving your order if an item arrived damaged, defective or not as ordered, or if it is unused and in its original, sealed packaging.',
          'For hygiene and safety, opened food, treats, grooming and care products cannot be returned unless they are defective.',
          'Contact us with your order number and photos of the problem. We will arrange a replacement or refund.',
          'Approved refunds are returned using the same method you paid with where possible. For Cash on Delivery orders, we will arrange a bank or e-wallet transfer.',
        ]} />
      </S>
      <S id="adoption" title="7. Pet adoption">
        <List items={[
          'Adoption is not a purchase. Submitting an application does not guarantee that you can adopt a pet.',
          'Every application is reviewed by our team, and approval or rejection is a manual decision that we may make for the welfare of the animal.',
          'Approved adopters may be asked for valid ID, a home visit and a signed adoption agreement.',
          'Listings show the information we have about each pet. We cannot guarantee a pet\'s behaviour or health history.',
        ]} />
      </S>
      <S id="content" title="8. Reviews and messages">
        <p>Only customers who have received a product can review it. Reviews must be honest and respectful. We may hide or remove reviews that are abusive, misleading, off-topic or contain personal information. By posting a review you allow us to display it on the site.</p>
      </S>
      <S id="use" title="9. Using the site">
        <p>Do not misuse the site: no attempts to break, overload or gain unauthorised access to it, no scraping at scale, and no use of the site for unlawful purposes. Content on the site (logo, text, photos and design) belongs to Pawzora or its licensors and may not be copied without permission.</p>
      </S>
      <S id="liability" title="10. Limits of liability">
        <p>We work hard to keep the site accurate and available, but it is provided “as is”. To the extent allowed by law, Pawzora is not liable for indirect or consequential losses, and our liability for any order is limited to the amount you paid for it. Nothing in these terms limits your rights under Philippine consumer protection laws.</p>
      </S>
      <S id="law" title="11. Governing law and changes">
        <p>These terms are governed by the laws of the Republic of the Philippines. We may update them from time to time. The “last updated” date above shows the current version, and continued use of the site means you accept the changes. Our <Link to="/privacy" className="font-bold text-link underline">Privacy Policy</Link> explains how we handle your personal information.</p>
        <ContactLine />
      </S>
    </Page>
  );
}
