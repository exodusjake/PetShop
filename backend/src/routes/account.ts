import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

export const account = Router();
account.use(requireAuth); // everything here is scoped to the logged-in user
const h = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: (e?: unknown) => void) => fn(req, res).catch(next);
const uid = (req: Request) => req.user!.id;
const idParam = (req: Request) => { const n = Number(req.params.id); return Number.isInteger(n) ? n : -1; };
const bad = (res: Response, e: z.ZodError) => res.status(400).json({ message: e.issues[0]?.message ?? 'Invalid input', issues: e.flatten().fieldErrors });

/** Only images we stored ourselves (or bundled site images) may be referenced. No external URLs. */
const localImage = z.string().max(300).regex(/^\/(uploads|img)\/[A-Za-z0-9._-]+$/, 'Invalid image').nullable().optional();

// ───────────── dashboard summary ─────────────
account.get('/summary', h(async (req, res) => {
  const userId = uid(req);
  const [totalOrders, openOrders, wishlistItems, pets, recent] = await Promise.all([
    prisma.order.count({ where: { userId } }),
    prisma.order.count({ where: { userId, status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'] } } }),
    prisma.wishlist.count({ where: { userId, product: { isActive: true, archivedAt: null } } }),
    prisma.pet.count({ where: { userId } }),
    prisma.order.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 5, include: { items: { select: { quantity: true } } } }),
  ]);
  res.json({
    totalOrders, pendingOrders: openOrders, wishlistItems, pets,
    recentOrders: recent.map((o) => ({ orderNumber: o.orderNumber, status: o.status, paymentStatus: o.paymentStatus, total: Number(o.total), createdAt: o.createdAt, itemCount: o.items.reduce((s, i) => s + i.quantity, 0), isDemo: o.isDemo })),
  });
}));

// ───────────── pets ─────────────
const petSchema = z.object({
  name: z.string().trim().min(1, 'Enter your pet\'s name').max(80),
  species: z.string().trim().min(1, 'Choose a species').max(40),
  breed: z.string().trim().max(80).nullish().transform((v) => v || null),
  birthDate: z.string().trim().nullish().refine((v) => !v || (!Number.isNaN(Date.parse(v)) && new Date(v) <= new Date()), 'Birth date must be a past date').transform((v) => (v ? new Date(v) : null)),
  gender: z.enum(['Male', 'Female', 'Unknown']).nullish().transform((v) => v ?? null),
  photoUrl: localImage.transform((v) => v ?? null),
  notes: z.string().trim().max(500).nullish().transform((v) => v || null),
});
const petDTO = (p: { id: number; name: string; species: string; breed: string | null; birthDate: Date | null; gender: string | null; photoUrl: string | null; notes: string | null }) => ({
  id: p.id, name: p.name, species: p.species, breed: p.breed, birthDate: p.birthDate, gender: p.gender, photoUrl: p.photoUrl, notes: p.notes,
});

account.get('/pets', h(async (req, res) => res.json((await prisma.pet.findMany({ where: { userId: uid(req) }, orderBy: { createdAt: 'desc' } })).map(petDTO))));
account.post('/pets', h(async (req, res) => {
  const p = petSchema.safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  if ((await prisma.pet.count({ where: { userId: uid(req) } })) >= 30) return res.status(409).json({ message: 'You can register up to 30 pets.' });
  res.status(201).json(petDTO(await prisma.pet.create({ data: { ...p.data, userId: uid(req) } })));
}));
account.patch('/pets/:id', h(async (req, res) => {
  const p = petSchema.safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const own = await prisma.pet.findFirst({ where: { id: idParam(req), userId: uid(req) } });
  if (!own) return res.status(404).json({ message: 'Pet not found.' });
  res.json(petDTO(await prisma.pet.update({ where: { id: own.id }, data: p.data })));
}));
account.delete('/pets/:id', h(async (req, res) => {
  const r = await prisma.pet.deleteMany({ where: { id: idParam(req), userId: uid(req) } });
  if (r.count === 0) return res.status(404).json({ message: 'Pet not found.' });
  res.json({ ok: true });
}));

// ───────────── addresses ─────────────
const addressSchema = z.object({
  label: z.string().trim().min(1).max(40).default('Home'),
  fullName: z.string().trim().min(2, 'Enter the recipient\'s full name').max(120),
  phone: z.string().trim().regex(/^[0-9+()\-\s]{7,20}$/, 'Enter a valid phone number'),
  line1: z.string().trim().min(5, 'Enter your complete address').max(300),
  barangay: z.string().trim().min(1, 'Enter your barangay').max(100),
  city: z.string().trim().min(1, 'Enter your city or municipality').max(100),
  province: z.string().trim().min(1, 'Enter your province').max(100),
  postalCode: z.string().trim().regex(/^[0-9]{4}$/, 'Enter a 4-digit postal code'),
  isDefault: z.boolean().optional(),
});
const addrDTO = (a: { id: number; label: string; fullName: string; phone: string; line1: string; barangay: string; city: string; province: string; postalCode: string; isDefault: boolean }) => ({
  id: a.id, label: a.label, fullName: a.fullName, phone: a.phone, line1: a.line1, barangay: a.barangay, city: a.city, province: a.province, postalCode: a.postalCode, isDefault: a.isDefault,
});

account.get('/addresses', h(async (req, res) => res.json((await prisma.shippingAddress.findMany({ where: { userId: uid(req) }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] })).map(addrDTO))));

account.post('/addresses', h(async (req, res) => {
  const p = addressSchema.safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const userId = uid(req);
  const count = await prisma.shippingAddress.count({ where: { userId } });
  if (count >= 10) return res.status(409).json({ message: 'You can save up to 10 addresses.' });
  const makeDefault = count === 0 || !!p.data.isDefault; // the first address is always the default
  const created = await prisma.$transaction(async (tx) => {
    if (makeDefault) await tx.shippingAddress.updateMany({ where: { userId }, data: { isDefault: false } });
    return tx.shippingAddress.create({ data: { ...p.data, userId, isDefault: makeDefault } });
  });
  res.status(201).json(addrDTO(created));
}));

account.patch('/addresses/:id', h(async (req, res) => {
  const p = addressSchema.safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const userId = uid(req);
  const own = await prisma.shippingAddress.findFirst({ where: { id: idParam(req), userId } });
  if (!own) return res.status(404).json({ message: 'Address not found.' });
  const makeDefault = !!p.data.isDefault || own.isDefault;
  const updated = await prisma.$transaction(async (tx) => {
    if (makeDefault) await tx.shippingAddress.updateMany({ where: { userId, id: { not: own.id } }, data: { isDefault: false } });
    return tx.shippingAddress.update({ where: { id: own.id }, data: { ...p.data, isDefault: makeDefault } });
  });
  res.json(addrDTO(updated));
}));

account.post('/addresses/:id/default', h(async (req, res) => {
  const userId = uid(req);
  const own = await prisma.shippingAddress.findFirst({ where: { id: idParam(req), userId } });
  if (!own) return res.status(404).json({ message: 'Address not found.' });
  await prisma.$transaction([
    prisma.shippingAddress.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.shippingAddress.update({ where: { id: own.id }, data: { isDefault: true } }),
  ]);
  res.json({ ok: true });
}));

account.delete('/addresses/:id', h(async (req, res) => {
  const userId = uid(req);
  const own = await prisma.shippingAddress.findFirst({ where: { id: idParam(req), userId } });
  if (!own) return res.status(404).json({ message: 'Address not found.' });
  await prisma.shippingAddress.delete({ where: { id: own.id } });
  if (own.isDefault) { // promote the newest remaining address
    const next = await prisma.shippingAddress.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
    if (next) await prisma.shippingAddress.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  res.json({ ok: true });
}));

// ───────────── adoption applications (read-only for the applicant) ─────────────
account.get('/adoption-applications', h(async (req, res) => {
  const rows = await prisma.adoptionApplication.findMany({
    where: { userId: uid(req) }, orderBy: { createdAt: 'desc' },
    include: { listing: { select: { id: true, name: true, species: true, breed: true, photoUrl: true, status: true } } },
  });
  res.json(rows.map((r) => ({ id: r.id, status: r.status, adminNote: r.adminNote, createdAt: r.createdAt, updatedAt: r.updatedAt, pet: r.listing })));
}));
