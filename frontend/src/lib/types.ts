export interface Category { id: number; name: string; slug: string; kind: 'PET' | 'PRODUCT'; imageUrl: string | null }

export interface Product {
  id: number; name: string; slug: string; brand: string; description: string;
  price: number; salePrice: number | null; effectivePrice: number; onSale: boolean; discountPercent: number;
  ratingAvg: number; reviewCount: number; soldCount: number; isFeatured: boolean; isDemo: boolean;
  stock: number; inStock: boolean; lowStock: boolean;
  image: string | null; images: { url: string; alt: string | null }[];
  category: { id: number; name: string; slug: string };
  petType: { id: number; name: string; slug: string };
  createdAt: string;
}

export interface ProductDetail extends Product {
  variants: { id: number; name: string; sku: string; priceDelta: number; stock: number }[];
  reviews: { id: number; author: string; rating: number; title: string | null; body: string; isDemo: boolean; createdAt: string }[];
  related: Product[];
}

export interface ProductPage { items: Product[]; total: number; page: number; pageSize: number; totalPages: number }

export interface AdoptionPet {
  id: number; name: string; species: string; breed: string; ageMonths: number; gender: string;
  description: string; status: 'AVAILABLE' | 'PENDING' | 'ADOPTED'; location: string; requirements: string; photoUrl: string | null; isDemo: boolean;
}

export interface BlogPreview {
  id: number; title: string; slug: string; excerpt: string; coverUrl: string | null; category: string;
  readMinutes: number; publishedAt: string; isDemo: boolean;
}

export interface FeaturedReview { id: number; author: string; rating: number; body: string; isDemo: boolean; product: { name: string; slug: string } }

export type StoreSettings = Record<string, string>;

// ───────────── cart / checkout / orders (all amounts are PHP, computed by the server) ─────────────
export interface CartLine {
  id: number; productId: number; variantId: number | null; variantName: string | null; name: string; slug: string; image: string | null;
  unitPrice: number; quantity: number; lineTotal: number; stock: number; available: boolean; issue: string | null;
}
export type ShippingCode = 'STANDARD' | 'EXPRESS';
export interface ShippingOption { code: ShippingCode; label: string; eta: string; fee: number; free: boolean }
export interface PaymentOption { code: 'COD' | 'GCASH' | 'MAYA' | 'CARD'; label: string; available: boolean; note: string }
export interface CartData {
  lines: CartLine[]; itemCount: number; subtotal: number; discount: number;
  coupon: { code: string; description: string } | null; couponError: string | null;
  shippingMethod: ShippingCode; shippingFee: number; total: number;
  shippingOptions: ShippingOption[]; freeShippingOver: number; hasIssues: boolean; paymentMethods: PaymentOption[];
}

export interface Order {
  orderNumber: string; status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  paymentStatus: 'UNPAID' | 'PAID' | 'FAILED' | 'REFUNDED'; paymentMethod: PaymentOption['code']; shippingMethod: ShippingCode;
  subtotal: number; shippingFee: number; discountTotal: number; total: number; couponCode: string | null;
  ship: { name: string; phone: string; address: string; barangay: string; city: string; province: string; postalCode: string };
  email: string; notes: string | null; isDemo: boolean; createdAt: string;
  estimatedDelivery: { from: string; to: string } | null;
  items: { id: number; productId: number; name: string; imageUrl: string | null; unitPrice: number; quantity: number; lineTotal: number }[];
  shipments: { carrier: string; trackingNumber: string | null; status: string; shippedAt: string | null; deliveredAt: string | null }[];
  canCancel: boolean;
}

// ───────────── adoption / blog ─────────────
export interface MyApplication {
  id: number; status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'; adminNote: string | null; createdAt: string; updatedAt: string;
  pet: { id: number; name: string; species: string; breed: string; photoUrl: string | null; status: AdoptionPet['status'] };
}
export interface BlogCard {
  id: number; title: string; slug: string; excerpt: string; coverUrl: string | null; category: string; categorySlug: string; readMinutes: number; publishedAt: string; isDemo: boolean;
}
export interface BlogDetail extends BlogCard { content: string; related: BlogCard[] }
