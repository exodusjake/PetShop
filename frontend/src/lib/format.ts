const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 });
export const formatPeso = (n: number) => peso.format(n);

export const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

export function formatAge(months: number) {
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
  const y = Math.floor(months / 12), m = months % 12;
  return `${y} year${y === 1 ? '' : 's'}${m ? ` ${m} mo` : ''}`;
}

export const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

export function formatAgeFromDate(iso: string | null) {
  if (!iso) return '';
  const months = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (30.44 * 864e5)));
  return formatAge(months);
}
