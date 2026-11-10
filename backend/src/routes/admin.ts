import { Router } from 'express';
import { requireRole } from '../lib/auth.js';
import { stats } from './admin/stats.js';
import { adminCatalog } from './admin/catalog.js';
import { adminOrders } from './admin/orders.js';
import { adminPeople } from './admin/people.js';
import { adminReports } from './admin/reports.js';
import { adminSettings } from './admin/settings.js';
import { adminAdoption } from './admin/adoption.js';
import { adminBlog } from './admin/blog.js';
import { adminEngagement } from './admin/engagement.js';

// Every /api/admin/* route requires the ADMIN role, enforced on the server (never by the frontend alone).
export const admin = Router();
admin.use(requireRole('ADMIN'));

admin.get('/ping', (req, res) => res.json({ ok: true, admin: req.user!.email }));
for (const r of [stats, adminCatalog, adminOrders, adminPeople, adminReports, adminSettings, adminAdoption, adminBlog, adminEngagement]) admin.use(r);
