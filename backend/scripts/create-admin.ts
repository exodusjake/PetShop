// Usage (on the API server, from the backend folder):
//   ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name" ADMIN_PASSWORD='a-long-Passw0rd-here' npm run admin:create
// The password is read from the environment only for this one command, so it never lands in a file.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { AdminSetupError, createAdmin } from '../src/lib/createAdmin.js';

const { ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD } = process.env;
if (!ADMIN_EMAIL || !ADMIN_NAME || !ADMIN_PASSWORD) {
  console.error('Set ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD for this command. See the comment at the top of scripts/create-admin.ts.');
  process.exit(1);
}

const prisma = new PrismaClient();
createAdmin(prisma, { email: ADMIN_EMAIL, fullName: ADMIN_NAME, password: ADMIN_PASSWORD })
  .then((a) => console.log(`Admin created: ${a.email}. You can now log in at /login.`))
  .catch((e) => { console.error(e instanceof AdminSetupError ? `Could not create the admin: ${e.message}` : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
