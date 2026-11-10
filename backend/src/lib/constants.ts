// Allowed values for string "enum" columns (SQL Server has no native Prisma enums).
export const ROLES = ['CUSTOMER', 'ADMIN'] as const;
export const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
export const PAYMENT_STATUSES = ['UNPAID', 'PAID', 'FAILED', 'REFUNDED'] as const;
export const PAYMENT_METHODS = ['COD', 'GCASH', 'MAYA', 'CARD'] as const;
export const ADOPTION_STATUSES = ['AVAILABLE', 'PENDING', 'ADOPTED'] as const;
export const APPLICATION_STATUSES = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'] as const;

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
