import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from './db.js';

export const COOKIE = 'pz_session';
const isProd = process.env.NODE_ENV === 'production';
/** Cookies are marked Secure (HTTPS only) in production. COOKIE_SECURE=false is for plain-HTTP testing only. */
export const cookieSecure = () => (process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProd);

export interface AuthUser {
  id: number; email: string; fullName: string; phone: string | null; avatarUrl: string | null;
  role: 'CUSTOMER' | 'ADMIN'; notifyOrders: boolean; notifyPromos: boolean;
}
declare module 'express-serve-static-core' {
  interface Request { user?: AuthUser; sessionId?: number }
}

export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = () => crypto.randomBytes(32).toString('base64url');

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
// Compared against when the email is unknown, so login timing doesn't reveal which emails exist.
export const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

export async function startSession(req: Request, res: Response, userId: number, remember: boolean) {
  // session rotation: a session id presented before login is never reused afterwards
  const old = req.cookies?.[COOKIE];
  if (typeof old === 'string' && old.length > 20) await prisma.userSession.deleteMany({ where: { tokenHash: sha256(old) } });
  const token = randomToken();
  const days = remember ? 30 : 1;
  await prisma.userSession.create({
    data: {
      userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + days * 864e5),
      userAgent: req.get('user-agent')?.slice(0, 290) ?? null, ip: req.ip?.slice(0, 58) ?? null,
    },
  });
  // Persistent cookie only with "remember me"; otherwise a browser-session cookie (server still expires it after 1 day).
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: cookieSecure(), path: '/', ...(remember ? { maxAge: days * 864e5 } : {}) });
  // opportunistic cleanup
  void prisma.userSession.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});
}

export const clearSessionCookie = (res: Response) => res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: cookieSecure(), path: '/' });

/** Resolves the logged-in user (if any) from the session cookie. Never trusts anything the client sends about roles. */
export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[COOKIE];
    if (typeof token === 'string' && token.length > 20) {
      const s = await prisma.userSession.findUnique({ where: { tokenHash: sha256(token) }, include: { user: { include: { role: true } } } });
      if (s && s.expiresAt > new Date() && s.user.status === 'ACTIVE') {
        const u = s.user;
        req.sessionId = s.id;
        req.user = { id: u.id, email: u.email, fullName: u.fullName, phone: u.phone, avatarUrl: u.avatarUrl, role: u.role.name as AuthUser['role'], notifyOrders: u.notifyOrders, notifyPromos: u.notifyPromos };
      }
    }
    next();
  } catch (e) { next(e); }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ message: 'Please log in to continue.' });
  next();
}
export const requireRole = (role: AuthUser['role']) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ message: 'Please log in to continue.' });
  if (req.user.role !== role) return res.status(403).json({ message: 'You do not have permission to do that.' });
  next();
};

/**
 * CSRF defence for cookie auth: state-changing requests must carry a custom header (browsers can't add it cross-site
 * without a CORS preflight, which our CORS allow-list rejects) and, when an Origin is sent, it must be our own site.
 */
export function csrfGuard(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (origin) {
      let host = '';
      try { host = new URL(origin).host; } catch { /* malformed */ }
      if (host !== req.get('host') && !allowedOrigins.includes(origin)) return res.status(403).json({ message: 'Blocked cross-site request.' });
    }
    if (req.get('x-requested-with') !== 'pawzora') return res.status(403).json({ message: 'Blocked request (missing CSRF header).' });
    next();
  };
}

export const publicUser = (u: AuthUser) => u;
