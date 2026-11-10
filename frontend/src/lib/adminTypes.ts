export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number; totalPages: number }

export interface AdminStats {
  totalRevenue: number; paidRevenue: number; totalOrders: number; pendingOrders: number; totalCustomers: number; totalProducts: number; lowStockCount: number;
  lowStock: { productId: number; name: string; quantity: number; threshold: number }[];
  salesByDay: { date: string; orders: number; revenue: number }[];
  bestSellers: { productId: number; name: string; units: number; revenue: number }[];
  recentOrders: { orderNumber: string; customer: string; status: string; paymentStatus: string; total: number; createdAt: string; isDemo: boolean }[];
  recentTransactions: { id: number; orderNumber: string; email: string; provider: string; amount: number; status: string; createdAt: string }[];
  includesDemoData: boolean;
}

export interface AdminProduct {
  id: number; name: string; slug: string; brand: string; description: string; price: number; salePrice: number | null; saleEndsAt: string | null;
  categoryId: number; petTypeId: number; category: string; petType: string; isFeatured: boolean; isActive: boolean; archivedAt: string | null; isDemo: boolean;
  soldCount: number; stock: number; lowStockThreshold: number; images: string[];
}
export interface AdminCategory { id: number; name: string; slug: string; kind: 'PRODUCT' | 'PET'; imageUrl: string | null; sortOrder: number; productCount: number }
export interface InventoryRow { productId: number; name: string; brand: string; image: string | null; isActive: boolean; quantity: number; lowStockThreshold: number; low: boolean; out: boolean; variants: { name: string; stock: number }[] }

export interface AdminOrderRow { orderNumber: string; customer: string; email: string; status: string; paymentStatus: string; paymentMethod: string; total: number; itemCount: number; createdAt: string; isDemo: boolean }
export interface AdminOrderDetail {
  orderNumber: string; status: string; paymentStatus: string; paymentMethod: string; shippingMethod: string;
  subtotal: number; shippingFee: number; discountTotal: number; total: number; couponCode: string | null;
  customer: { id: number; name: string; email: string } | null; email: string; notes: string | null; isDemo: boolean; createdAt: string;
  ship: { name: string; phone: string; address: string; barangay: string; city: string; province: string; postalCode: string };
  items: { id: number; name: string; imageUrl: string | null; unitPrice: number; quantity: number; lineTotal: number }[];
  payments: { id: number; provider: string; amount: number; status: string; paidAt: string | null; providerRef: string | null }[];
  shipments: { id: number; carrier: string; trackingNumber: string | null; status: string; shippedAt: string | null; deliveredAt: string | null }[];
  allowedNext: string[]; canMarkPaid: boolean; canRefund: boolean;
}
export interface PaymentRow { id: number; orderNumber: string; customer: string; email: string; provider: string; amount: number; status: string; paidAt: string | null; createdAt: string; providerRef: string | null; isDemo: boolean }
export interface CustomerRow { id: number; name: string; email: string; phone: string | null; status: string; isDemo: boolean; orders: number; totalSpent: number; joinedAt: string }
export interface CustomerDetail { id: number; name: string; email: string; phone: string | null; status: string; isDemo: boolean; joinedAt: string; pets: number; wishlistItems: number; orders: { orderNumber: string; status: string; paymentStatus: string; total: number; createdAt: string }[] }
