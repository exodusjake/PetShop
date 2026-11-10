import { prisma } from './db.js';

/** Recomputes a product's star average and review count from its published reviews. */
export async function recalcProductRating(productId: number) {
  const agg = await prisma.review.aggregate({ where: { productId, status: 'PUBLISHED' }, _avg: { rating: true }, _count: true });
  await prisma.product.update({ where: { id: productId }, data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, reviewCount: agg._count } });
}
