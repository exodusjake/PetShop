/**
 * Returns `next` only if it is a plain same-site path. Anything that a browser could read as another site
 * (`//evil.com`, `/\evil.com`, `https://…`, `javascript:…`, control characters) falls back to the home page.
 */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next || next.length > 300) return fallback;
  if (!next.startsWith('/')) return fallback;
  if (next.startsWith('//') || next.includes('\\')) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  if (!/^\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#]*$/.test(next)) return fallback;
  // also check what it means once percent-decoding is applied (e.g. %0d%0a, %5c, %2f%2f)
  let decoded: string;
  try { decoded = decodeURIComponent(next); } catch { return fallback; }
  // eslint-disable-next-line no-control-regex
  if (decoded.startsWith('//') || decoded.includes('\\') || /[\u0000-\u001f\u007f]/.test(decoded)) return fallback;
  return next;
}
