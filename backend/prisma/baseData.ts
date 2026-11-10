// Reference data every installation needs (demo or production). No products, customers or orders live here.
import type { PrismaClient } from '@prisma/client';
import { slugify } from '../src/lib/constants.js';

export const PET_TYPES = [
  ['Dogs', '/img/pet-dogs.png'], ['Cats', '/img/pet-cats.png'], ['Small Pets', '/img/pet-small.png'],
  ['Birds', '/img/pet-birds.png'], ['Fish', '/img/pet-fish.png'], ['Reptiles', '/img/pet-reptiles.png'],
] as const;

export const PRODUCT_CATS = [
  ['Food & Treats', '/img/cat-food.png'], ['Beds & Houses', '/img/cat-beds.png'], ['Collars & Leashes', '/img/cat-collars.png'],
  ['Toys', '/img/cat-toys.png'], ['Grooming & Care', '/img/cat-grooming.png'], ['Travel & Carriers', '/img/cat-travel.png'],
] as const;

export const BLOG_CATEGORIES = ['Dog Care', 'Cat Care', 'Small Pets', 'Bird Care', 'Fish Care', 'Reptile Care', 'Adoption Stories', 'Product Guides'] as const;

// Contact details are deliberately empty: the owner fills them in from Admin → Settings. Nothing is invented.
export const DEFAULT_SETTINGS: Record<string, string> = {
  store_name: 'Pawzora', tagline: 'Everything for Your Furry Friends', currency: 'PHP',
  contact_email: '', contact_phone: '', contact_address: '', business_hours: '',
  shipping_standard_fee: '99', shipping_express_fee: '199', free_shipping_over: '2000',
};

/** Safe to run any number of times: creates what is missing and never overwrites what the owner has edited. */
export async function bootstrap(prisma: PrismaClient) {
  for (const name of ['CUSTOMER', 'ADMIN']) await prisma.role.upsert({ where: { name }, update: {}, create: { name } });

  for (const [i, [name, img]] of PET_TYPES.entries()) {
    await prisma.category.upsert({ where: { slug: slugify(name) }, update: {}, create: { name, slug: slugify(name), kind: 'PET', imageUrl: img, sortOrder: i } });
  }
  for (const [i, [name, img]] of PRODUCT_CATS.entries()) {
    await prisma.category.upsert({ where: { slug: slugify(name) }, update: {}, create: { name, slug: slugify(name), kind: 'PRODUCT', imageUrl: img, sortOrder: i } });
  }
  for (const name of BLOG_CATEGORIES) await prisma.blogCategory.upsert({ where: { slug: slugify(name) }, update: {}, create: { name, slug: slugify(name) } });
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) await prisma.storeSettings.upsert({ where: { key }, update: {}, create: { key, value } });

  return { roles: await prisma.role.count(), categories: await prisma.category.count(), blogCategories: await prisma.blogCategory.count(), settings: await prisma.storeSettings.count() };
}
