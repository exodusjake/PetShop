// Development seed. ALL data created here is DEMO data (flagged isDemo where the model has the column).
// Admin account: created ONLY when SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD are set, and never in production.
// SEED_CATALOG_ONLY=true skips the demo customer and demo orders (use it to fill a live shop with sample products).
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { slugify } from '../src/lib/constants.js';
import { BLOG_CATEGORIES, DEFAULT_SETTINGS, PET_TYPES, PRODUCT_CATS } from './baseData.js';

const prisma = new PrismaClient();

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo data in production.');
  process.exit(1);
}


// name, brand, petType, category, price, salePrice, image, featured, stock, blurb
type P = [string, string, string, string, number, number | null, string | null, boolean, number, string];
const PRODUCTS: P[] = [
  ['Ultra-Soft Pet Bed', 'PawComfort', 'Dogs', 'Beds & Houses', 899, null, '/img/prod-bed.png', true, 40, 'A plush, calming donut bed with a raised rim for head support and a non-slip base. Machine washable.'],
  ['Automatic Pet Feeder', 'SmartPaw', 'Cats', 'Food & Treats', 2499, 1999, '/img/prod-feeder.png', true, 18, 'Program up to 4 meals a day with portion control. Large 4L hopper and a stainless-steel bowl.'],
  ['No-Pull Dog Harness', 'TrailPup', 'Dogs', 'Collars & Leashes', 649, null, '/img/prod-harness.png', true, 60, 'Padded, adjustable and reflective. The front clip gently discourages pulling on walks.'],
  ['AquaView Fish Tank', 'AquaLife', 'Fish', 'Beds & Houses', 3999, null, '/img/prod-tank.png', true, 9, 'Crystal-clear glass aquarium with an LED hood and built-in filter. Perfect for freshwater tropical fish.'],
  ['Multi-Level Cat Tree', 'Whisker&Co', 'Cats', 'Beds & Houses', 4499, 3599, '/img/prod-cattree.png', true, 12, 'Sisal-wrapped posts, a cosy condo and two lounging platforms for climbing, scratching and napping.'],
  ['Premium Dog Kibble 5kg', 'NutriPaws', 'Dogs', 'Food & Treats', 1350, null, null, false, 80, 'Complete adult dog food with real chicken, brown rice and omega-3 for a shiny coat.'],
  ['Grain-Free Cat Food 2kg', 'NutriPaws', 'Cats', 'Food & Treats', 980, null, null, false, 70, 'High-protein grain-free recipe with salmon, supporting lean muscle and healthy digestion.'],
  ['Chicken Jerky Dog Treats', 'NutriPaws', 'Dogs', 'Food & Treats', 249, null, null, false, 120, 'Slow-roasted single-ingredient chicken strips. A great training reward.'],
  ['Tuna Treat Pouches (12 pack)', 'Whisker&Co', 'Cats', 'Food & Treats', 299, null, null, false, 90, 'Soft, lickable tuna purée pouches that cats go wild for.'],
  ['Rope Chew Toy Set', 'PlayPup', 'Dogs', 'Toys', 349, null, null, false, 75, 'Knotted cotton ropes that clean teeth and satisfy the urge to chew.'],
  ['Feather Wand Cat Toy', 'Whisker&Co', 'Cats', 'Toys', 179, 129, null, false, 100, 'Extendable wand with natural feathers to stimulate your cat\'s hunting instincts.'],
  ['Squeaky Ball 3-Pack', 'PlayPup', 'Dogs', 'Toys', 229, null, null, false, 110, 'Bouncy, durable rubber balls with a squeaker for endless fetch.'],
  ['Leather Collar & Leash Set', 'TrailPup', 'Dogs', 'Collars & Leashes', 799, null, null, false, 45, 'Hand-stitched leather collar with a matching 1.5 m leash and brass hardware.'],
  ['Reflective Cat Collar with Bell', 'Whisker&Co', 'Cats', 'Collars & Leashes', 149, null, null, false, 130, 'Breakaway safety buckle and reflective stitching for night visibility.'],
  ['Oatmeal Pet Shampoo 500ml', 'FreshFur', 'Dogs', 'Grooming & Care', 329, null, null, false, 65, 'Soothing oatmeal and aloe formula for sensitive skin. Tear-free and pH balanced.'],
  ['Deshedding Brush', 'FreshFur', 'Cats', 'Grooming & Care', 299, 249, null, false, 55, 'Removes loose undercoat and reduces shedding by up to 90%. Self-cleaning button.'],
  ['Tropical Fish Flakes 100g', 'AquaLife', 'Fish', 'Food & Treats', 159, null, null, false, 140, 'Nutritionally balanced flakes with spirulina for vivid colour and growth.'],
  ['Hard-Shell Pet Carrier', 'VoyagePaw', 'Cats', 'Travel & Carriers', 1599, null, null, false, 22, 'Airline-style ventilated carrier with a secure latch and a removable top.'],
  ['Foldable Travel Water Bottle', 'VoyagePaw', 'Dogs', 'Travel & Carriers', 259, null, null, false, 85, 'Leak-proof bottle with a flip-out bowl, so you can hydrate your dog anywhere.'],
  ['Rabbit Hay & Timothy Mix 1kg', 'Burrow', 'Small Pets', 'Food & Treats', 389, null, null, false, 60, 'Fresh, dust-extracted timothy hay blend for rabbits, guinea pigs and chinchillas.'],
  ['Hamster Wheel & Hideout', 'Burrow', 'Small Pets', 'Beds & Houses', 549, null, null, false, 35, 'Silent spinner wheel and a cosy wooden hideout in one set.'],
  ['Bird Seed Premium Mix 1kg', 'SkyChirp', 'Birds', 'Food & Treats', 289, null, null, false, 70, 'Seed, grain and dried fruit mix for budgies, lovebirds and cockatiels.'],
  ['Spacious Bird Cage', 'SkyChirp', 'Birds', 'Beds & Houses', 2899, null, null, false, 8, 'Powder-coated cage with two perches, feeders and a pull-out tray for easy cleaning.'],
  ['Reptile Heat Lamp Kit', 'TerraPaw', 'Reptiles', 'Beds & Houses', 1299, null, null, false, 14, 'Ceramic heat emitter with a dome lamp and thermostat for stable terrarium temperatures.'],
];

const NAMES = ['Emily R.', 'Marco D.', 'Anna L.', 'Josh P.', 'Kristine S.', 'Paolo V.'];
const REVIEW_TEXT = [
  [5, 'Great quality and my pet loves it!'], [5, 'Arrived fast and exactly as described.'],
  [4, 'Good value for the price. Would buy again.'], [5, 'Sturdy and well made. Highly recommended.'],
  [4, 'Nice product, packaging could be better.'],
] as const;

async function main() {
  // ── roles & users
  const customerRole = await prisma.role.upsert({ where: { name: 'CUSTOMER' }, update: {}, create: { name: 'CUSTOMER' } });
  const adminRole = await prisma.role.upsert({ where: { name: 'ADMIN' }, update: {}, create: { name: 'ADMIN' } });

  const catalogOnly = process.env.SEED_CATALOG_ONLY === 'true';
  const demoPw = await bcrypt.hash(process.env.SEED_DEMO_PASSWORD || 'Customer#12345', 10);
  const customer = catalogOnly ? null : await prisma.user.upsert({
    where: { email: 'customer@pawzora.demo' },
    update: {},
    create: { email: 'customer@pawzora.demo', fullName: 'Emma Carter (demo)', passwordHash: demoPw, roleId: customerRole.id, isDemo: true },
  });
  if (process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD) {
    await prisma.user.upsert({
      where: { email: process.env.SEED_ADMIN_EMAIL.toLowerCase() },
      update: { roleId: adminRole.id },
      create: {
        email: process.env.SEED_ADMIN_EMAIL.toLowerCase(), fullName: 'Pawzora Admin (dev)',
        passwordHash: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, 12), roleId: adminRole.id, isDemo: true,
      },
    });
    console.log('Dev admin ready:', process.env.SEED_ADMIN_EMAIL);
  } else {
    console.log('No SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD set – skipping admin creation.');
  }

  // ── categories
  const petIds: Record<string, number> = {};
  const catIds: Record<string, number> = {};
  for (const [i, [name, img]] of PET_TYPES.entries()) {
    const c = await prisma.category.upsert({
      where: { slug: slugify(name) }, update: { imageUrl: img },
      create: { name, slug: slugify(name), kind: 'PET', imageUrl: img, sortOrder: i },
    });
    petIds[name] = c.id;
  }
  for (const [i, [name, img]] of PRODUCT_CATS.entries()) {
    const c = await prisma.category.upsert({
      where: { slug: slugify(name) }, update: { imageUrl: img },
      create: { name, slug: slugify(name), kind: 'PRODUCT', imageUrl: img, sortOrder: i },
    });
    catIds[name] = c.id;
  }

  // ── products (+ images, inventory, demo reviews)
  const fallbackByPet: Record<string, string> = {
    'Small Pets': '/img/pet-small.png', Birds: '/img/pet-birds.png', Fish: '/img/pet-fish.png', Reptiles: '/img/pet-reptiles.png',
  };
  const catImage = Object.fromEntries(PRODUCT_CATS.map(([n, i]) => [n, i]));
  for (const [idx, [name, brand, pet, cat, price, sale, img, featured, stock, blurb]] of PRODUCTS.entries()) {
    const slug = slugify(name);
    if (await prisma.product.findUnique({ where: { slug } })) continue;
    const image = img ?? fallbackByPet[pet] ?? catImage[cat];
    const product = await prisma.product.create({
      data: {
        name, slug, brand, price, salePrice: sale, description: blurb + ' (Demo product)',
        categoryId: catIds[cat], petTypeId: petIds[pet], isFeatured: featured, isDemo: true,
        soldCount: 20 + ((idx * 37) % 180),
        images: { create: [{ url: image, alt: name, sortOrder: 0 }] },
        inventory: { create: { quantity: stock, lowStockThreshold: 10 } },
        ...(name === 'No-Pull Dog Harness'
          ? { variants: { create: ['S', 'M', 'L'].map((s) => ({ name: `Size ${s}`, sku: `HARNESS-${s}`, stock: 20 })) } }
          : {}),
      },
    });
    // 2–4 demo reviews
    const n = 2 + (idx % 3);
    const reviews = Array.from({ length: n }, (_, k) => {
      const [rating, body] = REVIEW_TEXT[(idx + k) % REVIEW_TEXT.length];
      return { productId: product.id, authorName: `${NAMES[(idx + k) % NAMES.length]} (demo)`, rating, body, isDemo: true };
    });
    await prisma.review.createMany({ data: reviews });
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    await prisma.product.update({ where: { id: product.id }, data: { ratingAvg: Math.round(avg * 10) / 10, reviewCount: reviews.length } });
  }

  // ── coupons
  await prisma.coupon.upsert({ where: { code: 'PAWZORA10' }, update: {}, create: { code: 'PAWZORA10', type: 'PERCENT', value: 10, minSubtotal: 500, usageLimit: 1000 } });
  await prisma.coupon.upsert({ where: { code: 'SAVE100' }, update: {}, create: { code: 'SAVE100', type: 'FIXED', value: 100, minSubtotal: 1500, expiresAt: new Date(Date.now() + 90 * 864e5) } });

  // ── adoption
  if ((await prisma.adoptionListing.count()) === 0) {
    const req = 'Valid ID, a home visit, and a signed adoption agreement. Adoption is subject to manual approval by Pawzora.';
    await prisma.adoptionListing.createMany({
      data: [
        { name: 'Max', species: 'Dog', breed: 'Golden Retriever', ageMonths: 24, gender: 'Male', location: 'Demo City', photoUrl: '/img/pet-dogs.png', description: 'Max is a friendly, energetic boy who loves fetch and cuddles. Great with kids.', requirements: req, isDemo: true },
        { name: 'Bella', species: 'Cat', breed: 'Domestic Shorthair', ageMonths: 12, gender: 'Female', location: 'Demo City', photoUrl: '/img/pet-cats.png', description: 'Bella is a calm and affectionate lap cat who enjoys sunny windowsills.', requirements: req, isDemo: true },
        { name: 'Coco', species: 'Rabbit', breed: 'Holland Lop', ageMonths: 6, gender: 'Female', location: 'Demo City', photoUrl: '/img/pet-small.png', description: 'Coco is curious and playful, and loves fresh hay and gentle pets.', requirements: req, isDemo: true },
        { name: 'Sky', species: 'Bird', breed: 'Budgerigar', ageMonths: 9, gender: 'Male', location: 'Demo City', photoUrl: '/img/pet-birds.png', description: 'Sky is a chatty little budgie who is learning to whistle tunes.', requirements: req, isDemo: true },
      ],
    });
  }

  // ── blog
  const blogCats = BLOG_CATEGORIES;
  const blogCatIds: Record<string, number> = {};
  for (const n of blogCats) {
    const c = await prisma.blogCategory.upsert({ where: { slug: slugify(n) }, update: {}, create: { name: n, slug: slugify(n) } });
    blogCatIds[n] = c.id;
  }
  const posts: [string, string, string, string, string, number][] = [
    ['10 Essential Dog Care Tips for a Happy, Healthy Pup', 'Dog Care', '/img/pet-dogs.png', 'From nutrition to exercise, here are ten habits that keep your dog thriving.', 'Feed a balanced diet, keep up with vet visits, exercise daily, and give your pup plenty of love and mental stimulation. (Demo article)', 5],
    ['Best Cat Toys to Keep Your Kitty Active', 'Product Guides', '/img/pet-cats.png', 'Bored cats get into trouble. These toys keep them moving and happy.', 'Wand toys, puzzle feeders and crinkle balls are favorites. Rotate toys weekly to keep things fresh. (Demo article)', 4],
    ['A Beginner\'s Guide to Caring for Small Pets', 'Small Pets', '/img/pet-small.png', 'Thinking about a rabbit or hamster? Here is what to know before you start.', 'Small pets need space, fresh hay or food, clean bedding and daily interaction. (Demo article)', 6],
  ];
  for (const [i, [title, cat, cover, excerpt, content, mins]] of posts.entries()) {
    await prisma.blogPost.upsert({
      where: { slug: slugify(title) }, update: {},
      create: { title, slug: slugify(title), excerpt, content, coverUrl: cover, categoryId: blogCatIds[cat], status: 'PUBLISHED', readMinutes: mins, isDemo: true, publishedAt: new Date(Date.now() - i * 6 * 864e5) },
    });
  }

  // ── settings (no invented contact details – admin fills these in)
  const settings = DEFAULT_SETTINGS;
  for (const [key, value] of Object.entries(settings)) {
    await prisma.storeSettings.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  // ── a few demo orders for the demo customer
  if (customer && (await prisma.order.count({ where: { isDemo: true } })) === 0) {
    const prods = await prisma.product.findMany({ take: 3, include: { images: true } });
    const stat = [['DELIVERED', 'PAID'], ['SHIPPED', 'PAID'], ['PENDING', 'UNPAID']] as const;
    for (const [i, [status, paymentStatus]] of stat.entries()) {
      const p = prods[i];
      const unit = Number(p.salePrice ?? p.price);
      const subtotal = unit * 2, shippingFee = 99;
      await prisma.order.create({
        data: {
          orderNumber: `PZ-DEMO-${1001 + i}`, userId: customer.id, email: customer.email, status, paymentStatus, paymentMethod: 'COD',
          subtotal, shippingFee, total: subtotal + shippingFee, isDemo: true,
          shipName: 'Emma Carter', shipPhone: '0000000000', shipAddress: '123 Demo Street', shipBarangay: 'Demo', shipCity: 'Demo City', shipProvince: 'Demo', shipPostal: '0000',
          createdAt: new Date(Date.now() - (3 - i) * 5 * 864e5),
          items: { create: [{ productId: p.id, name: p.name, imageUrl: p.images[0]?.url, unitPrice: unit, quantity: 2, lineTotal: subtotal }] },
          payments: { create: [{ provider: 'COD', amount: subtotal + shippingFee, status: paymentStatus === 'PAID' ? 'PAID' : 'PENDING', paidAt: paymentStatus === 'PAID' ? new Date() : null }] },
        },
      });
    }
  }

  console.log('Seed complete:', await prisma.product.count(), 'products,', await prisma.category.count(), 'categories');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
