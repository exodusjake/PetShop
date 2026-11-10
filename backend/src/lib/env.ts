// Startup checks. In production the server refuses to start with an unsafe configuration.
// `checkEnv` is a pure function so it can be unit-tested.
export interface EnvReport { errors: string[]; warnings: string[] }

export function checkEnv(env: Record<string, string | undefined>): EnvReport {
  const errors: string[] = [], warnings: string[] = [];
  const prod = env.NODE_ENV === 'production';
  const origins = (env.CORS_ORIGIN ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  if (!env.DATABASE_URL) errors.push('DATABASE_URL is not set.');
  if (!prod) return { errors, warnings };

  if (origins.length === 0) errors.push('CORS_ORIGIN must be set to your website address (e.g. https://shop.example.com).');
  if (origins.includes('*')) errors.push('CORS_ORIGIN must not be "*" because the site uses cookies.');
  if (origins.some((o) => /localhost|127\.0\.0\.1/.test(o))) warnings.push('CORS_ORIGIN still points at localhost.');
  if (origins.some((o) => o.startsWith('http://'))) warnings.push('CORS_ORIGIN uses http://. Serve the site over HTTPS before real customers use it.');

  if (env.COOKIE_SECURE === 'false') warnings.push('COOKIE_SECURE=false: login cookies are not marked Secure. Acceptable only for plain-HTTP testing.');
  if (!env.PUBLIC_URL) warnings.push('PUBLIC_URL is not set (used in password-reset links).');
  else if (env.PUBLIC_URL.startsWith('http://')) warnings.push('PUBLIC_URL uses http://.');

  if (env.SEED_ADMIN_EMAIL || env.SEED_ADMIN_PASSWORD) warnings.push('SEED_ADMIN_* are set. Remove them from the production .env; create admins deliberately instead.');
  if (/Pawzora#12345|ChangeMe/i.test(env.DATABASE_URL ?? '') || /ChangeMe/i.test(env.SEED_ADMIN_PASSWORD ?? '')) warnings.push('An example password is in use. Change it.');

  if (!env.SMTP_HOST || !env.MAIL_FROM) warnings.push('SMTP_HOST / MAIL_FROM are not set: password-reset and order-confirmation emails will NOT be sent, so customers who forget their password cannot recover their account.');

  const online = (env.PAYMENT_METHODS_ENABLED ?? 'COD').split(',').map((s) => s.trim().toUpperCase()).filter((m) => m && m !== 'COD');
  if (online.length) errors.push(`PAYMENT_METHODS_ENABLED lists ${online.join(', ')}, but no payment provider is integrated. Orders could never be confirmed as paid. Use COD only.`);

  return { errors, warnings };
}
