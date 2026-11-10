import nodemailer, { type Transporter } from 'nodemailer';

// Email over any standard SMTP server (Amazon SES SMTP, Gmail app password, Mailgun, …).
// Configure with SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS and MAIL_FROM. Without them nothing is sent.
// Emails are plain text on purpose: nothing a customer typed can ever be interpreted as HTML.
let transport: Transporter | null | undefined;

export const mailConfigured = () => Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM);

function getTransport() {
  if (transport === undefined) {
    transport = mailConfigured()
      ? nodemailer.createTransport({
          host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' } : undefined,
          connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
          tls: { rejectUnauthorized: process.env.SMTP_ALLOW_SELF_SIGNED !== 'true' },
        })
      : null;
  }
  return transport;
}

/** For tests: forget the cached transport so changed SMTP_* variables take effect. */
export function resetMailer() { transport = undefined; }

/** Sends one email. Never throws; returns whether the server accepted it. Callers should not await it in request paths that must not reveal timing. */
export async function sendMail(msg: { to: string; subject: string; text: string }): Promise<boolean> {
  const t = getTransport();
  if (!t) return false;
  try {
    await t.sendMail({ from: process.env.MAIL_FROM, to: msg.to, subject: msg.subject, text: msg.text });
    return true;
  } catch (e) {
    console.error('[mail] could not send:', (e as Error).message); // no recipient or body in the log
    return false;
  }
}

const peso = (n: number) => `PHP ${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const site = () => (process.env.PUBLIC_URL || '').replace(/\/$/, '');

export function resetPasswordEmail(name: string, link: string) {
  return {
    subject: 'Reset your Pawzora password',
    text: `Hi ${name.split(' ')[0]},\n\nWe received a request to reset your Pawzora password. Open this link to choose a new one (it works once and expires in 1 hour):\n\n${link}\n\nIf you didn't ask for this, you can ignore this email. Your password will not change.\n\n— Pawzora`,
  };
}

export function orderConfirmationEmail(o: {
  orderNumber: string; name: string; items: { name: string; quantity: number; lineTotal: number }[]; subtotal: number; discount: number; shipping: number; total: number;
  paymentMethod: string; address: string;
}) {
  const lines = o.items.map((i) => `  • ${i.name} × ${i.quantity}: ${peso(i.lineTotal)}`).join('\n');
  const pay = o.paymentMethod === 'COD' ? `Cash on Delivery. Please prepare ${peso(o.total)} for the courier.` : o.paymentMethod;
  return {
    subject: `Pawzora order ${o.orderNumber} received`,
    text: `Hi ${o.name.split(' ')[0]},\n\nThank you for your order! Here is your summary.\n\nOrder number: ${o.orderNumber}\n\n${lines}\n\nSubtotal: ${peso(o.subtotal)}\n${o.discount > 0 ? `Discount: -${peso(o.discount)}\n` : ''}Shipping: ${o.shipping === 0 ? 'FREE' : peso(o.shipping)}\nTotal: ${peso(o.total)}\n\nPayment: ${pay}\nDeliver to: ${o.address}\n\n${site() ? `Track your order: ${site()}/account/orders/${o.orderNumber}\n\n` : ''}— Pawzora`,
  };
}
