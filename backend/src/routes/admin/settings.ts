import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/db.js';
import { audit } from '../../lib/audit.js';
import { bad, h } from './util.js';

export const adminSettings = Router();

const text = (max: number) => z.string().trim().max(max);
const url = z.string().trim().max(300).refine((v) => v === '' || /^https:\/\/[^\s]+$/.test(v), 'Must start with https://');
const fee = z.string().trim().regex(/^\d{1,7}(\.\d{1,2})?$/, 'Enter an amount like 99 or 99.50');

const SCHEMA = {
  store_name: text(80), tagline: text(160),
  contact_email: z.string().trim().max(190).refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email'),
  contact_phone: text(40), contact_address: text(300), business_hours: text(200),
  social_facebook: url, social_instagram: url, social_tiktok: url, social_youtube: url,
  shipping_standard_fee: fee, shipping_express_fee: fee, free_shipping_over: fee,
} as const;
const KEYS = Object.keys(SCHEMA) as (keyof typeof SCHEMA)[];

adminSettings.get('/settings', h(async (_req, res) => {
  const rows = await prisma.storeSettings.findMany({ where: { key: { in: KEYS } } });
  const out: Record<string, string> = Object.fromEntries(KEYS.map((k) => [k, '']));
  for (const r of rows) out[r.key] = r.value;
  res.json(out);
}));

adminSettings.put('/settings', h(async (req, res) => {
  const p = z.object(SCHEMA).partial().strict().safeParse(req.body); // unknown keys are rejected
  if (!p.success) return bad(res, p.error);
  for (const [key, value] of Object.entries(p.data)) {
    await prisma.storeSettings.upsert({ where: { key }, update: { value: value as string }, create: { key, value: value as string } });
  }
  await audit(req, 'settings.update', 'StoreSettings', null, { keys: Object.keys(p.data) });
  res.json({ ok: true });
}));
