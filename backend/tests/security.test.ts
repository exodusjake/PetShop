import 'dotenv/config';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/db';
import { checkEnv } from '../src/lib/env';
import { loginThrottle } from '../src/lib/loginThrottle';

const app = createApp();
const H = { 'X-Requested-With': 'pawzora' };
const stamp = Date.now();

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: '@pawzora.test' } } });
  await prisma.$disconnect();
});
beforeEach(() => loginThrottle.reset());

describe('production configuration check', () => {
  const good = { NODE_ENV: 'production', DATABASE_URL: 'sqlserver://x', CORS_ORIGIN: 'https://shop.example.com', PUBLIC_URL: 'https://shop.example.com', PAYMENT_METHODS_ENABLED: 'COD', SMTP_HOST: 'smtp.example.com', MAIL_FROM: 'Pawzora <no-reply@example.com>' };

  it('accepts a sound production config without warnings', () => {
    expect(checkEnv(good)).toEqual({ errors: [], warnings: [] });
  });
  it('refuses to start without a database, or with a wildcard / missing CORS origin', () => {
    expect(checkEnv({ ...good, DATABASE_URL: undefined }).errors.join()).toMatch(/DATABASE_URL/);
    expect(checkEnv({ ...good, CORS_ORIGIN: '*' }).errors.join()).toMatch(/CORS_ORIGIN/);
    expect(checkEnv({ ...good, CORS_ORIGIN: undefined }).errors.join()).toMatch(/CORS_ORIGIN/);
  });
  it('refuses online payment methods that have no provider behind them', () => {
    expect(checkEnv({ ...good, PAYMENT_METHODS_ENABLED: 'COD,GCASH' }).errors.join()).toMatch(/GCASH/);
  });
  it('warns about http, localhost, insecure cookies, leftover seed admin and example passwords', () => {
    const w = checkEnv({ ...good, CORS_ORIGIN: 'http://localhost:5173', COOKIE_SECURE: 'false', SEED_ADMIN_EMAIL: 'a@b.c', SEED_ADMIN_PASSWORD: 'ChangeMe#Admin1', PUBLIC_URL: undefined }).warnings.join(' | ');
    for (const re of [/localhost/, /http:\/\//, /COOKIE_SECURE/, /SEED_ADMIN/, /example password/i, /PUBLIC_URL/]) expect(w).toMatch(re);
  });
  it('is relaxed in development', () => {
    expect(checkEnv({ DATABASE_URL: 'x' })).toEqual({ errors: [], warnings: [] });
  });
});

describe('login throttling', () => {
  const email = `throttle.${stamp}@pawzora.test`;

  it('locks an account/IP pair after repeated wrong passwords, even for the correct password, and lifts after the window', async () => {
    const a = request.agent(app);
    expect((await a.post('/api/auth/register').set(H).send({ fullName: 'Throttle Test', email, password: 'Sup3rSecret!', acceptTerms: true })).status).toBe(201);
    const login = (password: string) => request(app).post('/api/auth/login').set(H).send({ email, password });

    for (let i = 0; i < 5; i++) expect((await login('wrong-password1')).status).toBe(401);
    const blocked = await login('Sup3rSecret!'); // the right password is refused too while blocked
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);

    // a different account from the same address isn't affected by this lock
    expect((await request(app).post('/api/auth/login').set(H).send({ email: `other.${stamp}@pawzora.test`, password: 'nope-nope-1' })).status).toBe(401);

    loginThrottle.reset(); // simulates the 15-minute window passing
    expect((await login('Sup3rSecret!')).status).toBe(200);
  });

  it('clears the failure count after a successful login', async () => {
    const login = (password: string) => request(app).post('/api/auth/login').set(H).send({ email, password });
    for (let i = 0; i < 4; i++) await login('wrong-password1');
    expect((await login('Sup3rSecret!')).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await login('wrong-password1')).status).toBe(401); // counter started over
  });
});

describe('request hardening', () => {
  it('answers malformed JSON with 400 (not a 500 or a stack trace)', async () => {
    const r = await request(app).post('/api/auth/login').set(H).set('Content-Type', 'application/json').send('{"email": "a@b.c", ');
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).not.toMatch(/stack|at .*\.ts|node_modules/i);
  });

  it('rejects oversized JSON bodies quickly (protects against huge-array validation attacks)', async () => {
    const huge = JSON.stringify({ productIds: Array.from({ length: 80_000 }, (_, i) => i) }); // ~500 KB
    const t0 = Date.now();
    const r = await request(app).post('/api/wishlist/merge').set(H).set('Content-Type', 'application/json').send(huge);
    expect(r.status).toBe(413);
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it('never lets browsers cache API responses, and sends the standard security headers', async () => {
    const r = await request(app).get('/api/catalog/categories');
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['x-powered-by']).toBeUndefined();
    expect(r.headers['x-frame-options']).toBeDefined();
  });

  it('returns a clean 404 for unknown API paths and does not leak internals on bad ids', async () => {
    expect((await request(app).get('/api/nope')).status).toBe(404);
    const r = await request(app).get('/api/catalog/products/%27%3B%20DROP%20TABLE%20Product%3B--');
    expect(r.status).toBe(404);
    expect(await prisma.product.count()).toBeGreaterThan(0);
  });

  it('rotates the session on login (an old session cookie stops working)', async () => {
    const a = request.agent(app);
    const reg = await a.post('/api/auth/register').set(H).send({ fullName: 'Rotate Test', email: `rotate.${stamp}@pawzora.test`, password: 'Sup3rSecret!', acceptTerms: true });
    const oldCookie = (reg.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('pz_session='))!.split(';')[0];
    const again = await a.post('/api/auth/login').set(H).send({ email: `rotate.${stamp}@pawzora.test`, password: 'Sup3rSecret!' });
    expect(again.status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Cookie', oldCookie)).body.user).toBeNull();
    expect((await a.get('/api/auth/me')).body.user).toBeTruthy();
  });
});
