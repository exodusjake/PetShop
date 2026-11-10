import type { Category, Inventory, Product, ProductImage } from '@prisma/client';

type ProductRow = Product & {
  images: ProductImage[];
  inventory: Inventory | null;
  category: Category;
  petType: Category;
};

export const saleActive = (p: Pick<Product, 'salePrice' | 'saleEndsAt'>) =>
  p.salePrice != null && (!p.saleEndsAt || p.saleEndsAt.getTime() > Date.now());

/** Public shape of a product. Prices are plain numbers (PHP). */
export function toProductDTO(p: ProductRow) {
  const price = Number(p.price);
  const onSale = saleActive(p);
  const effectivePrice = onSale ? Number(p.salePrice) : price;
  const stock = p.inventory?.quantity ?? 0;
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    brand: p.brand,
    description: p.description,
    price,
    salePrice: onSale ? Number(p.salePrice) : null,
    effectivePrice,
    onSale,
    discountPercent: onSale ? Math.round((1 - effectivePrice / price) * 100) : 0,
    ratingAvg: p.ratingAvg,
    reviewCount: p.reviewCount,
    soldCount: p.soldCount,
    isFeatured: p.isFeatured,
    isDemo: p.isDemo,
    stock,
    inStock: stock > 0,
    lowStock: stock > 0 && stock <= (p.inventory?.lowStockThreshold ?? 5),
    image: p.images[0]?.url ?? null,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt })),
    category: { id: p.category.id, name: p.category.name, slug: p.category.slug },
    petType: { id: p.petType.id, name: p.petType.name, slug: p.petType.slug },
    createdAt: p.createdAt,
  };
}

export const productInclude = {
  images: { orderBy: { sortOrder: 'asc' as const } },
  inventory: true,
  category: true,
  petType: true,
};
