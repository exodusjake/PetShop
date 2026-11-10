import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Check, Loader2, Lock } from 'lucide-react';
import { ApiError, api, useApi } from '../lib/api';
import type { Address } from './AccountExtra';
import type { CartData, PaymentOption, ShippingCode } from '../lib/types';
import { formatPeso } from '../lib/format';
import { useAuth } from '../context/Auth';
import { useShop } from '../context/Shop';
import { useToast } from '../context/Toast';
import { EmptyState } from '../components/ui';
import { Field, FormError, TextInput, emailField } from '../components/forms';
import { LineThumb, Totals } from '../components/cart';
import { CouponBox } from './Cart';

const infoSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(120),
  phone: z.string().trim().regex(/^[0-9+()\-\s]{7,20}$/, 'Enter a valid phone number'),
  email: emailField,
  address: z.string().trim().min(5, 'Enter your complete address (house no., street)').max(300),
  barangay: z.string().trim().min(1, 'Enter your barangay').max(100),
  city: z.string().trim().min(1, 'Enter your city or municipality').max(100),
  province: z.string().trim().min(1, 'Enter your province').max(100),
  postalCode: z.string().trim().regex(/^[0-9]{4}$/, 'Enter a 4-digit postal code'),
  notes: z.string().trim().max(500).optional(),
});
type Info = z.infer<typeof infoSchema>;

const STEPS = ['Shipping', 'Delivery', 'Payment', 'Review'];

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mb-6 flex items-center gap-2 overflow-x-auto" aria-label="Checkout progress" tabIndex={0}>
      {STEPS.map((s, i) => {
        const n = i + 1, done = n < step, cur = n === step;
        return (
          <li key={s} className="flex items-center gap-2" aria-current={cur ? 'step' : undefined}>
            <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-extrabold ${done ? 'bg-green-600 text-white' : cur ? 'bg-primary text-white' : 'bg-peach text-choco-soft'}`}>{done ? <Check size={16} /> : n}</span>
            <span className={`text-sm font-extrabold ${cur ? '' : 'text-choco-soft'}`}>{s}</span>
            {n < STEPS.length && <span className="mx-1 h-0.5 w-6 bg-peach sm:w-10" />}
          </li>
        );
      })}
    </ol>
  );
}

function Summary({ cart }: { cart: CartData }) {
  return (
    <aside className="card space-y-4 p-5 lg:sticky lg:top-24" aria-label="Order summary">
      <h2 className="text-xl font-semibold">Order Summary</h2>
      <ul className="max-h-60 space-y-3 overflow-y-auto pr-1">
        {cart.lines.map((l) => (
          <li key={l.id} className="flex items-center gap-3">
            <LineThumb src={l.image} alt="" size="h-12 w-12" />
            <div className="min-w-0 flex-1 text-sm"><p className="line-clamp-1 font-bold">{l.name}</p><p className="text-xs text-choco-soft">{l.variantName ? `${l.variantName} · ` : ''}Qty {l.quantity}</p></div>
            <span className="text-sm font-extrabold">{formatPeso(l.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <CouponBox />
      <Totals cart={cart} />
    </aside>
  );
}

export default function Checkout() {
  const { user } = useAuth();
  const { cart: baseCart, refreshCart } = useShop();
  const { toast } = useToast();
  const nav = useNavigate();

  const [step, setStep] = useState(1);
  const [info, setInfo] = useState<Info | null>(null);
  const [ship, setShip] = useState<ShippingCode>('STANDARD');
  const [pay, setPay] = useState<PaymentOption['code']>('COD');
  const [priced, setPriced] = useState<CartData | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<Info>({ resolver: zodResolver(infoSchema), defaultValues: { fullName: user?.fullName ?? '', email: user?.email ?? '', phone: user?.phone ?? '' } });

  // saved addresses: the default one prefills the form, and any can be picked from the list
  const addrs = useApi<Address[]>('/account/addresses').data;
  const applyAddr = (a: Address) => form.reset({ ...form.getValues(), fullName: a.fullName, phone: a.phone, address: a.line1, barangay: a.barangay, city: a.city, province: a.province, postalCode: a.postalCode });
  useEffect(() => {
    const d = addrs?.find((a) => a.isDefault);
    if (d && !form.formState.isDirty) applyAddr(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addrs]);

  // totals for the chosen delivery method always come from the server
  useEffect(() => {
    if (!baseCart) return;
    api<CartData>(`/cart?shipping=${ship}`).then(setPriced).catch(() => {});
  }, [ship, baseCart]);

  const cart = priced ?? baseCart;
  if (!cart) return <div className="container-x py-10"><div className="skeleton h-72" /></div>;
  if (cart.lines.length === 0) {
    return <div className="container-x py-12"><EmptyState title="Your cart is empty" text="Add some products before checking out." action={<Link to="/shop" className="btn btn-sm">Browse products</Link>} /></div>;
  }

  const place = async () => {
    if (!info) return;
    setPlacing(true); setError(null);
    try {
      const r = await api<{ orderNumber: string }>('/checkout', { method: 'POST', json: { ...info, notes: info.notes ?? '', shippingMethod: ship, paymentMethod: pay } });
      await refreshCart();
      nav(`/order-confirmation/${r.orderNumber}`, { replace: true });
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toast(msg, 'error');
      if (e instanceof ApiError && (e.status === 409 || e.status === 400)) await refreshCart();
    }
    setPlacing(false);
  };

  const shipOpt = cart.shippingOptions.find((o) => o.code === ship)!;
  const payOpt = cart.paymentMethods.find((p) => p.code === pay)!;
  const back = () => setStep((s) => Math.max(1, s - 1));
  const radio = (on: boolean, disabled = false) => `flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition ${disabled ? 'cursor-not-allowed opacity-55' : ''} ${on ? 'border-primary bg-peach/40' : 'border-peach bg-white hover:border-primary/50'}`;

  return (
    <div className="container-x py-8">
      <h1 className="mb-1 text-3xl font-bold">Checkout</h1>
      <p className="mb-5 flex items-center gap-1.5 text-xs font-bold text-choco-soft"><Lock size={13} /> Secure checkout. Prices and totals are verified by our server.</p>
      <Stepper step={step} />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card p-6">
          {step === 1 && (
            <form noValidate className="space-y-4" onSubmit={form.handleSubmit((v) => { setInfo(v); setStep(2); })}>
              <h2 className="text-xl font-semibold">Shipping Information</h2>
              {addrs && addrs.length > 0 && (
                <Field label="Use a saved address" htmlFor="saved" hint={<>Manage them in <Link to="/account/addresses" className="font-bold text-link underline">My Addresses</Link>.</>}>
                  <select id="saved" className="input" defaultValue={addrs.find((a) => a.isDefault)?.id ?? ''} onChange={(e) => { const a = addrs.find((x) => x.id === Number(e.target.value)); if (a) applyAddr(a); }}>
                    <option value="">Enter a new address</option>
                    {addrs.map((a) => <option key={a.id} value={a.id}>{a.label}: {a.line1}, {a.city}{a.isDefault ? ' (default)' : ''}</option>)}
                  </select>
                </Field>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full Name" htmlFor="fullName" error={form.formState.errors.fullName?.message}><TextInput id="fullName" autoComplete="name" {...form.register('fullName')} invalid={!!form.formState.errors.fullName} /></Field>
                <Field label="Phone Number" htmlFor="phone" error={form.formState.errors.phone?.message}><TextInput id="phone" inputMode="tel" autoComplete="tel" placeholder="09XX XXX XXXX" {...form.register('phone')} invalid={!!form.formState.errors.phone} /></Field>
              </div>
              <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message} hint="We'll send your order updates here."><TextInput id="email" type="email" autoComplete="email" {...form.register('email')} invalid={!!form.formState.errors.email} /></Field>
              <Field label="Complete Address" htmlFor="address" error={form.formState.errors.address?.message}><TextInput id="address" autoComplete="street-address" placeholder="House no., street, subdivision" {...form.register('address')} invalid={!!form.formState.errors.address} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Barangay" htmlFor="barangay" error={form.formState.errors.barangay?.message}><TextInput id="barangay" {...form.register('barangay')} invalid={!!form.formState.errors.barangay} /></Field>
                <Field label="City / Municipality" htmlFor="city" error={form.formState.errors.city?.message}><TextInput id="city" autoComplete="address-level2" {...form.register('city')} invalid={!!form.formState.errors.city} /></Field>
                <Field label="Province" htmlFor="province" error={form.formState.errors.province?.message}><TextInput id="province" autoComplete="address-level1" {...form.register('province')} invalid={!!form.formState.errors.province} /></Field>
                <Field label="Postal Code" htmlFor="postalCode" error={form.formState.errors.postalCode?.message}><TextInput id="postalCode" inputMode="numeric" maxLength={4} autoComplete="postal-code" {...form.register('postalCode')} invalid={!!form.formState.errors.postalCode} /></Field>
              </div>
              <Field label="Delivery Notes (optional)" htmlFor="notes" error={form.formState.errors.notes?.message}><TextInput id="notes" placeholder="Landmarks, gate code, best time to deliver…" {...form.register('notes')} /></Field>
              <button className="btn">Continue to Delivery</button>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Shipping Method</h2>
              <fieldset className="space-y-3"><legend className="sr-only">Shipping method</legend>
                {cart.shippingOptions.map((o) => (
                  <label key={o.code} className={radio(ship === o.code)}>
                    <input type="radio" name="ship" className="mt-1 accent-primary" checked={ship === o.code} onChange={() => setShip(o.code)} />
                    <span className="flex-1"><span className="block font-extrabold">{o.label}</span><span className="text-sm text-choco-soft">{o.eta}</span></span>
                    <span className="font-extrabold">{o.free ? <span className="text-green-700">FREE</span> : formatPeso(o.fee)}</span>
                  </label>
                ))}
              </fieldset>
              <div className="flex gap-3"><button className="btn btn-ghost" onClick={back}><ArrowLeft size={16} /> Back</button><button className="btn" onClick={() => setStep(3)}>Continue to Payment</button></div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Payment Method</h2>
              <fieldset className="space-y-3"><legend className="sr-only">Payment method</legend>
                {cart.paymentMethods.map((m) => (
                  <label key={m.code} className={radio(pay === m.code, !m.available)}>
                    <input type="radio" name="pay" className="mt-1 accent-primary" disabled={!m.available} checked={pay === m.code} onChange={() => setPay(m.code)} />
                    <span className="flex-1"><span className="block font-extrabold">{m.label}</span><span className="text-sm text-choco-soft">{m.available ? m.note : 'Coming soon. ' + m.note}</span></span>
                  </label>
                ))}
              </fieldset>
              <p className="text-xs text-choco-soft">Card details are never entered or stored on this site. Online payments will go through a secure payment provider.</p>
              <div className="flex gap-3"><button className="btn btn-ghost" onClick={back}><ArrowLeft size={16} /> Back</button><button className="btn" onClick={() => setStep(4)}>Review Order</button></div>
            </div>
          )}

          {step === 4 && info && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold">Review Your Order</h2>
              <FormError message={error} />
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-beige p-4 text-sm"><p className="mb-1 flex justify-between font-extrabold">Ship to <button className="text-xs text-link hover:underline" onClick={() => setStep(1)}>Edit</button></p>
                  <p>{info.fullName}</p><p>{info.address}, {info.barangay}</p><p>{info.city}, {info.province} {info.postalCode}</p><p>{info.phone}</p></div>
                <div className="rounded-2xl bg-beige p-4 text-sm"><p className="mb-1 flex justify-between font-extrabold">Delivery <button className="text-xs text-link hover:underline" onClick={() => setStep(2)}>Edit</button></p>
                  <p>{shipOpt.label}</p><p className="text-choco-soft">{shipOpt.eta}</p></div>
                <div className="rounded-2xl bg-beige p-4 text-sm"><p className="mb-1 flex justify-between font-extrabold">Payment <button className="text-xs text-link hover:underline" onClick={() => setStep(3)}>Edit</button></p>
                  <p>{payOpt.label}</p><p className="text-choco-soft">{pay === 'COD' ? `Pay ${formatPeso(cart.total)} on delivery` : ''}</p></div>
              </div>
              {info.notes && <p className="text-sm"><b>Notes:</b> {info.notes}</p>}
              {cart.hasIssues && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">Some items changed. <Link to="/cart" className="underline">Review your cart</Link> before placing the order.</p>}
              <div className="flex gap-3">
                <button className="btn btn-ghost" onClick={back} disabled={placing}><ArrowLeft size={16} /> Back</button>
                <button className="btn" onClick={place} disabled={placing || cart.hasIssues}>{placing ? <Loader2 size={18} className="animate-spin" /> : <>Place Order · {formatPeso(cart.total)}</>}</button>
              </div>
            </div>
          )}
        </div>
        <Summary cart={cart} />
      </div>
    </div>
  );
}
