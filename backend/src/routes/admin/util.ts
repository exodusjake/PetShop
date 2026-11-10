import type { Request, Response } from 'express';
import { z } from 'zod';

export const h = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: (e?: unknown) => void) => fn(req, res).catch(next);

export const bad = (res: Response, e: z.ZodError) => res.status(400).json({ message: e.issues[0]?.message ?? 'Invalid input', issues: e.flatten().fieldErrors });

export const idParam = (req: Request, name = 'id') => { const n = Number(req.params[name]); return Number.isInteger(n) && n > 0 ? n : -1; };

export function paging(req: Request, defaultSize = 15) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const size = Math.min(100, Math.max(1, Number(req.query.pageSize) || defaultSize));
  return { page, size, skip: (page - 1) * size };
}
export const pageInfo = (total: number, page: number, size: number) => ({ total, page, pageSize: size, totalPages: Math.max(1, Math.ceil(total / size)) });

/** Parses ?from=YYYY-MM-DD&to=YYYY-MM-DD into an inclusive date range (defaults to the last 30 days). */
export function dateRange(req: Request, defaultDays = 30) {
  const parse = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : null);
  const to = parse(req.query.to) ?? new Date();
  const toEnd = new Date(to); toEnd.setHours(23, 59, 59, 999);
  const from = parse(req.query.from) ?? new Date(toEnd.getTime() - defaultDays * 864e5);
  from.setHours(0, 0, 0, 0);
  return { from, to: toEnd };
}

/** CSV with protection against spreadsheet formula injection (cells starting with = + - @ are prefixed). */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s) && typeof v !== 'number') s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
