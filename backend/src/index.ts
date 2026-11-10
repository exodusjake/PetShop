import 'dotenv/config';
import { createApp } from './app.js';
import { prisma } from './lib/db.js';
import { checkEnv } from './lib/env.js';

const report = checkEnv(process.env);
for (const w of report.warnings) console.warn(`[config warning] ${w}`);
if (report.errors.length) {
  for (const e of report.errors) console.error(`[config error] ${e}`);
  console.error('Refusing to start with an unsafe or incomplete configuration.');
  process.exit(1);
}

const port = Number(process.env.PORT || 4000);
const server = createApp().listen(port, '0.0.0.0', () => console.log(`Pawzora API listening on http://localhost:${port} (${process.env.NODE_ENV || 'development'})`));

// finish in-flight requests, then close the database connection (pm2 restarts and deploys send SIGTERM)
function shutdown(signal: string) {
  console.log(`${signal} received, shutting down…`);
  server.close(async () => { await prisma.$disconnect(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
