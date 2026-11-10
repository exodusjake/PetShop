import { prisma } from './db.js';

export class ConflictError extends Error { status = 409; }

/** Allowed order status changes (admin). Anything else is rejected. */
export const ORDER_FLOW: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

/**
 * Cancels an order and returns its stock, coupon use and pending payment.
 * The status change is conditional, so only one concurrent cancel can succeed.
 */
export async function cancelOrder(orderId: number, allowedFrom: string[]) {
  const o = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!o) throw new ConflictError('Order not found.');
  await prisma.$transaction(async (tx) => {
    const changed = await tx.order.updateMany({ where: { id: o.id, status: { in: allowedFrom } }, data: { status: 'CANCELLED' } });
    if (changed.count === 0) throw new ConflictError('This order was already updated.');
    for (const i of o.items) {
      await tx.inventory.updateMany({ where: { productId: i.productId }, data: { quantity: { increment: i.quantity } } });
      if (i.variantId) await tx.productVariant.updateMany({ where: { id: i.variantId }, data: { stock: { increment: i.quantity } } });
      await tx.product.update({ where: { id: i.productId }, data: { soldCount: { decrement: i.quantity } } });
    }
    await tx.payment.updateMany({ where: { orderId: o.id, status: 'PENDING' }, data: { status: 'FAILED' } });
    const red = await tx.couponRedemption.findFirst({ where: { orderId: o.id } });
    if (red) {
      await tx.coupon.update({ where: { id: red.couponId }, data: { usedCount: { decrement: 1 } } });
      await tx.couponRedemption.delete({ where: { id: red.id } });
    }
  });
}
