import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/db.js';
import { audit } from '../../lib/audit.js';
import { ADOPTION_STATUSES, APPLICATION_STATUSES } from '../../lib/constants.js';
import { bad, h, idParam, pageInfo, paging } from './util.js';

export const adminAdoption = Router();

const localImage = z.string().max(300).regex(/^\/(uploads|img)\/[A-Za-z0-9._-]+$/, 'Invalid image path');

const listingBody = z.object({
  name: z.string().trim().min(1, "Enter the pet's name").max(80),
  species: z.string().trim().min(1, 'Choose a species').max(40),
  breed: z.string().trim().min(1, 'Enter the breed (or "Mixed")').max(80),
  ageMonths: z.number({ invalid_type_error: 'Enter the age in months' }).int().min(0).max(600),
  gender: z.enum(['Male', 'Female']),
  description: z.string().trim().min(10, 'Write a short description (10+ characters)').max(4000),
  status: z.enum(ADOPTION_STATUSES).default('AVAILABLE'),
  location: z.string().trim().min(2, 'Enter the pet\'s location').max(120),
  requirements: z.string().trim().min(10, 'List the adoption requirements').max(600),
  photoUrl: localImage.nullish().transform((v) => v ?? null),
});

adminAdoption.get('/adoption/listings', h(async (req, res) => {
  const { page, size, skip } = paging(req);
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const status = ADOPTION_STATUSES.find((s) => s === req.query.status);
  const where = { ...(status ? { status } : {}), ...(q ? { OR: [{ name: { contains: q } }, { breed: { contains: q } }] } : {}) };
  const [total, rows] = await Promise.all([
    prisma.adoptionListing.count({ where }),
    prisma.adoptionListing.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: size, include: { _count: { select: { applications: true } } } }),
  ]);
  res.json({ items: rows.map((r) => ({ ...r, applications: r._count.applications, _count: undefined })), ...pageInfo(total, page, size) });
}));

adminAdoption.post('/adoption/listings', h(async (req, res) => {
  const p = listingBody.safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const created = await prisma.adoptionListing.create({ data: p.data });
  await audit(req, 'adoption.listing.create', 'AdoptionListing', created.id, { name: created.name });
  res.status(201).json(created);
}));

adminAdoption.patch('/adoption/listings/:id', h(async (req, res) => {
  const p = listingBody.safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const id = idParam(req);
  const r = await prisma.adoptionListing.updateMany({ where: { id }, data: p.data });
  if (r.count === 0) return res.status(404).json({ message: 'Listing not found.' });
  await audit(req, 'adoption.listing.update', 'AdoptionListing', id, { status: p.data.status });
  res.json({ ok: true });
}));

// Listings with applications can't be deleted (that would erase applicants' history). Mark them Adopted instead.
adminAdoption.delete('/adoption/listings/:id', h(async (req, res) => {
  const id = idParam(req);
  if ((await prisma.adoptionApplication.count({ where: { listingId: id } })) > 0) return res.status(409).json({ message: 'This pet has applications. Set its status to "Adopted" instead of deleting it.' });
  const r = await prisma.adoptionListing.deleteMany({ where: { id } });
  if (r.count === 0) return res.status(404).json({ message: 'Listing not found.' });
  await audit(req, 'adoption.listing.delete', 'AdoptionListing', id);
  res.json({ ok: true });
}));

// ───────────── applications ─────────────
const FLOW: Record<string, string[]> = {
  PENDING: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'],
  UNDER_REVIEW: ['PENDING', 'APPROVED', 'REJECTED'],
  APPROVED: [], // a decision is final
  REJECTED: [],
};

const appDTO = (a: Awaited<ReturnType<typeof prisma.adoptionApplication.findFirstOrThrow<{ include: { listing: true; user: true } }>>>) => ({
  id: a.id, status: a.status, adminNote: a.adminNote, createdAt: a.createdAt, updatedAt: a.updatedAt,
  applicantName: a.applicantName, email: a.email, phone: a.phone, address: a.address, livingSituation: a.livingSituation, experience: a.experience, reason: a.reason,
  pet: { id: a.listing.id, name: a.listing.name, species: a.listing.species, breed: a.listing.breed, photoUrl: a.listing.photoUrl, status: a.listing.status },
  account: { id: a.user.id, name: a.user.fullName },
  allowedNext: FLOW[a.status] ?? [],
});

adminAdoption.get('/adoption/applications', h(async (req, res) => {
  const { page, size, skip } = paging(req);
  const status = APPLICATION_STATUSES.find((s) => s === req.query.status);
  const where = { ...(status ? { status } : {}), ...(Number(req.query.listingId) ? { listingId: Number(req.query.listingId) } : {}) };
  const [total, rows] = await Promise.all([
    prisma.adoptionApplication.count({ where }),
    prisma.adoptionApplication.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: size, include: { listing: true, user: true } }),
  ]);
  res.json({ items: rows.map(appDTO), ...pageInfo(total, page, size) });
}));

// Approval is a manual admin decision, with an optional note shown to the applicant.
adminAdoption.patch('/adoption/applications/:id', h(async (req, res) => {
  const p = z.object({ status: z.enum(APPLICATION_STATUSES), adminNote: z.string().trim().max(500).nullish().transform((v) => v || null) }).safeParse(req.body);
  if (!p.success) return bad(res, p.error);
  const id = idParam(req);
  const a = await prisma.adoptionApplication.findUnique({ where: { id }, include: { listing: true } });
  if (!a) return res.status(404).json({ message: 'Application not found.' });
  if (!(FLOW[a.status] ?? []).includes(p.data.status)) return res.status(409).json({ message: `A ${a.status.replace('_', ' ').toLowerCase()} application cannot be changed to ${p.data.status.replace('_', ' ').toLowerCase()}.` });
  if (p.data.status === 'APPROVED' && a.listing.status === 'ADOPTED') return res.status(409).json({ message: `${a.listing.name} is already marked as adopted.` });
  const changed = await prisma.adoptionApplication.updateMany({ where: { id, status: a.status }, data: { status: p.data.status, adminNote: p.data.adminNote } });
  if (changed.count === 0) return res.status(409).json({ message: 'This application was just updated. Refresh and try again.' });
  await audit(req, 'adoption.application.review', 'AdoptionApplication', id, { from: a.status, to: p.data.status, pet: a.listing.name });
  res.json(appDTO(await prisma.adoptionApplication.findUniqueOrThrow({ where: { id }, include: { listing: true, user: true } })));
}));
