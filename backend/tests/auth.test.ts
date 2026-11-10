import 'dotenv/config';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/db';

const app = createApp();
const H = { 'X-Requested-With': 'pawzora' };
const stamp = Date.now();
const email = `test.${stamp}@pawzora.test`;
const password = 'Sup3rSecret!';

const agent = () => request.agent(app);
const post = (a: ReturnType<typeof agent>, url: string, body: object) => a.post(url).set(H).send(body);

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: '@pawzora.test' } } });
  await prisma.$disconnect();
});

describe('registration', () => {
  it('rejects weak passwords and missing terms', async () => {
    const a = agent();
    expect((await post(a, '/api/auth/register', { fullName: 'T', email, password: 'short', acceptTerms: true })).status).toBe(400);
    expect((await post(a, '/api/auth/register', { fullName: 'Test User', email, password, acceptTerms: false })).status).toBe(400);
  });

  it('creates a CUSTOMER, logs in, hashes the password, and ignores a self-assigned admin role', async () => {
    const a = agent();
    const r = await post(a, '/api/auth/register', { fullName: 'Test User', email, password, acceptTerms: true, role: 'ADMIN', roleId: 2 });
    expect(r.status).toBe(201);
    expect(r.body.user.role).toBe('CUSTOMER');
    expect(r.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    const row = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(row.passwordHash).not.toContain(password);
    expect(row.passwordHash).toMatch(/^\$2[aby]\$/);
    expect((await a.get('/api/auth/me')).body.user.email).toBe(email);
  });

  it('detects duplicate accounts', async () => {
    const r = await post(agent(), '/api/auth/register', { fullName: 'Test User', email: email.toUpperCase(), password, acceptTerms: true });
    expect(r.status).toBe(409);
  });
});

describe('login / logout', () => {
  it('rejects a wrong password and an unknown email with the same message', async () => {
    const a = await post(agent(), '/api/auth/login', { email, password: 'wrong-password1' });
    const b = await post(agent(), '/api/auth/login', { email: `nobody.${stamp}@pawzora.test`, password });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.message).toBe(b.body.message);
  });

  it('logs in, keeps the session, and logs out', async () => {
    const a = agent();
    expect((await post(a, '/api/auth/login', { email, password, remember: true })).status).toBe(200);
    expect((await a.get('/api/auth/me')).body.user).toBeTruthy();
    await post(a, '/api/auth/logout', {});
    expect((await a.get('/api/auth/me')).body.user).toBeNull();
  });
});

describe('authorization', () => {
  it('blocks anonymous and customer access to admin routes', async () => {
    expect((await request(app).get('/api/admin/ping')).status).toBe(401);
    const a = agent();
    await post(a, '/api/auth/login', { email, password });
    expect((await a.get('/api/admin/ping')).status).toBe(403);
  });

  it('allows the dev admin (when SEED_ADMIN_* is configured)', async () => {
    if (!process.env.SEED_ADMIN_EMAIL || !process.env.SEED_ADMIN_PASSWORD) return;
    const a = agent();
    expect((await post(a, '/api/auth/login', { email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD })).status).toBe(200);
    expect((await a.get('/api/admin/ping')).status).toBe(200);
  });

  it('rejects state-changing requests without the CSRF header or from a foreign origin', async () => {
    expect((await request(app).post('/api/auth/logout').send({})).status).toBe(403);
    expect((await request(app).post('/api/auth/logout').set(H).set('Origin', 'http://evil.example').send({})).status).toBe(403);
  });

  it('requires login for the wishlist and scopes it to the user', async () => {
    expect((await request(app).get('/api/wishlist')).status).toBe(401);
    const a = agent();
    await post(a, '/api/auth/login', { email, password });
    const product = await prisma.product.findFirstOrThrow();
    expect((await a.put(`/api/wishlist/${product.id}`).set(H)).status).toBe(200);
    expect((await a.get('/api/wishlist')).body.map((p: { id: number }) => p.id)).toContain(product.id);
    const other = agent();
    expect((await other.get('/api/wishlist')).status).toBe(401);
  });
});

describe('password reset', () => {
  it('gives the same answer for unknown emails and resets with a valid token only once', async () => {
    const a = agent();
    const unknown = await post(a, '/api/auth/forgot-password', { email: `ghost.${stamp}@pawzora.test` });
    expect(unknown.status).toBe(200);
    expect(unknown.body.devResetLink).toBeUndefined();

    const known = await post(a, '/api/auth/forgot-password', { email });
    const token = new URL(known.body.devResetLink).searchParams.get('token')!;
    expect((await post(a, '/api/auth/reset-password', { token: 'x'.repeat(30), password: 'Another1Pass' })).status).toBe(400);
    expect((await post(a, '/api/auth/reset-password', { token, password: 'Another1Pass' })).status).toBe(200);
    expect((await post(a, '/api/auth/reset-password', { token, password: 'Another1Pass' })).status).toBe(400); // single use
    expect((await post(agent(), '/api/auth/login', { email, password: 'Another1Pass' })).status).toBe(200);
  });
});
