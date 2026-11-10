import { describe, expect, it } from 'vitest';
import { safeNext } from './safeNext';

describe('safeNext', () => {
  it('keeps normal same-site paths', () => {
    for (const p of ['/', '/checkout', '/account/orders/PZ-20261108-ABCDE', '/shop?pet=dogs&sort=price-asc', '/adoption/3#apply', '/login?next=%2Fcheckout']) expect(safeNext(p)).toBe(p);
  });

  it('rejects anything a browser could treat as another site', () => {
    const bad = ['//evil.com', '///evil.com', '/\\evil.com', '/\\/evil.com', '\\\\evil.com', 'https://evil.com', 'http://evil.com/x', 'javascript:alert(1)', 'data:text/html,hi',
      'evil.com', '/%0d%0aSet-Cookie:x', '/a\tb', '/a\nb', '/ok\u0000', '/path with space', '/<script>', '/"quoted"'];
    for (const p of bad) expect(safeNext(p), JSON.stringify(p)).toBe('/');
  });

  it('handles empty and oversized input and honours the fallback', () => {
    expect(safeNext(null)).toBe('/');
    expect(safeNext(undefined)).toBe('/');
    expect(safeNext('')).toBe('/');
    expect(safeNext('/' + 'a'.repeat(400))).toBe('/');
    expect(safeNext('nope', '/account')).toBe('/account');
  });
});
