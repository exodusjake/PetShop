import 'dotenv/config';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/db';

const app = createApp();
const H = { 'X-Requested-With': 'pawzora' };
const stamp = Date.now();
const startedAt = new Date();
type Agent = ReturnType<typeof request.agent>;

let admin: Agent, productId = 0, productSlug = '', catId = 0;
const SHIP = { fullName: 'Content Buyer', phone: '09171234567', email: `content.buyer.${stamp}@pawzora.test`, address: '123 Test Street', barangay: 'Test', city: 'Test City', province: 'Test', postalCode: '1234', shippingMethod: 'STANDARD', paymentMethod: 'COD' };
const guest = () => request.agent(app);

async function register(tag: string) {
  const a = request.agent(app);
  const r = await a.post('/api/auth/register').set(H).send({ fullName: `Con Tester ${tag}`, email: `${tag}.${stamp}@pawzora.test`, password: 'Sup3rSecret!', acceptTerms: true });
  expect(r.status).toBe(201);
  return a;
}
async function deliveredOrderFor(buyer: Agent) {
  await buyer.post('/api/cart/items').set(H).send({ productId, quantity: 1 });
  const num = (await buyer.post('/api/checkout').set(H).send(SHIP)).body.orderNumber as string;
  for (const status of ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED']) expect((await admin.patch(`/api/admin/orders/${num}/status`).set(H).send({ status })).status).toBe(200);
  return num;
}
const listingBody = (name: string, extra: object = {}) => ({ name, species: 'Dog', breed: 'Aspin', ageMonths: 18, gender: 'Male', description: 'A friendly test dog looking for a home.', status: 'AVAILABLE', location: 'Test City', requirements: 'Valid ID and a home visit are required.', photoUrl: '/img/pet-dogs.png', ...extra });
const APPLY = { applicantName: 'Con Tester', phone: '09171234567', address: '1 Test Street, Test City', livingSituation: 'House with a small fenced yard', experience: 'I have had dogs for ten years.', reason: 'I want to give a rescue dog a loving forever home.' };

beforeAll(async () => {
  admin = request.agent(app);
  expect((await admin.post('/api/auth/login').set(H).send({ email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD })).status).toBe(200);
  const cat = await prisma.category.findFirstOrThrow({ where: { kind: 'PRODUCT' } });
  const pet = await prisma.category.findFirstOrThrow({ where: { kind: 'PET' } });
  const p = await prisma.product.create({ data: { name: `ZZ Content Product ${stamp}`, slug: `zz-content-product-${stamp}`, description: 'test product', brand: 'TestCo', price: 300, categoryId: cat.id, petTypeId: pet.id, isDemo: true, inventory: { create: { quantity: 50 } } } });
  productId = p.id; productSlug = p.slug;
  catId = (await prisma.blogCategory.findFirstOrThrow()).id;
});

afterAll(async () => {
  await prisma.order.deleteMany({ where: { email: { endsWith: '@pawzora.test' } } });
  await prisma.adoptionListing.deleteMany({ where: { name: { startsWith: 'ZZ Pet' } } }); // applications go with their listing
  await prisma.review.deleteMany({ where: { user: { email: { endsWith: '@pawzora.test' } } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@pawzora.test' } } });
  await prisma.cart.deleteMany({ where: { items: { some: { productId } } } });
  await prisma.product.deleteMany({ where: { OR: [{ id: productId }, { name: { startsWith: 'ZZ Content Product' } }] } });
  await prisma.blogPost.deleteMany({ where: { title: { startsWith: 'ZZ Blog' } } });
  await prisma.coupon.deleteMany({ where: { code: { startsWith: 'ZZ' } } });
  await prisma.contactMessage.deleteMany({ where: { email: { endsWith: '@pawzora.test' } } });
  await prisma.adminAuditLog.deleteMany({ where: { createdAt: { gte: startedAt } } });
  await prisma.$disconnect();
});

describe('access control on the new admin routes', () => {
  const routes: [string, string][] = [
    ['get', '/api/admin/counts'], ['get', '/api/admin/adoption/listings'], ['post', '/api/admin/adoption/listings'], ['patch', '/api/admin/adoption/listings/1'], ['delete', '/api/admin/adoption/listings/1'],
    ['get', '/api/admin/adoption/applications'], ['patch', '/api/admin/adoption/applications/1'],
    ['get', '/api/admin/blog/posts'], ['post', '/api/admin/blog/posts'], ['patch', '/api/admin/blog/posts/1'], ['delete', '/api/admin/blog/posts/1'], ['get', '/api/admin/blog/categories'],
    ['get', '/api/admin/reviews'], ['patch', '/api/admin/reviews/1'], ['delete', '/api/admin/reviews/1'],
    ['get', '/api/admin/coupons'], ['post', '/api/admin/coupons'], ['patch', '/api/admin/coupons/1'], ['delete', '/api/admin/coupons/1'],
    ['get', '/api/admin/messages'], ['patch', '/api/admin/messages/1'], ['delete', '/api/admin/messages/1'],
  ];
  it('rejects anonymous visitors (401) and customers (403) everywhere', async () => {
    const customer = await register('acl');
    for (const [m, url] of routes) {
      expect((await (guest() as any)[m](url).set(H).send({})).status, `anon ${m} ${url}`).toBe(401);
      expect((await (customer as any)[m](url).set(H).send({})).status, `customer ${m} ${url}`).toBe(403);
    }
  });
});

describe('adoption', () => {
  it('needs an account, validates the form, and only ever creates a PENDING application', async () => {
    const listing = (await admin.post('/api/admin/adoption/listings').set(H).send(listingBody(`ZZ Pet Apply ${stamp}`))).body;
    expect((await guest().post(`/api/adoption/${listing.id}/apply`).set(H).send(APPLY)).status).toBe(401);
    const a = await register('adopt');
    expect((await a.post(`/api/adoption/${listing.id}/apply`).set(H).send({ ...APPLY, reason: 'x' })).status).toBe(400);
    const r = await a.post(`/api/adoption/${listing.id}/apply`).set(H).send({ ...APPLY, status: 'APPROVED' }); // self-approval attempt
    expect(r.status).toBe(201);
    expect(r.body.status).toBe('PENDING');
    expect((await a.post(`/api/adoption/${listing.id}/apply`).set(H).send(APPLY)).status).toBe(409); // duplicate
    expect((await a.post('/api/adoption/999999/apply').set(H).send(APPLY)).status).toBe(404);
  });

  it('refuses applications for adopted pets and caps open applications at five', async () => {
    const a = await register('adopt2');
    const adopted = (await admin.post('/api/admin/adoption/listings').set(H).send(listingBody(`ZZ Pet Adopted ${stamp}`, { status: 'ADOPTED' }))).body;
    expect((await a.post(`/api/adoption/${adopted.id}/apply`).set(H).send(APPLY)).status).toBe(409);
    for (let i = 0; i < 5; i++) {
      const l = (await admin.post('/api/admin/adoption/listings').set(H).send(listingBody(`ZZ Pet Cap ${i} ${stamp}`))).body;
      expect((await a.post(`/api/adoption/${l.id}/apply`).set(H).send(APPLY)).status).toBe(201);
    }
    const sixth = (await admin.post('/api/admin/adoption/listings').set(H).send(listingBody(`ZZ Pet Cap 6 ${stamp}`))).body;
    expect((await a.post(`/api/adoption/${sixth.id}/apply`).set(H).send(APPLY)).status).toBe(409);
  });

  it('lets an admin review step by step, shows the decision to the applicant only, and never auto-changes the pet', async () => {
    const listing = (await admin.post('/api/admin/adoption/listings').set(H).send(listingBody(`ZZ Pet Review ${stamp}`))).body;
    const a = await register('adopt3'), other = await register('adopt4');
    await a.post(`/api/adoption/${listing.id}/apply`).set(H).send(APPLY);
    const app1 = (await admin.get(`/api/admin/adoption/applications?listingId=${listing.id}`)).body.items[0];
    expect(app1.status).toBe('PENDING');

    expect((await admin.patch(`/api/admin/adoption/applications/${app1.id}`).set(H).send({ status: 'UNDER_REVIEW' })).body.status).toBe('UNDER_REVIEW');
    const approved = await admin.patch(`/api/admin/adoption/applications/${app1.id}`).set(H).send({ status: 'APPROVED', adminNote: 'Home visit scheduled for Saturday.' });
    expect(approved.body.status).toBe('APPROVED');
    expect((await admin.patch(`/api/admin/adoption/applications/${app1.id}`).set(H).send({ status: 'REJECTED' })).status).toBe(409); // final

    const mine = (await a.get('/api/account/adoption-applications')).body;
    expect(mine).toHaveLength(1);
    expect(mine[0].status).toBe('APPROVED');
    expect(mine[0].adminNote).toMatch(/home visit/i);
    expect((await other.get('/api/account/adoption-applications')).body).toHaveLength(0);
    expect((await prisma.adoptionListing.findUniqueOrThrow({ where: { id: listing.id } })).status).toBe('AVAILABLE'); // admin changes the pet's status manually
  });

  it('validates listings and protects listings that have applications', async () => {
    expect((await admin.post('/api/admin/adoption/listings').set(H).send(listingBody(`ZZ Pet Bad ${stamp}`, { photoUrl: 'https://evil.example/a.png' }))).status).toBe(400);
    expect((await admin.post('/api/admin/adoption/listings').set(H).send(listingBody(`ZZ Pet Bad ${stamp}`, { ageMonths: -1 }))).status).toBe(400);
    const withApps = await prisma.adoptionListing.findFirstOrThrow({ where: { name: `ZZ Pet Apply ${stamp}` } });
    expect((await admin.delete(`/api/admin/adoption/listings/${withApps.id}`).set(H)).status).toBe(409);
    const fresh = (await admin.post('/api/admin/adoption/listings').set(H).send(listingBody(`ZZ Pet Fresh ${stamp}`))).body;
    expect((await admin.patch(`/api/admin/adoption/listings/${fresh.id}`).set(H).send(listingBody(`ZZ Pet Fresh ${stamp}`, { status: 'PENDING' }))).status).toBe(200);
    expect((await request(app).get(`/api/catalog/adoption/${fresh.id}`)).body.status).toBe('PENDING');
    expect((await admin.delete(`/api/admin/adoption/listings/${fresh.id}`).set(H)).status).toBe(200);
  });
});

describe('blog', () => {
  const post = (title: string, extra: object = {}) => ({ title, excerpt: 'A short summary for the test article.', content: 'First paragraph of the article, long enough to pass validation.\n\n## A heading\n\nMore text.', categoryId: catId, status: 'DRAFT', ...extra });

  it('keeps drafts private, publishes on request, and keeps a published address stable', async () => {
    const title = `ZZ Blog Post ${stamp}`;
    const draft = await admin.post('/api/admin/blog/posts').set(H).send(post(title));
    expect(draft.status).toBe(201);
    expect(draft.body.publishedAt).toBeNull();
    expect((await request(app).get(`/api/catalog/blog/posts/${draft.body.slug}`)).status).toBe(404);
    expect((await request(app).get('/api/catalog/blog/posts?q=ZZ%20Blog')).body.total).toBe(0);

    const published = await admin.patch(`/api/admin/blog/posts/${draft.body.id}`).set(H).send(post(title, { status: 'PUBLISHED' }));
    expect(published.body.status).toBe('PUBLISHED');
    expect((await request(app).get(`/api/catalog/blog/posts/${draft.body.slug}`)).status).toBe(200);
    expect((await request(app).get('/api/catalog/blog/posts?q=ZZ%20Blog')).body.total).toBe(1);
    const cat = (await request(app).get('/api/catalog/blog/categories')).body.find((c: { id: number }) => c.id === catId);
    expect((await request(app).get(`/api/catalog/blog/posts?category=${cat.slug}`)).body.items.some((p: { slug: string }) => p.slug === draft.body.slug)).toBe(true);

    const renamed = await admin.patch(`/api/admin/blog/posts/${draft.body.id}`).set(H).send(post(`${title} renamed`, { status: 'PUBLISHED' }));
    expect(renamed.body.slug).toBe(draft.body.slug);

    await admin.patch(`/api/admin/blog/posts/${draft.body.id}`).set(H).send(post(title, { status: 'DRAFT' })); // unpublish
    expect((await request(app).get(`/api/catalog/blog/posts/${draft.body.slug}`)).status).toBe(404);
    expect((await admin.delete(`/api/admin/blog/posts/${draft.body.id}`).set(H)).status).toBe(200);
  });

  it('validates articles (title, category, only our own cover images)', async () => {
    expect((await admin.post('/api/admin/blog/posts').set(H).send(post('ZZ'))).status).toBe(400);
    expect((await admin.post('/api/admin/blog/posts').set(H).send(post(`ZZ Blog Bad ${stamp}`, { coverUrl: 'https://evil.example/x.png' }))).status).toBe(400);
    expect((await admin.post('/api/admin/blog/posts').set(H).send(post(`ZZ Blog Bad ${stamp}`, { categoryId: 999999 }))).status).toBe(400);
  });
});

describe('verified-purchase reviews', () => {
  it('only lets customers who received the product review it, once, and recalculates the rating', async () => {
    const buyer = await register('rev'), stranger = await register('rev2');
    const url = `/api/catalog/products/${productSlug}`;
    expect((await guest().get(`${url}/review-status`)).body.reason).toBe('login');
    expect((await guest().post(`${url}/reviews`).set(H).send({ rating: 5, body: 'Great product indeed.' })).status).toBe(401);
    expect((await stranger.get(`${url}/review-status`)).body.reason).toBe('not-purchased');
    expect((await stranger.post(`${url}/reviews`).set(H).send({ rating: 5, body: 'I never bought this.' })).status).toBe(403);

    await deliveredOrderFor(buyer);
    expect((await buyer.get(`${url}/review-status`)).body.canReview).toBe(true);
    expect((await buyer.post(`${url}/reviews`).set(H).send({ rating: 6, body: 'Too many stars here.' })).status).toBe(400);
    expect((await buyer.post(`${url}/reviews`).set(H).send({ rating: 4, body: 'short' })).status).toBe(400);
    expect((await buyer.post(`${url}/reviews`).set(H).send({ rating: 4, title: 'Nice', body: 'Works well and arrived quickly.' })).status).toBe(201);
    expect((await buyer.post(`${url}/reviews`).set(H).send({ rating: 5, body: 'Trying to review twice.' })).status).toBe(409);

    const pub = (await request(app).get(url)).body;
    expect(pub.reviewCount).toBe(1);
    expect(pub.ratingAvg).toBe(4);
    expect(pub.reviews[0].author).toMatch(/^Con T\.$|^Con /); // never the full name or email
    expect(JSON.stringify(pub.reviews)).not.toContain('@');
  });

  it('lets an admin hide, republish and delete reviews, updating the average each time', async () => {
    const url = `/api/catalog/products/${productSlug}`;
    const review = (await admin.get('/api/admin/reviews?q=Works%20well&pageSize=50')).body.items.find((r: { product: { slug: string } }) => r.product.slug === productSlug);
    expect(review.verified).toBe(true);
    expect((await admin.patch(`/api/admin/reviews/${review.id}`).set(H).send({ status: 'HIDDEN' })).status).toBe(200);
    let pub = (await request(app).get(url)).body;
    expect(pub.reviewCount).toBe(0);
    expect(pub.reviews).toHaveLength(0);
    await admin.patch(`/api/admin/reviews/${review.id}`).set(H).send({ status: 'PUBLISHED' });
    expect((await request(app).get(url)).body.reviewCount).toBe(1);
    expect((await admin.delete(`/api/admin/reviews/${review.id}`).set(H)).status).toBe(200);
    pub = (await request(app).get(url)).body;
    expect(pub.reviewCount).toBe(0);
    expect(pub.ratingAvg).toBe(0);
  });
});

describe('promotions', () => {
  const code = `ZZPROMO${stamp}`.slice(0, 30);
  const body = (extra: object = {}) => ({ code, type: 'PERCENT', value: 15, minSubtotal: 0, startsAt: null, expiresAt: null, usageLimit: 10, isActive: true, ...extra });

  it('validates discount codes', async () => {
    expect((await admin.post('/api/admin/coupons').set(H).send(body({ value: 150 }))).status).toBe(400); // over 100%
    expect((await admin.post('/api/admin/coupons').set(H).send(body({ value: 0 }))).status).toBe(400);
    expect((await admin.post('/api/admin/coupons').set(H).send(body({ code: 'a b' }))).status).toBe(400);
    expect((await admin.post('/api/admin/coupons').set(H).send(body({ startsAt: '2030-01-10', expiresAt: '2030-01-01' }))).status).toBe(400);
    expect((await admin.post('/api/admin/coupons').set(H).send(body({ usageLimit: 0 }))).status).toBe(400);
  });

  it('creates a code that shoppers can use, can be disabled, and can only be deleted if never used', async () => {
    const created = await admin.post('/api/admin/coupons').set(H).send(body({ code: code.toLowerCase() })); // codes are stored upper-case
    expect(created.status).toBe(201);
    expect(created.body.code).toBe(code);
    expect((await admin.post('/api/admin/coupons').set(H).send(body())).status).toBe(409);

    const shopper = await register('promo');
    await shopper.post('/api/cart/items').set(H).send({ productId, quantity: 2 }); // 600
    const applied = await shopper.post('/api/cart/coupon').set(H).send({ code });
    expect(applied.body.discount).toBe(90);

    await admin.patch(`/api/admin/coupons/${created.body.id}`).set(H).send(body({ isActive: false }));
    const fresh = await register('promo2');
    await fresh.post('/api/cart/items').set(H).send({ productId, quantity: 1 });
    expect((await fresh.post('/api/cart/coupon').set(H).send({ code })).status).toBe(400); // disabled

    await admin.patch(`/api/admin/coupons/${created.body.id}`).set(H).send(body({ isActive: true }));
    await shopper.post('/api/checkout').set(H).send({ ...SHIP, email: `promo.${stamp}@pawzora.test` });
    expect((await admin.delete(`/api/admin/coupons/${created.body.id}`).set(H)).status).toBe(409); // used, so keep its history

    const spare = (await admin.post('/api/admin/coupons').set(H).send(body({ code: `ZZSPARE${stamp}`.slice(0, 30) }))).body;
    expect((await admin.delete(`/api/admin/coupons/${spare.id}`).set(H)).status).toBe(200);
    expect((await admin.get('/api/admin/coupons')).body.find((c: { code: string }) => c.code === code).usedCount).toBe(1);
  });
});

describe('contact form and inbox', () => {
  const msg = (extra: object = {}) => ({ name: 'Con Tester', email: `contact.${stamp}@pawzora.test`, subject: 'Question about delivery', message: 'Do you deliver to Cebu?', ...extra });

  it('stores real messages, ignores spam-bot submissions, and validates input', async () => {
    expect((await guest().post('/api/catalog/contact').set(H).send(msg({ email: 'nope' }))).status).toBe(400);
    expect((await guest().post('/api/catalog/contact').set(H).send(msg({ message: 'hi' }))).status).toBe(400);
    const before = await prisma.contactMessage.count({ where: { email: { endsWith: '@pawzora.test' } } });
    expect((await guest().post('/api/catalog/contact').set(H).send(msg({ website: 'http://spam.example' }))).status).toBe(201); // bot sees success...
    expect(await prisma.contactMessage.count({ where: { email: { endsWith: '@pawzora.test' } } })).toBe(before); // ...but nothing is stored
    expect((await guest().post('/api/catalog/contact').set(H).send(msg())).status).toBe(201);
    expect(await prisma.contactMessage.count({ where: { email: { endsWith: '@pawzora.test' } } })).toBe(before + 1);
  });

  it('shows messages to admins only, tracks unread, and lets them mark read or delete', async () => {
    const list = (await admin.get('/api/admin/messages?pageSize=100')).body;
    const mine = list.items.find((m: { email: string }) => m.email === `contact.${stamp}@pawzora.test`);
    expect(mine.read).toBe(false);
    expect(list.unread).toBeGreaterThan(0);
    expect((await admin.get('/api/admin/counts')).body.unreadMessages).toBe(list.unread);
    expect((await admin.patch(`/api/admin/messages/${mine.id}`).set(H).send({ read: true })).status).toBe(200);
    expect((await admin.get('/api/admin/messages?unread=true&pageSize=100')).body.items.some((m: { id: number }) => m.id === mine.id)).toBe(false);
    expect((await admin.delete(`/api/admin/messages/${mine.id}`).set(H)).status).toBe(200);
    expect((await admin.delete(`/api/admin/messages/${mine.id}`).set(H)).status).toBe(404);
  });
});
