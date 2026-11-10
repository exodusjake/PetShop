import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

// Public reading of listings lives in routes/catalog.ts. Applying always needs an account.
export const adoption = Router();
adoption.use(requireAuth);
const h = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: (e?: unknown) => void) => fn(req, res).catch(next);

const ACTIVE = ['PENDING', 'UNDER_REVIEW', 'APPROVED'];

const applySchema = z.object({
  applicantName: z.string().trim().min(2, 'Enter your full name').max(120),
  phone: z.string().trim().regex(/^[0-9+()\-\s]{7,20}$/, 'Enter a valid phone number'),
  address: z.string().trim().min(8, 'Enter your complete address').max(300),
  livingSituation: z.string().trim().min(5, 'Tell us about your home (house, apartment, yard…)').max(300),
  experience: z.string().trim().min(10, 'Tell us a little about your pet care experience').max(600),
  reason: z.string().trim().min(10, 'Tell us why you would like to adopt').max(800),
});

adoption.post('/:id/apply', h(async (req, res) => {
  const p = applySchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: p.error.issues[0].message, issues: p.error.flatten().fieldErrors });
  const id = Number(req.params.id);
  const listing = Number.isInteger(id) ? await prisma.adoptionListing.findUnique({ where: { id } }) : null;
  if (!listing) return res.status(404).json({ message: 'Pet not found.' });
  if (listing.status === 'ADOPTED') return res.status(409).json({ message: `${listing.name} has already found a home.` });

  const userId = req.user!.id;
  const mine = await prisma.adoptionApplication.findMany({ where: { userId, status: { in: ACTIVE } } });
  if (mine.some((a) => a.listingId === id)) return res.status(409).json({ message: `You already have an application for ${listing.name}.` });
  if (mine.length >= 5) return res.status(409).json({ message: 'You have 5 open applications. Please wait for a decision before applying for more.' });

  // Approval is always a manual admin decision: this only ever creates a PENDING application.
  const created = await prisma.adoptionApplication.create({ data: { ...p.data, listingId: id, userId, email: req.user!.email, status: 'PENDING' } });
  res.status(201).json({ id: created.id, status: created.status, message: `Thank you! Your application for ${listing.name} was received. We'll review it and get in touch.` });
}));
