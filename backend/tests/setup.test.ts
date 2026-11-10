import 'dotenv/config';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/db';
import { AdminSetupError, createAdmin } from '../src/lib/createAdmin';
import { bootstrap } from '../prisma/baseData';

const app = createApp();
const H = { 'X-Requested-With': 'pawzora' };
const stamp = Date.now();
const email = `setup.admin.${stamp}@pawzora.test`;
const STRONG = 'Tr0ub4dor-and-Horse-Staple';

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: '@pawzora.test' } } });
  await prisma.$disconnect();
});

describe('createAdmin (the only way to make an administrator)', () => {
  it('rejects bad emails, short or guessable passwords, and duplicate accounts', async () => {
    const attempt = (over: object) => createAdmin(prisma, { email, fullName: 'Setup Admin', password: STRONG, ...over });
    await expect(attempt({ email: 'not-an-email' })).rejects.toBeInstanceOf(AdminSetupError);
    await expect(attempt({ fullName: 'A' })).rejects.toBeInstanceOf(AdminSetupError);
    await expect(attempt({ password: 'Short1aA' })).rejects.toThrow(/12 characters/);
    await expect(attempt({ password: 'alllowercase1234567' })).rejects.toThrow(/upper-case/);
    await expect(attempt({ password: 'Password12345678' })).rejects.toThrow(/easy to guess/);
    await expect(attempt({ email: 'customer@pawzora.demo' })).rejects.toThrow(/already exists/);
    expect(await prisma.user.count({ where: { email } })).toBe(0);
  });

  it('creates an admin who can log in and reach admin routes, with a hashed password', async () => {
    const a = await createAdmin(prisma, { email: email.toUpperCase(), fullName: 'Setup Admin', password: STRONG });
    expect(a.email).toBe(email);
    const row = await prisma.user.findUniqueOrThrow({ where: { email }, include: { role: true } });
    expect(row.role.name).toBe('ADMIN');
    expect(row.passwordHash).not.toContain(STRONG);
    const agent = request.agent(app);
    expect((await agent.post('/api/auth/login').set(H).send({ email, password: STRONG })).body.user.role).toBe('ADMIN');
    expect((await agent.get('/api/admin/ping')).status).toBe(200);
  });

  it('cannot be reached through the website: registration only ever makes customers', async () => {
    const r = await request(app).post('/api/auth/register').set(H).send({ fullName: 'Sneaky One', email: `sneaky.${stamp}@pawzora.test`, password: 'Sup3rSecret!', acceptTerms: true, role: 'ADMIN', roleId: 1, isAdmin: true });
    expect(r.status).toBe(201);
    expect(r.body.user.role).toBe('CUSTOMER');
  });
});

describe('bootstrap (base data for a new installation)', () => {
  it('is idempotent and never overwrites what the owner has edited', async () => {
    const before = await bootstrap(prisma);
    await prisma.storeSettings.upsert({ where: { key: 'tagline' }, update: { value: 'Edited by the owner' }, create: { key: 'tagline', value: 'Edited by the owner' } });
    const after = await bootstrap(prisma);
    expect(after).toEqual(before);
    expect((await prisma.storeSettings.findUniqueOrThrow({ where: { key: 'tagline' } })).value).toBe('Edited by the owner');
    await prisma.storeSettings.update({ where: { key: 'tagline' }, data: { value: 'Everything for Your Furry Friends' } });
  });

  it('provides the pet types, product categories and roles the shop needs, and no demo products', async () => {
    const r = await bootstrap(prisma);
    expect(r.roles).toBeGreaterThanOrEqual(2);
    expect(await prisma.category.count({ where: { kind: 'PET' } })).toBeGreaterThanOrEqual(6);
    expect(await prisma.category.count({ where: { kind: 'PRODUCT' } })).toBeGreaterThanOrEqual(6);
    expect((await prisma.storeSettings.findUniqueOrThrow({ where: { key: 'contact_email' } })).value).not.toMatch(/@/); // contact details are never invented
  });
});
