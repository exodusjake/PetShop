// Run once on a new database (and again after upgrades; it is idempotent):  npm run db:bootstrap
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { bootstrap } from './baseData.js';

const prisma = new PrismaClient();
bootstrap(prisma)
  .then((r) => console.log('Bootstrap complete:', r))
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
