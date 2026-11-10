import 'dotenv/config';
import request from 'supertest';
import { SMTPServer } from 'smtp-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/db';
import { resetMailer } from '../src/lib/mailer';
import { checkEnv } from '../src/lib/env';

const app = createApp();
const H = { 'X-Requested-With': 'pawzora' };
const stamp = Date.now();
type Mail = { to: string; raw: string };
const inbox: Mail[] = [];
let smtp: SMTPServer, productId = 0, slowMs = 0;
const saved = { ...process.env };

// a message body as readable text (undo quoted-printable line wrapping)
const text = (m: Mail) => m.raw.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_x, h) => String.fromCharCode(parseInt(h, 16)));
const waitFor = async (pred: () => boolean, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (pred()) return true; await new Promise((r) => setTimeout(r, 50)); } return false; };

beforeAll(async () => {
  smtp = new SMTPServer({
    authOptional: true, disabledCommands: ['STARTTLS'],
    onRcptTo(addr, _s, cb) { (smtp as unknown as { _to?: string })._to = addr.address; cb(); },
    onData(stream, _session, cb) {
      let raw = ''; stream.on('data', (c) => (raw += c.toString()));
      stream.on('end', () => setTimeout(() => { inbox.push({ to: (smtp as unknown as { _to?: string })._to ?? '', raw }); cb(); }, slowMs));
    },
  });
  await new Promise<void>((res) => smtp.listen(0, '127.0.0.1', res));
  const port = (smtp.server.address() as { port: number }).port;
  Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(port), SMTP_SECURE: 'false', MAIL_FROM: 'Pawzora <no-reply@pawzora.test>', PUBLIC_URL: 'https://shop.test' });
  delete process.env.SMTP_USER;
  resetMailer();

  const cat = await prisma.category.findFirstOrThrow({ where: { kind: 'PRODUCT' } });
  const pet = await prisma.category.findFirstOrThrow({ where: { kind: 'PET' } });
  productId = (await prisma.product.create({ data: { name: `ZZ Mail Product ${stamp}`, slug: `zz-mail-product-${stamp}`, description: 'test', brand: 'TestCo', price: 250, categoryId: pet.id === cat.id ? cat.id : cat.id, petTypeId: pet.id, isDemo: true, inventory: { create: { quantity: 20 } } } })).id;
});
beforeEach(() => { inbox.length = 0; slowMs = 0; });

afterAll(async () => {
  await new Promise((r) => smtp.close(() => r(null)));
  Object.assign(process.env, { SMTP_HOST: saved.SMTP_HOST, SMTP_PORT: saved.SMTP_PORT, MAIL_FROM: saved.MAIL_FROM, PUBLIC_URL: saved.PUBLIC_URL });
  for (const k of ['SMTP_HOST', 'SMTP_PORT', 'MAIL_FROM', 'PUBLIC_URL']) if (saved[k] === undefined) delete process.env[k];
  resetMailer();
  await prisma.order.deleteMany({ where: { email: { endsWith: '@pawzora.test' } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@pawzora.test' } } });
  await prisma.cart.deleteMany({ where: { items: { some: { productId } } } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.$disconnect();
});

async function register(tag: string) {
  const a = request.agent(app);
  const email = `${tag}.${stamp}@pawzora.test`;
  expect((await a.post('/api/auth/register').set(H).send({ fullName: `Mail ${tag}`, email, password: 'Sup3rSecret!', acceptTerms: true })).status).toBe(201);
  return { a, email };
}

describe('password reset email', () => {
  it('emails a working one-time reset link to the account holder only', async () => {
    const { email } = await register('reset');
    const r = await request(app).post('/api/auth/forgot-password').set(H).send({ email });
    expect(r.status).toBe(200);
    expect(await waitFor(() => inbox.length === 1)).toBe(true);
    expect(inbox[0].to).toBe(email);
    const body = text(inbox[0]);
    const link = body.match(/https:\/\/shop\.test\/reset-password\?token=[A-Za-z0-9_-]+/)?.[0];
    expect(link).toBeTruthy();
    expect(link!.endsWith(new URL(r.body.devResetLink).searchParams.get('token')!)).toBe(true);
    const token = new URL(link!).searchParams.get('token')!;
    expect((await request(app).post('/api/auth/reset-password').set(H).send({ token, password: 'Brand-New-Pass1' })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').set(H).send({ email, password: 'Brand-New-Pass1' })).status).toBe(200);
  });

  it('sends nothing for an unknown address, and replies equally fast whether or not the account exists', async () => {
    const { email } = await register('reset2');
    slowMs = 1500; // a slow mail server must not slow the reply down
    const t1 = Date.now();
    const known = await request(app).post('/api/auth/forgot-password').set(H).send({ email });
    const knownMs = Date.now() - t1;
    const t2 = Date.now();
    const unknown = await request(app).post('/api/auth/forgot-password').set(H).send({ email: `nobody.${stamp}@pawzora.test` });
    const unknownMs = Date.now() - t2;
    expect(known.status).toBe(200); expect(unknown.status).toBe(200);
    expect(known.body.message).toBe(unknown.body.message);
    expect(knownMs).toBeLessThan(1000);
    expect(Math.abs(knownMs - unknownMs)).toBeLessThan(700);
    await waitFor(() => inbox.length === 1, 5000);
    expect(inbox.map((m) => m.to)).toEqual([email]);
  });

  it('still answers normally when the mail server is down', async () => {
    const { email } = await register('reset3');
    const keep = process.env.SMTP_PORT; process.env.SMTP_PORT = '1'; resetMailer();
    const r = await request(app).post('/api/auth/forgot-password').set(H).send({ email });
    expect(r.status).toBe(200);
    process.env.SMTP_PORT = keep; resetMailer();
  });
});

describe('order confirmation email', () => {
  const SHIP = { fullName: 'Mail Buyer', phone: '09171234567', address: '123 Test Street', barangay: 'Test', city: 'Test City', province: 'Test', postalCode: '1234', shippingMethod: 'STANDARD', paymentMethod: 'COD' };

  it('emails the order summary, and respects the customer turning order emails off', async () => {
    const { a, email } = await register('order');
    await a.post('/api/cart/items').set(H).send({ productId, quantity: 2 });
    const num = (await a.post('/api/checkout').set(H).send({ ...SHIP, email })).body.orderNumber as string;
    expect(await waitFor(() => inbox.length === 1)).toBe(true);
    const body = text(inbox[0]);
    expect(inbox[0].to).toBe(email);
    expect(body).toContain(num);
    expect(body).toContain('ZZ Mail Product');
    expect(body).toContain('599.00'); // 2 x 250 + 99 shipping
    expect(body).toContain(`https://shop.test/account/orders/${num}`);

    const { a: quiet, email: qEmail } = await register('order2');
    await quiet.patch('/api/auth/me').set(H).send({ notifyOrders: false });
    await quiet.post('/api/cart/items').set(H).send({ productId, quantity: 1 });
    expect((await quiet.post('/api/checkout').set(H).send({ ...SHIP, email: qEmail })).status).toBe(201);
    await new Promise((r) => setTimeout(r, 800));
    expect(inbox.some((m) => m.to === qEmail)).toBe(false);
  });
});

describe('configuration warning', () => {
  it('production warns loudly when email is not configured', () => {
    const base = { NODE_ENV: 'production', DATABASE_URL: 'x', CORS_ORIGIN: 'https://shop.example.com', PUBLIC_URL: 'https://shop.example.com' };
    expect(checkEnv(base).warnings.join()).toMatch(/SMTP_HOST/);
    expect(checkEnv({ ...base, SMTP_HOST: 'email-smtp.ap-southeast-1.amazonaws.com', MAIL_FROM: 'Pawzora <no-reply@example.com>' }).warnings).toEqual([]);
  });
});
