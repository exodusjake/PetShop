import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { prisma } from './lib/db.js';
import { csrfGuard, loadUser } from './lib/auth.js';
import { catalog } from './routes/catalog.js';
import { auth } from './routes/auth.js';
import { wishlist } from './routes/wishlist.js';
import { admin } from './routes/admin.js';
import { cart } from './routes/cart.js';
import { orders } from './routes/orders.js';
import { account } from './routes/account.js';
import { uploads } from './routes/uploads.js';
import { adoption } from './routes/adoption.js';

export function createApp() {
  const app = express();
  const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim());
  app.set('trust proxy', 1); // exactly one proxy (nginx) sits in front of the API
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: origins, credentials: true }));

  // Request logging for production: method, path (no query string, so no tokens), status and time. No bodies, no cookies.
  if (process.env.NODE_ENV === 'production' || process.env.LOG_REQUESTS === 'true') {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => { if (req.path !== '/api/health') console.log(JSON.stringify({ t: new Date().toISOString(), m: req.method, p: req.path, s: res.statusCode, ms: Date.now() - start })); });
      next();
    });
  }

  // 100 KB is plenty for every form (the longest, a blog article, is capped at 20,000 characters). Image uploads use their own 5 MB raw parser.
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api', rateLimit({ windowMs: 60_000, limit: Number(process.env.RATE_LIMIT || 300), standardHeaders: true, legacyHeaders: false }));
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }); // never let a browser or proxy cache API data
  app.use('/uploads', express.static(path.resolve('uploads')));

  app.get('/api/health', async (_req, res, next) => {
    try { await prisma.$queryRaw`SELECT 1 AS ok`; res.json({ status: 'ok', db: 'connected' }); } catch (e) { next(e); }
  });

  // (A payment-provider webhook, once a provider is connected, must be mounted BEFORE this guard and verified by signature.)
  app.use('/api', csrfGuard(origins), loadUser);

  // discount-code guessing: stricter than the general limit
  app.use('/api/cart/coupon', rateLimit({ windowMs: 10 * 60_000, limit: Number(process.env.COUPON_RATE_LIMIT || 25), skip: (req) => req.method !== 'POST', standardHeaders: true, legacyHeaders: false, message: { message: 'Too many attempts. Please wait a few minutes.' } }));

  app.use('/api/catalog', catalog);
  app.use('/api/auth', auth);
  app.use('/api/wishlist', wishlist);
  app.use('/api/cart', cart);
  app.use('/api', orders); // /api/checkout and /api/orders/*
  app.use('/api/account', account);
  app.use('/api/uploads', uploads);
  app.use('/api/adoption', adoption);
  app.use('/api/admin', admin);

  app.use('/api', (_req, res) => res.status(404).json({ message: 'Not found' }));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const type = (err as { type?: string } | null)?.type;
    if (type === 'entity.too.large') return res.status(413).json({ message: 'That request is too large.' });
    if (type === 'entity.parse.failed') return res.status(400).json({ message: 'The request could not be read.' });
    console.error(err);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  });
  return app;
}
