import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../lib/auth.js';

export const uploads = Router();

/** Detects the real image type from the file's first bytes. The client's Content-Type and filename are never trusted. */
export function sniffImage(b: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (b.length < 16) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null; // SVG and everything else is refused (SVG can carry scripts)
}

const limiter = rateLimit({ windowMs: 60 * 60_000, limit: Number(process.env.UPLOAD_RATE_LIMIT || 60), standardHeaders: true, legacyHeaders: false, message: { message: 'Too many uploads. Please try again later.' } });

uploads.post('/', requireAuth, limiter, express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }), async (req, res, next) => {
  try {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ message: 'Please choose a JPEG, PNG or WebP image (max 5 MB).' });
    const ext = sniffImage(req.body);
    if (!ext) return res.status(400).json({ message: 'That file is not a valid JPEG, PNG or WebP image.' });
    const dir = path.resolve('uploads');
    await fs.mkdir(dir, { recursive: true });
    const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`; // random name: no path tricks, no overwrites
    await fs.writeFile(path.join(dir, name), req.body, { flag: 'wx' });
    res.status(201).json({ url: `/uploads/${name}` });
  } catch (e) { next(e); }
});
