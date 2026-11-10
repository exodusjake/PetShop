import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/db';

const app = createApp();
const H = { 'X-Requested-With': 'pawzora' };
const stamp = Date.now();
const startedAt = new Date();
type Agent = ReturnType<typeof request.agent>;

const SHIP = { fullName: 'Admin Test Buyer', phone: '09171234567', email: `adm.buyer.${stamp}@pawzora.test`, address: '123 Test Street', barangay: 'Test', city: 'Test City', province: 'Test', postalCode: '1234', shippingMethod: 'STANDARD', paymentMethod: 'COD' };
// smallest valid PNG (1x1) padded so it passes the minimum-size sniff
const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082', 'hex'), Buffer.alloc(8)]);

let admin: Agent, productId = 0, stockProductId = 0, catId = 0, petId = 0;
const savedUploads: string[] = [];

const guest = () => request.agent(app);
async function register(tag: string) {
  const a = request.agent(app);
  const r = await a.post('/api/auth/register').set(H).send({ fullName: `Adm ${tag}`, email: `${tag}.${stamp}@pawzora.test`, password: 'Sup3rSecret!', acceptTerms: true });
  expect(r.status).toBe(201);
  return { a, id: r.body.user.id as number };
}
async function adminLogin() {
  const a = request.agent(app);
  const r = await a.post('/api/auth/login').set(H).send({ email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD });
  expect(r.status).toBe(200);
  return a;
}
const stockOf = async (id: number) => (await prisma.inventory.findUniqueOrThrow({ where: { productId: id } })).quantity;
async function placeOrder(buyer: Agent, qty = 1) {
  await buyer.post('/api/cart/items').set(H).send({ productId: stockProductId, quantity: qty });
  const r = await buyer.post('/api/checkout').set(H).send(SHIP);
  expect(r.status).toBe(201);
  return r.body.orderNumber as string;
}

beforeAll(async () => {
  expect(process.env.SEED_ADMIN_EMAIL, 'SEED_ADMIN_EMAIL must be set in backend/.env to run admin tests').toBeTruthy();
  admin = await adminLogin();
  const cat = await prisma.category.findFirstOrThrow({ where: { kind: 'PRODUCT' } });
  const pet = await prisma.category.findFirstOrThrow({ where: { kind: 'PET' } });
  catId = cat.id; petId = pet.id;
  stockProductId = (await prisma.product.create({ data: { name: `ZZ Adm Stock ${stamp}`, slug: `zz-adm-stock-${stamp}`, description: 'test product', brand: 'TestCo', price: 400, categoryId: cat.id, petTypeId: pet.id, isDemo: true, inventory: { create: { quantity: 50 } } } })).id;
});

afterAll(async () => {
  await prisma.order.deleteMany({ where: { email: { endsWith: '@pawzora.test' } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@pawzora.test' } } });
  await prisma.cart.deleteMany({ where: { items: { some: { productId: stockProductId } } } });
  await prisma.product.deleteMany({ where: { OR: [{ id: stockProductId }, { id: productId || -1 }, { name: { startsWith: 'ZZ Adm' } }] } });
  await prisma.category.deleteMany({ where: { name: { startsWith: 'ZZ Adm' } } });
  await prisma.storeSettings.deleteMany({ where: { key: 'contact_phone', value: `+63 000 ${stamp}` } });
  await prisma.adminAuditLog.deleteMany({ where: { createdAt: { gte: startedAt } } });
  for (const f of savedUploads) await fs.rm(path.resolve('uploads', f), { force: true });
  await prisma.$disconnect();
});

describe('access control on every admin route', () => {
  const routes: [string, string][] = [
    ['get', '/api/admin/stats'], ['get', '/api/admin/products'], ['post', '/api/admin/products'], ['patch', '/api/admin/products/1'], ['delete', '/api/admin/products/1'],
    ['get', '/api/admin/categories'], ['post', '/api/admin/categories'], ['get', '/api/admin/inventory'], ['patch', '/api/admin/inventory/1'],
    ['get', '/api/admin/orders'], ['get', '/api/admin/orders/PZ-X'], ['patch', '/api/admin/orders/PZ-X/status'], ['post', '/api/admin/orders/PZ-X/payment'], ['post', '/api/admin/orders/PZ-X/shipment'],
    ['get', '/api/admin/payments'], ['get', '/api/admin/customers'], ['patch', '/api/admin/customers/1/status'],
    ['get', '/api/admin/reports/sales'], ['get', '/api/admin/settings'], ['put', '/api/admin/settings'],
  ];
  it('rejects anonymous visitors with 401', async () => {
    for (const [m, url] of routes) expect((await (guest() as any)[m](url).set(H).send({})).status, `${m} ${url}`).toBe(401);
  });
  it('rejects logged-in customers with 403', async () => {
    const { a } = await register('plain');
    for (const [m, url] of routes) expect((await (a as any)[m](url).set(H).send({})).status, `${m} ${url}`).toBe(403);
  });
  it('lets the admin read the dashboard numbers', async () => {
    const r = await admin.get('/api/admin/stats');
    expect(r.status).toBe(200);
    expect(r.body.salesByDay).toHaveLength(30);
    expect(typeof r.body.totalRevenue).toBe('number');
  });
});

describe('uploads', () => {
  it('requires login', async () => {
    expect((await request(app).post('/api/uploads').set(H).set('Content-Type', 'image/png').send(PNG)).status).toBe(401);
  });
  it('refuses files that are not really images, whatever they claim to be', async () => {
    const { a } = await register('upl');
    const html = Buffer.from('<html><script>alert(1)</script></html> padded to be long enough');
    expect((await a.post('/api/uploads').set(H).set('Content-Type', 'image/png').send(html)).status).toBe(400);
    expect((await a.post('/api/uploads').set(H).set('Content-Type', 'image/svg+xml').send('<svg onload=alert(1)/>')).status).not.toBe(201);
  });
  it('stores a real image under a random name with the extension taken from its contents', async () => {
    const { a } = await register('upl2');
    const r = await a.post('/api/uploads').set(H).set('Content-Type', 'image/jpeg').send(PNG); // lies about being a jpeg
    expect(r.status).toBe(201);
    expect(r.body.url).toMatch(/^\/uploads\/[a-f0-9]{32}\.png$/);
    savedUploads.push(path.basename(r.body.url));
    expect((await request(app).get(r.body.url)).status).toBe(200);
  });
});

describe('customer account data', () => {
  it('keeps addresses private, manages the default, and reassigns it on delete', async () => {
    const { a } = await register('addr'), { a: other } = await register('addr2');
    const A = { label: 'Home', fullName: 'Jo Tester', phone: '09171234567', line1: '1 First Street', barangay: 'B1', city: 'C', province: 'P', postalCode: '1000' };
    const a1 = (await a.post('/api/account/addresses').set(H).send(A)).body;
    expect(a1.isDefault).toBe(true); // first address becomes the default
    const a2 = (await a.post('/api/account/addresses').set(H).send({ ...A, label: 'Work', isDefault: true })).body;
    let list = (await a.get('/api/account/addresses')).body;
    expect(list.filter((x: { isDefault: boolean }) => x.isDefault)).toHaveLength(1);
    expect(list.find((x: { id: number }) => x.id === a2.id).isDefault).toBe(true);
    expect((await other.patch(`/api/account/addresses/${a1.id}`).set(H).send(A)).status).toBe(404);
    expect((await other.delete(`/api/account/addresses/${a1.id}`).set(H)).status).toBe(404);
    expect((await other.get('/api/account/addresses')).body).toHaveLength(0);
    expect((await a.post('/api/account/addresses').set(H).send({ ...A, postalCode: 'abc' })).status).toBe(400);
    await a.delete(`/api/account/addresses/${a2.id}`).set(H);
    list = (await a.get('/api/account/addresses')).body;
    expect(list).toHaveLength(1);
    expect(list[0].isDefault).toBe(true);
  });

  it('keeps pets private and only accepts our own image paths', async () => {
    const { a } = await register('pet'), { a: other } = await register('pet2');
    const pet = (await a.post('/api/account/pets').set(H).send({ name: 'Rex', species: 'Dog', breed: 'Aspin', gender: 'Male', birthDate: '2022-03-01' })).body;
    expect(pet.name).toBe('Rex');
    expect((await other.patch(`/api/account/pets/${pet.id}`).set(H).send({ name: 'Hacked', species: 'Dog' })).status).toBe(404);
    expect((await other.get('/api/account/pets')).body).toHaveLength(0);
    expect((await a.post('/api/account/pets').set(H).send({ name: 'Evil', species: 'Dog', photoUrl: 'https://evil.example/x.png' })).status).toBe(400);
    expect((await a.post('/api/account/pets').set(H).send({ name: 'Future', species: 'Dog', birthDate: '2999-01-01' })).status).toBe(400);
    expect((await a.get('/api/account/summary')).body.pets).toBe(1);
    expect((await a.delete(`/api/account/pets/${pet.id}`).set(H)).status).toBe(200);
  });
});

describe('admin products, categories and inventory', () => {
  it('creates a product that appears in the shop, and validates the input', async () => {
    const body = { name: `ZZ Adm Product ${stamp}`, brand: 'TestCo', description: 'A test product for admin', price: 250, salePrice: null, saleEndsAt: null, categoryId: catId, petTypeId: petId, stock: 12, lowStockThreshold: 3, isFeatured: false, isActive: true, images: ['/img/prod-bed.png'] };
    expect((await admin.post('/api/admin/products').set(H).send({ ...body, price: -5 })).status).toBe(400);
    expect((await admin.post('/api/admin/products').set(H).send({ ...body, salePrice: 300 })).status).toBe(400); // sale must be lower
    expect((await admin.post('/api/admin/products').set(H).send({ ...body, images: ['https://evil.example/a.png'] })).status).toBe(400);
    const r = await admin.post('/api/admin/products').set(H).send(body);
    expect(r.status).toBe(201);
    productId = r.body.id;
    const pub = await request(app).get(`/api/catalog/products/${r.body.slug}`);
    expect(pub.status).toBe(200);
    expect(pub.body.stock).toBe(12);
    expect((await prisma.adminAuditLog.count({ where: { action: 'product.create', entityId: String(productId) } }))).toBe(1);
  });

  it('applies a sale price, then hides the product when archived and shows it again when restored', async () => {
    const cur = (await admin.get(`/api/admin/products/${productId}`)).body;
    const upd = await admin.patch(`/api/admin/products/${productId}`).set(H).send({ ...cur, salePrice: 200, saleEndsAt: new Date(Date.now() + 864e5).toISOString() });
    expect(upd.status).toBe(200);
    const pub = await request(app).get(`/api/catalog/products/${cur.slug}`);
    expect(pub.body.onSale).toBe(true);
    expect(pub.body.effectivePrice).toBe(200);
    expect((await admin.delete(`/api/admin/products/${productId}`).set(H)).status).toBe(200);
    expect((await request(app).get(`/api/catalog/products/${cur.slug}`)).status).toBe(404);
    expect((await request(app).get('/api/catalog/products?q=ZZ%20Adm%20Product')).body.total).toBe(0);
    expect((await admin.post(`/api/admin/products/${productId}/restore`).set(H)).status).toBe(200);
    expect((await request(app).get(`/api/catalog/products/${cur.slug}`)).status).toBe(200);
  });

  it('adjusts stock, refuses negative stock, and protects categories that are in use', async () => {
    expect((await admin.patch(`/api/admin/inventory/${productId}`).set(H).send({ delta: -5 })).body.quantity).toBe(7);
    expect((await admin.patch(`/api/admin/inventory/${productId}`).set(H).send({ delta: -50 })).status).toBe(400);
    expect((await admin.patch(`/api/admin/inventory/${productId}`).set(H).send({ quantity: 2 })).body.quantity).toBe(2);
    const low = await admin.get('/api/admin/inventory?low=true&pageSize=100');
    expect(low.body.items.some((i: { productId: number }) => i.productId === productId)).toBe(true);
    const c = await admin.post('/api/admin/categories').set(H).send({ name: `ZZ Adm Cat ${stamp}`, kind: 'PRODUCT' });
    expect(c.status).toBe(201);
    expect((await admin.post('/api/admin/categories').set(H).send({ name: `ZZ Adm Cat ${stamp}`, kind: 'PRODUCT' })).status).toBe(409);
    expect((await admin.delete(`/api/admin/categories/${catId}`).set(H)).status).toBe(409); // has products
    expect((await admin.delete(`/api/admin/categories/${c.body.id}`).set(H)).status).toBe(200);
  });
});

describe('admin order management', () => {
  it('enforces the order status flow and restocks on cancel', async () => {
    const { a: buyer } = await register('flow');
    const num = await placeOrder(buyer, 2);
    const afterOrder = await stockOf(stockProductId);
    const set = (status: string) => admin.patch(`/api/admin/orders/${num}/status`).set(H).send({ status });

    expect((await set('SHIPPED')).status).toBe(409); // can't skip steps
    expect((await set('DELIVERED')).status).toBe(409);
    expect((await set('CONFIRMED')).body.status).toBe('CONFIRMED');
    expect((await set('PROCESSING')).body.status).toBe('PROCESSING');
    const cancelled = await set('CANCELLED');
    expect(cancelled.body.status).toBe('CANCELLED');
    expect(await stockOf(stockProductId)).toBe(afterOrder + 2);
    expect((await set('CONFIRMED')).status).toBe(409); // final
    expect((await buyer.get(`/api/orders/${num}`)).body.status).toBe('CANCELLED');
  });

  it('records shipment and COD payment, shows tracking to the customer, and blocks fake online payments', async () => {
    const { a: buyer } = await register('ship');
    const num = await placeOrder(buyer);
    const set = (status: string) => admin.patch(`/api/admin/orders/${num}/status`).set(H).send({ status });
    for (const s of ['CONFIRMED', 'PROCESSING', 'SHIPPED']) expect((await set(s)).status).toBe(200);
    expect((await admin.post(`/api/admin/orders/${num}/shipment`).set(H).send({ carrier: 'X', status: 'IN_TRANSIT' })).status).toBe(400); // courier name too short
    const sh = await admin.post(`/api/admin/orders/${num}/shipment`).set(H).send({ carrier: 'LBC Express', trackingNumber: 'LBC123456', status: 'IN_TRANSIT' });
    expect(sh.body.shipments[0].trackingNumber).toBe('LBC123456');
    expect((await buyer.get(`/api/orders/${num}`)).body.shipments[0].carrier).toBe('LBC Express');

    expect((await set('DELIVERED')).body.status).toBe('DELIVERED');
    expect((await admin.get(`/api/admin/orders/${num}`)).body.shipments[0].status).toBe('DELIVERED');
    const paid = await admin.post(`/api/admin/orders/${num}/payment`).set(H).send({ action: 'MARK_PAID' });
    expect(paid.body.paymentStatus).toBe('PAID');
    expect((await admin.post(`/api/admin/orders/${num}/payment`).set(H).send({ action: 'MARK_PAID' })).status).toBe(409);
    expect((await admin.post(`/api/admin/orders/${num}/payment`).set(H).send({ action: 'REFUND' })).body.paymentStatus).toBe('REFUNDED');

    const { a: buyer2 } = await register('ship2');
    const num2 = await placeOrder(buyer2);
    await prisma.order.update({ where: { orderNumber: num2 }, data: { paymentMethod: 'GCASH' } });
    const fake = await admin.post(`/api/admin/orders/${num2}/payment`).set(H).send({ action: 'MARK_PAID' });
    expect(fake.status).toBe(400);
    expect(fake.body.message).toMatch(/provider/i);
  });

  it('lists and filters orders and payments', async () => {
    const r = await admin.get('/api/admin/orders?status=CANCELLED&q=adm.buyer');
    expect(r.status).toBe(200);
    expect(r.body.items.every((o: { status: string }) => o.status === 'CANCELLED')).toBe(true);
    expect((await admin.get('/api/admin/payments?status=PENDING')).body.totals).toHaveProperty('pending');
  });
});

describe('admin customers, reports and settings', () => {
  it('suspending a customer signs them out and blocks login, and admins cannot be suspended', async () => {
    const { a, id } = await register('susp');
    expect((await a.get('/api/auth/me')).body.user).toBeTruthy();
    expect((await admin.patch(`/api/admin/customers/${id}/status`).set(H).send({ status: 'SUSPENDED' })).status).toBe(200);
    expect((await a.get('/api/auth/me')).body.user).toBeNull();
    expect((await guest().post('/api/auth/login').set(H).send({ email: `susp.${stamp}@pawzora.test`, password: 'Sup3rSecret!' })).status).toBe(403);
    expect((await admin.patch(`/api/admin/customers/${id}/status`).set(H).send({ status: 'ACTIVE' })).status).toBe(200);
    expect((await guest().post('/api/auth/login').set(H).send({ email: `susp.${stamp}@pawzora.test`, password: 'Sup3rSecret!' })).status).toBe(200);
    const me = (await admin.get('/api/auth/me')).body.user;
    expect((await admin.patch(`/api/admin/customers/${me.id}/status`).set(H).send({ status: 'SUSPENDED' })).status).toBe(404);
  });

  it('exports CSV reports and neutralises spreadsheet formulas', async () => {
    const evil = request.agent(app);
    await evil.post('/api/auth/register').set(H).send({ fullName: '=HYPERLINK("http://evil.example","x")', email: `csv.${stamp}@pawzora.test`, password: 'Sup3rSecret!', acceptTerms: true });
    const today = new Date().toISOString().slice(0, 10);
    const r = await admin.get(`/api/admin/reports/customers?format=csv&from=${today}&to=${today}`);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/text\/csv/);
    expect(r.headers['content-disposition']).toMatch(/attachment/);
    expect(r.text).toContain("'=HYPERLINK"); // prefixed with an apostrophe so Excel won't run it
    expect(r.text).not.toMatch(/(^|,)=HYPERLINK/m);
    expect((await admin.get('/api/admin/reports/sales?from=2020-01-01&to=2026-12-31')).status).toBe(400); // range too long
    expect((await admin.get('/api/admin/reports/nope')).status).toBe(404);
    const sales = await admin.get(`/api/admin/reports/sales?from=${today}&to=${today}`);
    expect(sales.body.headers[0]).toBe('Date');
  });

  it('validates settings, rejects unknown keys and publishes changes to the storefront', async () => {
    expect((await admin.put('/api/admin/settings').set(H).send({ is_admin: 'true' })).status).toBe(400);
    expect((await admin.put('/api/admin/settings').set(H).send({ contact_email: 'not-an-email' })).status).toBe(400);
    expect((await admin.put('/api/admin/settings').set(H).send({ social_facebook: 'javascript:alert(1)' })).status).toBe(400);
    expect((await admin.put('/api/admin/settings').set(H).send({ shipping_standard_fee: 'abc' })).status).toBe(400);
    expect((await admin.put('/api/admin/settings').set(H).send({ contact_phone: `+63 000 ${stamp}` })).status).toBe(200);
    expect((await request(app).get('/api/catalog/settings')).body.contact_phone).toBe(`+63 000 ${stamp}`);
    await admin.put('/api/admin/settings').set(H).send({ contact_phone: '' });
  });
});
