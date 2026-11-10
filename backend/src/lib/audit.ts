import type { Request } from 'express';
import { prisma } from './db.js';

/** Records an admin action. Never throws: auditing must not break the action itself. */
export function audit(req: Request, action: string, entity: string, entityId?: string | number | null, details?: unknown) {
  return prisma.adminAuditLog.create({
    data: {
      adminId: req.user?.id ?? null, action, entity,
      entityId: entityId != null ? String(entityId).slice(0, 38) : null,
      details: details !== undefined ? JSON.stringify(details).slice(0, 990) : null,
    },
  }).catch((e) => console.error('audit log failed', e));
}
