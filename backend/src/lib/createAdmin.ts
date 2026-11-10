import type { PrismaClient } from '@prisma/client';
import { hashPassword } from './auth.js';

export class AdminSetupError extends Error {}

/**
 * Creates an administrator account on purpose, from the server's command line.
 * There is no way to become an admin through the website: registration only ever creates customers.
 */
export async function createAdmin(prisma: PrismaClient, input: { email: string; fullName: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new AdminSetupError('Enter a valid email address.');
  if (fullName.length < 2) throw new AdminSetupError('Enter the admin\'s full name.');
  const pw = input.password;
  if (pw.length < 12) throw new AdminSetupError('Use at least 12 characters for an admin password.');
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw)) throw new AdminSetupError('Use upper-case, lower-case letters and a number in the admin password.');
  if (/pawzora|password|changeme|12345678/i.test(pw)) throw new AdminSetupError('That password is too easy to guess.');
  if (await prisma.user.findUnique({ where: { email } })) throw new AdminSetupError('An account with that email already exists.');

  const role = await prisma.role.upsert({ where: { name: 'ADMIN' }, update: {}, create: { name: 'ADMIN' } });
  const user = await prisma.user.create({ data: { email, fullName, passwordHash: await hashPassword(pw), roleId: role.id } });
  return { id: user.id, email: user.email };
}
