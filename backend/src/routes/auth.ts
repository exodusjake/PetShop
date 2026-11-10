import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { loginThrottle } from '../lib/loginThrottle.js';
import { resetPasswordEmail, sendMail } from '../lib/mailer.js';
import {
  DUMMY_HASH, clearSessionCookie, hashPassword, publicUser, randomToken, requireAuth, sha256, startSession, verifyPassword,
} from '../lib/auth.js';

export const auth = Router();
const h = (fn: (req: any, res: any) => Promise<any>) => (req: any, res: any, next: any) => fn(req, res).catch(next);

const isProd = process.env.NODE_ENV === 'production';
// Brute-force protection on the sensitive endpoints (per IP).
const strict = rateLimit({
  windowMs: 15 * 60_000, limit: Number(process.env.AUTH_RATE_LIMIT || 25), standardHeaders: true, legacyHeaders: false,
  message: { message: 'Too many attempts. Please wait a few minutes and try again.' },
});

export const passwordRule = z.string().min(8, 'Use at least 8 characters').max(72, 'Use 72 characters or fewer')
  .regex(/[A-Za-z]/, 'Include at least one letter').regex(/[0-9]/, 'Include at least one number');
const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(190);

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(120),
  email, password: passwordRule,
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the Terms and Conditions' }) }),
}); // NOTE: no "role" field exists – new users are always CUSTOMER

const fieldErrors = (e: z.ZodError) => ({ message: e.issues[0]?.message ?? 'Invalid input', issues: e.flatten().fieldErrors });

auth.post('/register', strict, h(async (req, res) => {
  const p = registerSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json(fieldErrors(p.error));
  if (await prisma.user.findUnique({ where: { email: p.data.email } })) {
    return res.status(409).json({ message: 'An account with this email already exists. Try logging in instead.', issues: { email: ['Email already registered'] } });
  }
  const role = await prisma.role.upsert({ where: { name: 'CUSTOMER' }, update: {}, create: { name: 'CUSTOMER' } });
  const user = await prisma.user.create({
    data: { email: p.data.email, fullName: p.data.fullName, passwordHash: await hashPassword(p.data.password), roleId: role.id },
    include: { role: true },
  });
  await startSession(req, res, user.id, false);
  res.status(201).json({ user: toUser(user) });
}));

auth.post('/login', strict, h(async (req, res) => {
  const p = z.object({ email, password: z.string().min(1).max(200), remember: z.boolean().optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json(fieldErrors(p.error));
  const wait = loginThrottle.retryAfter(req.ip, p.data.email);
  if (wait > 0) { res.set('Retry-After', String(wait)); return res.status(429).json({ message: `Too many failed attempts. Please try again in ${Math.ceil(wait / 60)} minute(s), or reset your password.` }); }
  const user = await prisma.user.findUnique({ where: { email: p.data.email }, include: { role: true } });
  const ok = await verifyPassword(p.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) { loginThrottle.fail(req.ip, p.data.email); return res.status(401).json({ message: 'Incorrect email or password.' }); }
  loginThrottle.clear(req.ip, p.data.email);
  if (user.status !== 'ACTIVE') return res.status(403).json({ message: 'This account has been suspended. Please contact support.' });
  await startSession(req, res, user.id, !!p.data.remember);
  res.json({ user: toUser(user) });
}));

auth.post('/logout', h(async (req, res) => {
  if (req.sessionId) await prisma.userSession.deleteMany({ where: { id: req.sessionId } });
  clearSessionCookie(res);
  res.json({ message: 'Logged out' });
}));

auth.get('/me', (req, res) => res.json({ user: req.user ? publicUser(req.user) : null }));

auth.patch('/me', requireAuth, h(async (req, res) => {
  const p = z.object({
    fullName: z.string().trim().min(2).max(120).optional(),
    phone: z.string().trim().max(30).regex(/^[0-9+()\-\s]*$/, 'Enter a valid phone number').nullable().optional(),
    notifyOrders: z.boolean().optional(), notifyPromos: z.boolean().optional(),
  }).safeParse(req.body);
  if (!p.success) return res.status(400).json(fieldErrors(p.error));
  const u = await prisma.user.update({ where: { id: req.user.id }, data: { ...p.data, phone: p.data.phone === '' ? null : p.data.phone }, include: { role: true } });
  res.json({ user: toUser(u) });
}));

auth.post('/change-password', requireAuth, strict, h(async (req, res) => {
  const p = z.object({ currentPassword: z.string().min(1), newPassword: passwordRule }).safeParse(req.body);
  if (!p.success) return res.status(400).json(fieldErrors(p.error));
  const u = await prisma.user.findUniqueOrThrow({ where: { id: req.user.id } });
  if (!(await verifyPassword(p.data.currentPassword, u.passwordHash))) return res.status(400).json({ message: 'Your current password is incorrect.', issues: { currentPassword: ['Incorrect password'] } });
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(p.data.newPassword) } });
  await prisma.userSession.deleteMany({ where: { userId: u.id, id: { not: req.sessionId } } }); // sign out other devices
  res.json({ message: 'Password updated.' });
}));

// Password reset. The link is emailed (see lib/mailer.ts). Outside production it is also printed to the API console and returned
// in the response so you can test without a mail server. In production the link is never returned.
auth.post('/forgot-password', strict, h(async (req, res) => {
  const p = z.object({ email }).safeParse(req.body);
  if (!p.success) return res.status(400).json(fieldErrors(p.error));
  const generic = { message: 'If an account exists for that email, a reset link has been sent.' };
  const user = await prisma.user.findUnique({ where: { email: p.data.email } });
  if (!user) return res.json(generic);
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  const token = randomToken();
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60_000) } });
  const link = `${process.env.PUBLIC_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
  // Not awaited: the reply must take the same time whether or not the account exists.
  void sendMail({ to: user.email, ...resetPasswordEmail(user.fullName, link) });
  if (!isProd) {
    console.log(`[dev] password reset link for ${user.email}: ${link}`);
    return res.json({ ...generic, devResetLink: link }); // development only, never returned in production
  }
  res.json(generic);
}));

auth.post('/reset-password', strict, h(async (req, res) => {
  const p = z.object({ token: z.string().min(20).max(100), password: passwordRule }).safeParse(req.body);
  if (!p.success) return res.status(400).json(fieldErrors(p.error));
  const t = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(p.data.token) } });
  if (!t || t.usedAt || t.expiresAt < new Date()) return res.status(400).json({ message: 'This reset link is invalid or has expired. Please request a new one.' });
  await prisma.$transaction([
    prisma.user.update({ where: { id: t.userId }, data: { passwordHash: await hashPassword(p.data.password) } }),
    prisma.passwordResetToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
    prisma.userSession.deleteMany({ where: { userId: t.userId } }),
  ]);
  res.json({ message: 'Password updated. You can now log in.' });
}));

function toUser(u: { id: number; email: string; fullName: string; phone: string | null; avatarUrl: string | null; notifyOrders: boolean; notifyPromos: boolean; role: { name: string } }) {
  return { id: u.id, email: u.email, fullName: u.fullName, phone: u.phone, avatarUrl: u.avatarUrl, role: u.role.name, notifyOrders: u.notifyOrders, notifyPromos: u.notifyPromos };
}
