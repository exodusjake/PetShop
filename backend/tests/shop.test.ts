import 'dotenv/config';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/db';

const app = createApp();
const H = { 'X-Requested-With': 'pawzora' };
const stamp = Date.now();
type Agent = ReturnType<typeof request.agent>;

let bigId = 0, lastId = 0;
const BIG_PRICE = 500;
const SHIP = { fullName: 'Test Buyer', phone: '09171234567', email: `buyer.${stamp}@pawzora.test`, address: '123 Test Street', barangay: 'Test', city: 'Test City', province: 'Test', postalCode: '1234', shippingMethod: 'STANDARD', paymentMethod: 'COD' };

const stockOf = async (productId: number) => (await prisma.inventory.findUniqueOrThrow({ where: { productId } })).quantity;
const guest = () => request.agent(app);
async function user(tag: string): Promise<Agent> {
  const a = request.agent(app);
  const r = await a.post('/api/auth/register').set(H).send({ fullName: `Shop ${tag}`, email: `${tag}.${stamp}@pawzora.test`, password: 'Sup3rSecret!', acceptTerms: true });
  expect(r.status).toBe(201);
  return a;
}
const add = (a: Agent, productId: number, quantity = 1, extra: object = {}) => a.post('/api/cart/items').set(H).send({ productId, quantity, ...extra });

beforeAll(async () => {
  const cat = await prisma.category.findFirstOrThrow({ where: { kind: 'PRODUCT' } });
  const pet = await prisma.category.findFirstOrThrow({ where: { kind: 'PET' } });
  const mk = (name: string, price: number, qty: number) => prisma.product.create({
    data: { name, slug: `${name.toLowerCase().replace(/\W+/g, '-')}-${stamp}`, description: 'test', brand: 'TestCo', price, categoryId: cat.id, petTypeId: pet.id, isDemo: true, inventory: { create: { quantity: qty } } },
  });
  bigId = (await mk('ZZ Test Big', BIG_PRICE, 40)).id;
  lastId = (await mk('ZZ Test Last Unit', 300, 1)).id;
  await prisma.coupon.create({ data: { code: `TESTPCT${stamp}`, type: 'PERCENT', value: 10, minSubtotal: 500 } });
  await prisma.coupon.create({ data: { code: `TESTOLD${stamp}`, type: 'FIXED', value: 50, expiresAt: new Date(Date.now() - 1000) } });
});

afterAll(async () => {
  await prisma.order.deleteMany({ where: { email: { endsWith: '@pawzora.test' } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@pawzora.test' } } });
  await prisma.cart.deleteMany({ where: { items: { some: { productId: { in: [bigId, lastId] } } } } });
  await prisma.coupon.deleteMany({ where: { code: { in: [`TESTPCT${stamp}`, `TESTOLD${stamp}`] } } });
  await prisma.product.deleteMany({ where: { id: { in: [bigId, lastId] } } });
  await prisma.$disconnect();
});

describe('cart', () => {
  it('prices from the database and ignores any price the client sends', async () => {
    const r = await add(guest(), bigId, 2, { price: 1, unitPrice: 1, total: 1 });
    expect(r.status).toBe(200);
    expect(r.body.lines[0].unitPrice).toBe(BIG_PRICE);
    expect(r.body.subtotal).toBe(1000);
    expect(r.body.shippingFee).toBe(99);
    expect(r.body.total).toBe(1099);
  });

  it('refuses to exceed available stock', async () => {
    const g = guest();
    expect((await add(g, lastId, 2)).status).toBe(409);
    expect((await add(g, lastId, 1)).status).toBe(200);
    expect((await add(g, lastId, 1)).status).toBe(409); // already holds the only unit
  });

  it('gives free standard shipping over the threshold and charges express shipping', async () => {
    const g = guest();
    await add(g, bigId, 5); // 2500
    expect((await g.get('/api/cart')).body.shippingFee).toBe(0);
    const exp = await g.get('/api/cart?shipping=EXPRESS');
    expect(exp.body.shippingFee).toBe(199);
    expect(exp.body.total).toBe(2699);
  });

  it('validates discount codes (unknown, expired, valid, removal)', async () => {
    const g = guest();
    await add(g, bigId, 1); // 500
    expect((await g.post('/api/cart/coupon').set(H).send({ code: 'NOPE' })).status).toBe(400);
    expect((await g.post('/api/cart/coupon').set(H).send({ code: `TESTOLD${stamp}` })).status).toBe(400);
    const ok = await g.post('/api/cart/coupon').set(H).send({ code: `testpct${stamp}` });
    expect(ok.status).toBe(200);
    expect(ok.body.discount).toBe(50);
    expect(ok.body.total).toBe(500 - 50 + 99);
    expect((await g.delete('/api/cart/coupon').set(H)).body.discount).toBe(0);
  });

  it("cannot touch another visitor's cart items", async () => {
    const a = guest(), b = guest();
    const itemId = (await add(a, bigId, 1)).body.lines[0].id;
    expect((await b.patch(`/api/cart/items/${itemId}`).set(H).send({ quantity: 5 })).status).toBe(404);
    await b.delete(`/api/cart/items/${itemId}`).set(H);
    expect((await a.get('/api/cart')).body.itemCount).toBe(1);
  });

  it('merges a guest cart into the account at sign-up', async () => {
    const g = request.agent(app);
    await add(g, bigId, 3);
    const reg = await g.post('/api/auth/register').set(H).send({ fullName: 'Merge Me', email: `merge.${stamp}@pawzora.test`, password: 'Sup3rSecret!', acceptTerms: true });
    expect(reg.status).toBe(201);
    expect((await g.get('/api/cart')).body.itemCount).toBe(3);
  });
});

describe('checkout and orders', () => {
  it('requires login and rejects online payments that have no provider', async () => {
    expect((await guest().post('/api/checkout').set(H).send(SHIP)).status).toBe(401);
    const u = await user('pay');
    await add(u, bigId, 1);
    const r = await u.post('/api/checkout').set(H).send({ ...SHIP, paymentMethod: 'GCASH' });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/not available/i);
  });

  it('places a COD order with server-calculated totals, deducts stock and empties the cart', async () => {
    const u = await user('cod');
    await add(u, bigId, 2, { price: 1 });
    const before = await stockOf(bigId);
    const r = await u.post('/api/checkout').set(H).send({ ...SHIP, total: 1, subtotal: 1 }); // tampered totals are ignored
    expect(r.status).toBe(201);
    const o = (await u.get(`/api/orders/${r.body.orderNumber}`)).body;
    expect(o.subtotal).toBe(1000);
    expect(o.total).toBe(1099);
    expect(o.status).toBe('PENDING');
    expect(o.paymentStatus).toBe('UNPAID'); // never marked paid without a verified provider
    expect(o.items[0].quantity).toBe(2);
    expect(await stockOf(bigId)).toBe(before - 2);
    expect((await u.get('/api/cart')).body.itemCount).toBe(0);
    expect((await u.post('/api/checkout').set(H).send(SHIP)).status).toBe(400); // double submit
  });

  it('never oversells the last unit when two customers check out at once', async () => {
    const a = await user('race1'), b = await user('race2');
    await add(a, lastId, 1);
    // the first cart holds the only unit; the second customer can still add it (nothing is reserved until checkout)
    await prisma.inventory.update({ where: { productId: lastId }, data: { quantity: 2 } });
    await add(b, lastId, 1);
    await prisma.inventory.update({ where: { productId: lastId }, data: { quantity: 1 } });
    const [ra, rb] = await Promise.all([a.post('/api/checkout').set(H).send(SHIP), b.post('/api/checkout').set(H).send(SHIP)]);
    expect([ra.status, rb.status].sort()).toEqual([201, 409]);
    expect(await stockOf(lastId)).toBe(0);
  });

  it('keeps orders private: other customers get 404 and only see their own list', async () => {
    const a = await user('own'), b = await user('snoop');
    await add(a, bigId, 1);
    const num = (await a.post('/api/checkout').set(H).send(SHIP)).body.orderNumber;
    expect((await b.get(`/api/orders/${num}`)).status).toBe(404);
    expect((await b.post(`/api/orders/${num}/cancel`).set(H)).status).toBe(404);
    expect((await b.get('/api/orders')).body).toHaveLength(0);
    expect((await a.get('/api/orders')).body).toHaveLength(1);
    expect((await guest().get(`/api/orders/${num}`)).status).toBe(401);
  });

  it('cancels an unpaid order once and restocks the items', async () => {
    const u = await user('cancel');
    await add(u, bigId, 3);
    const num = (await u.post('/api/checkout').set(H).send(SHIP)).body.orderNumber;
    const afterOrder = await stockOf(bigId);
    const c = await u.post(`/api/orders/${num}/cancel`).set(H);
    expect(c.status).toBe(200);
    expect(c.body.status).toBe('CANCELLED');
    expect(c.body.canCancel).toBe(false);
    expect(await stockOf(bigId)).toBe(afterOrder + 3);
    expect((await u.post(`/api/orders/${num}/cancel`).set(H)).status).toBe(409);
  });

  it('applies a discount code at checkout, counts its use and gives it back on cancel', async () => {
    const u = await user('coupon');
    await add(u, bigId, 2);
    await u.post('/api/cart/coupon').set(H).send({ code: `TESTPCT${stamp}` });
    const num = (await u.post('/api/checkout').set(H).send(SHIP)).body.orderNumber;
    const o = (await u.get(`/api/orders/${num}`)).body;
    expect(o.discountTotal).toBe(100);
    expect(o.total).toBe(1000 - 100 + 99);
    const used = async () => (await prisma.coupon.findUniqueOrThrow({ where: { code: `TESTPCT${stamp}` } })).usedCount;
    expect(await used()).toBe(1);
    await u.post(`/api/orders/${num}/cancel`).set(H);
    expect(await used()).toBe(0);
  });
});
