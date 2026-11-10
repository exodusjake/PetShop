// Slows down password guessing on a single account from a single address.
// In-memory, so it is per API process (we run one process; behind several, move this to Redis/DB).
// The key includes the IP so a stranger can't lock a real customer out by typing wrong passwords for their email.
const WINDOW_MS = 15 * 60_000;
const MAX_FAILS = Number(process.env.LOGIN_MAX_FAILS || 5);

const fails = new Map<string, { n: number; first: number }>();
const key = (ip: string | undefined, email: string) => `${ip ?? '?'}|${email}`;

function prune(now: number) {
  if (fails.size < 2000) return;
  for (const [k, v] of fails) if (now - v.first > WINDOW_MS) fails.delete(k);
}

export const loginThrottle = {
  /** Seconds the caller must still wait, or 0 if the login attempt may proceed. */
  retryAfter(ip: string | undefined, email: string, now = Date.now()) {
    const e = fails.get(key(ip, email));
    if (!e) return 0;
    if (now - e.first > WINDOW_MS) { fails.delete(key(ip, email)); return 0; }
    return e.n >= MAX_FAILS ? Math.ceil((e.first + WINDOW_MS - now) / 1000) : 0;
  },
  fail(ip: string | undefined, email: string, now = Date.now()) {
    prune(now);
    const k = key(ip, email), e = fails.get(k);
    if (!e || now - e.first > WINDOW_MS) fails.set(k, { n: 1, first: now });
    else e.n++;
  },
  clear(ip: string | undefined, email: string) { fails.delete(key(ip, email)); },
  reset() { fails.clear(); },
};
