import { useEffect, useState } from 'react';

// Relative URLs: Vite proxies /api in dev; nginx proxies it to the API EC2 in production.
export class ApiError extends Error {
  constructor(message: string, public status: number, public issues: Record<string, string[]> = {}) { super(message); }
}

export async function api<T>(path: string, opts: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = opts;
  const res = await fetch('/api' + path, {
    credentials: 'include',
    ...rest,
    // X-Requested-With is the CSRF header the API requires on every state-changing request.
    headers: { 'X-Requested-With': 'pawzora', ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { message?: string }).message || 'Request failed', res.status, (data as { issues?: Record<string, string[]> }).issues);
  return data as T;
}

/** Tiny data-fetching hook (GET only). Re-fetches when `path` changes. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);

  useEffect(() => {
    if (path === null) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    api<T>(path, { signal: ctrl.signal })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { if (e.name !== 'AbortError') { setError(e.message || 'Failed to load'); setLoading(false); } });
    return () => ctrl.abort();
  }, [path]);

  return { data, error, loading };
}

/** Uploads one image (JPEG/PNG/WebP, max 5 MB). The server checks the real file contents. */
export async function uploadImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new ApiError('Please choose a JPEG, PNG or WebP image.', 400);
  if (file.size > 5 * 1024 * 1024) throw new ApiError('That image is larger than 5 MB.', 400);
  const res = await fetch('/api/uploads', { method: 'POST', credentials: 'include', headers: { 'Content-Type': file.type, 'X-Requested-With': 'pawzora' }, body: file });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { message?: string }).message || 'Upload failed', res.status);
  return (data as { url: string }).url;
}
