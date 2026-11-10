BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Role] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(30) NOT NULL,
    CONSTRAINT [Role_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Role_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] INT NOT NULL IDENTITY(1,1),
    [email] NVARCHAR(190) NOT NULL,
    [passwordHash] NVARCHAR(120) NOT NULL,
    [fullName] NVARCHAR(120) NOT NULL,
    [phone] NVARCHAR(30),
    [avatarUrl] NVARCHAR(300),
    [roleId] INT NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [User_status_df] DEFAULT 'ACTIVE',
    [notifyOrders] BIT NOT NULL CONSTRAINT [User_notifyOrders_df] DEFAULT 1,
    [notifyPromos] BIT NOT NULL CONSTRAINT [User_notifyPromos_df] DEFAULT 1,
    [isDemo] BIT NOT NULL CONSTRAINT [User_isDemo_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[UserSession] (
    [id] INT NOT NULL IDENTITY(1,1),
    [userId] INT NOT NULL,
    [tokenHash] NVARCHAR(100) NOT NULL,
    [userAgent] NVARCHAR(300),
    [ip] NVARCHAR(60),
    [expiresAt] DATETIME2 NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [UserSession_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [UserSession_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UserSession_tokenHash_key] UNIQUE NONCLUSTERED ([tokenHash])
);

-- CreateTable
CREATE TABLE [dbo].[Category] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(80) NOT NULL,
    [slug] NVARCHAR(100) NOT NULL,
    [kind] NVARCHAR(10) NOT NULL,
    [imageUrl] NVARCHAR(300),
    [sortOrder] INT NOT NULL CONSTRAINT [Category_sortOrder_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Category_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Category_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Category_slug_key] UNIQUE NONCLUSTERED ([slug])
);

-- CreateTable
CREATE TABLE [dbo].[Product] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(160) NOT NULL,
    [slug] NVARCHAR(190) NOT NULL,
    [description] NVARCHAR(max) NOT NULL,
    [brand] NVARCHAR(80) NOT NULL,
    [price] DECIMAL(10,2) NOT NULL,
    [salePrice] DECIMAL(10,2),
    [saleEndsAt] DATETIME2,
    [categoryId] INT NOT NULL,
    [petTypeId] INT NOT NULL,
    [ratingAvg] FLOAT(53) NOT NULL CONSTRAINT [Product_ratingAvg_df] DEFAULT 0,
    [reviewCount] INT NOT NULL CONSTRAINT [Product_reviewCount_df] DEFAULT 0,
    [soldCount] INT NOT NULL CONSTRAINT [Product_soldCount_df] DEFAULT 0,
    [isFeatured] BIT NOT NULL CONSTRAINT [Product_isFeatured_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [Product_isActive_df] DEFAULT 1,
    [isDemo] BIT NOT NULL CONSTRAINT [Product_isDemo_df] DEFAULT 0,
    [archivedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Product_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Product_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Product_slug_key] UNIQUE NONCLUSTERED ([slug])
);

-- CreateTable
CREATE TABLE [dbo].[ProductImage] (
    [id] INT NOT NULL IDENTITY(1,1),
    [productId] INT NOT NULL,
    [url] NVARCHAR(300) NOT NULL,
    [alt] NVARCHAR(160),
    [sortOrder] INT NOT NULL CONSTRAINT [ProductImage_sortOrder_df] DEFAULT 0,
    CONSTRAINT [ProductImage_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ProductVariant] (
    [id] INT NOT NULL IDENTITY(1,1),
    [productId] INT NOT NULL,
    [name] NVARCHAR(80) NOT NULL,
    [sku] NVARCHAR(60) NOT NULL,
    [priceDelta] DECIMAL(10,2) NOT NULL CONSTRAINT [ProductVariant_priceDelta_df] DEFAULT 0,
    [stock] INT NOT NULL CONSTRAINT [ProductVariant_stock_df] DEFAULT 0,
    CONSTRAINT [ProductVariant_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ProductVariant_sku_key] UNIQUE NONCLUSTERED ([sku])
);

-- CreateTable
CREATE TABLE [dbo].[Inventory] (
    [id] INT NOT NULL IDENTITY(1,1),
    [productId] INT NOT NULL,
    [quantity] INT NOT NULL CONSTRAINT [Inventory_quantity_df] DEFAULT 0,
    [lowStockThreshold] INT NOT NULL CONSTRAINT [Inventory_lowStockThreshold_df] DEFAULT 5,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Inventory_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Inventory_productId_key] UNIQUE NONCLUSTERED ([productId])
);

-- CreateTable
CREATE TABLE [dbo].[Cart] (
    [id] INT NOT NULL IDENTITY(1,1),
    [userId] INT,
    [guestToken] NVARCHAR(80),
    [couponCode] NVARCHAR(40),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Cart_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Cart_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[CartItem] (
    [id] INT NOT NULL IDENTITY(1,1),
    [cartId] INT NOT NULL,
    [productId] INT NOT NULL,
    [variantId] INT,
    [quantity] INT NOT NULL CONSTRAINT [CartItem_quantity_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CartItem_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [CartItem_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CartItem_cartId_productId_key] UNIQUE NONCLUSTERED ([cartId],[productId])
);

-- CreateTable
CREATE TABLE [dbo].[Order] (
    [id] INT NOT NULL IDENTITY(1,1),
    [orderNumber] NVARCHAR(30) NOT NULL,
    [userId] INT,
    [email] NVARCHAR(190) NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [Order_status_df] DEFAULT 'PENDING',
    [paymentStatus] NVARCHAR(20) NOT NULL CONSTRAINT [Order_paymentStatus_df] DEFAULT 'UNPAID',
    [paymentMethod] NVARCHAR(20) NOT NULL,
    [shippingMethod] NVARCHAR(20) NOT NULL CONSTRAINT [Order_shippingMethod_df] DEFAULT 'STANDARD',
    [subtotal] DECIMAL(10,2) NOT NULL,
    [shippingFee] DECIMAL(10,2) NOT NULL,
    [discountTotal] DECIMAL(10,2) NOT NULL CONSTRAINT [Order_discountTotal_df] DEFAULT 0,
    [total] DECIMAL(10,2) NOT NULL,
    [couponCode] NVARCHAR(40),
    [shipName] NVARCHAR(120) NOT NULL,
    [shipPhone] NVARCHAR(30) NOT NULL,
    [shipAddress] NVARCHAR(300) NOT NULL,
    [shipBarangay] NVARCHAR(100) NOT NULL,
    [shipCity] NVARCHAR(100) NOT NULL,
    [shipProvince] NVARCHAR(100) NOT NULL,
    [shipPostal] NVARCHAR(12) NOT NULL,
    [notes] NVARCHAR(500),
    [isDemo] BIT NOT NULL CONSTRAINT [Order_isDemo_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Order_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Order_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Order_orderNumber_key] UNIQUE NONCLUSTERED ([orderNumber])
);

-- CreateTable
CREATE TABLE [dbo].[OrderItem] (
    [id] INT NOT NULL IDENTITY(1,1),
    [orderId] INT NOT NULL,
    [productId] INT NOT NULL,
    [variantId] INT,
    [name] NVARCHAR(160) NOT NULL,
    [imageUrl] NVARCHAR(300),
    [unitPrice] DECIMAL(10,2) NOT NULL,
    [quantity] INT NOT NULL,
    [lineTotal] DECIMAL(10,2) NOT NULL,
    CONSTRAINT [OrderItem_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Payment] (
    [id] INT NOT NULL IDENTITY(1,1),
    [orderId] INT NOT NULL,
    [provider] NVARCHAR(20) NOT NULL,
    [providerRef] NVARCHAR(120),
    [amount] DECIMAL(10,2) NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [Payment_status_df] DEFAULT 'PENDING',
    [paidAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Payment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Payment_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ShippingAddress] (
    [id] INT NOT NULL IDENTITY(1,1),
    [userId] INT NOT NULL,
    [label] NVARCHAR(40) NOT NULL CONSTRAINT [ShippingAddress_label_df] DEFAULT 'Home',
    [fullName] NVARCHAR(120) NOT NULL,
    [phone] NVARCHAR(30) NOT NULL,
    [line1] NVARCHAR(300) NOT NULL,
    [barangay] NVARCHAR(100) NOT NULL,
    [city] NVARCHAR(100) NOT NULL,
    [province] NVARCHAR(100) NOT NULL,
    [postalCode] NVARCHAR(12) NOT NULL,
    [isDefault] BIT NOT NULL CONSTRAINT [ShippingAddress_isDefault_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ShippingAddress_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ShippingAddress_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Shipment] (
    [id] INT NOT NULL IDENTITY(1,1),
    [orderId] INT NOT NULL,
    [carrier] NVARCHAR(60) NOT NULL,
    [trackingNumber] NVARCHAR(80),
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [Shipment_status_df] DEFAULT 'PREPARING',
    [shippedAt] DATETIME2,
    [deliveredAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Shipment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Shipment_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Wishlist] (
    [id] INT NOT NULL IDENTITY(1,1),
    [userId] INT NOT NULL,
    [productId] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Wishlist_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Wishlist_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Wishlist_userId_productId_key] UNIQUE NONCLUSTERED ([userId],[productId])
);

-- CreateTable
CREATE TABLE [dbo].[Review] (
    [id] INT NOT NULL IDENTITY(1,1),
    [productId] INT NOT NULL,
    [userId] INT,
    [authorName] NVARCHAR(80) NOT NULL,
    [rating] INT NOT NULL,
    [title] NVARCHAR(120),
    [body] NVARCHAR(1500) NOT NULL,
    [status] NVARCHAR(12) NOT NULL CONSTRAINT [Review_status_df] DEFAULT 'PUBLISHED',
    [isDemo] BIT NOT NULL CONSTRAINT [Review_isDemo_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Review_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Review_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Pet] (
    [id] INT NOT NULL IDENTITY(1,1),
    [userId] INT NOT NULL,
    [name] NVARCHAR(80) NOT NULL,
    [species] NVARCHAR(40) NOT NULL,
    [breed] NVARCHAR(80),
    [birthDate] DATETIME2,
    [gender] NVARCHAR(12),
    [photoUrl] NVARCHAR(300),
    [notes] NVARCHAR(500),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Pet_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Pet_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AdoptionListing] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(80) NOT NULL,
    [species] NVARCHAR(40) NOT NULL,
    [breed] NVARCHAR(80) NOT NULL,
    [ageMonths] INT NOT NULL,
    [gender] NVARCHAR(12) NOT NULL,
    [description] NVARCHAR(max) NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [AdoptionListing_status_df] DEFAULT 'AVAILABLE',
    [location] NVARCHAR(120) NOT NULL,
    [requirements] NVARCHAR(600) NOT NULL,
    [photoUrl] NVARCHAR(300),
    [isDemo] BIT NOT NULL CONSTRAINT [AdoptionListing_isDemo_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AdoptionListing_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [AdoptionListing_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AdoptionApplication] (
    [id] INT NOT NULL IDENTITY(1,1),
    [listingId] INT NOT NULL,
    [userId] INT NOT NULL,
    [applicantName] NVARCHAR(120) NOT NULL,
    [email] NVARCHAR(190) NOT NULL,
    [phone] NVARCHAR(30) NOT NULL,
    [address] NVARCHAR(300) NOT NULL,
    [livingSituation] NVARCHAR(300) NOT NULL,
    [experience] NVARCHAR(600) NOT NULL,
    [reason] NVARCHAR(800) NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [AdoptionApplication_status_df] DEFAULT 'PENDING',
    [adminNote] NVARCHAR(500),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AdoptionApplication_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [AdoptionApplication_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[BlogCategory] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(80) NOT NULL,
    [slug] NVARCHAR(100) NOT NULL,
    CONSTRAINT [BlogCategory_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [BlogCategory_slug_key] UNIQUE NONCLUSTERED ([slug])
);

-- CreateTable
CREATE TABLE [dbo].[BlogPost] (
    [id] INT NOT NULL IDENTITY(1,1),
    [title] NVARCHAR(200) NOT NULL,
    [slug] NVARCHAR(220) NOT NULL,
    [excerpt] NVARCHAR(400) NOT NULL,
    [content] NVARCHAR(max) NOT NULL,
    [coverUrl] NVARCHAR(300),
    [categoryId] INT NOT NULL,
    [authorId] INT,
    [status] NVARCHAR(12) NOT NULL CONSTRAINT [BlogPost_status_df] DEFAULT 'DRAFT',
    [readMinutes] INT NOT NULL CONSTRAINT [BlogPost_readMinutes_df] DEFAULT 4,
    [isDemo] BIT NOT NULL CONSTRAINT [BlogPost_isDemo_df] DEFAULT 0,
    [publishedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [BlogPost_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [BlogPost_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [BlogPost_slug_key] UNIQUE NONCLUSTERED ([slug])
);

-- CreateTable
CREATE TABLE [dbo].[Coupon] (
    [id] INT NOT NULL IDENTITY(1,1),
    [code] NVARCHAR(40) NOT NULL,
    [type] NVARCHAR(10) NOT NULL,
    [value] DECIMAL(10,2) NOT NULL,
    [minSubtotal] DECIMAL(10,2) NOT NULL CONSTRAINT [Coupon_minSubtotal_df] DEFAULT 0,
    [startsAt] DATETIME2,
    [expiresAt] DATETIME2,
    [usageLimit] INT,
    [usedCount] INT NOT NULL CONSTRAINT [Coupon_usedCount_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [Coupon_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Coupon_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Coupon_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Coupon_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[CouponRedemption] (
    [id] INT NOT NULL IDENTITY(1,1),
    [couponId] INT NOT NULL,
    [userId] INT,
    [orderId] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CouponRedemption_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [CouponRedemption_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[NewsletterSubscriber] (
    [id] INT NOT NULL IDENTITY(1,1),
    [email] NVARCHAR(190) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [NewsletterSubscriber_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [NewsletterSubscriber_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [NewsletterSubscriber_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[ContactMessage] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(120) NOT NULL,
    [email] NVARCHAR(190) NOT NULL,
    [subject] NVARCHAR(160) NOT NULL,
    [message] NVARCHAR(2000) NOT NULL,
    [readAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ContactMessage_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ContactMessage_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Notification] (
    [id] INT NOT NULL IDENTITY(1,1),
    [userId] INT NOT NULL,
    [title] NVARCHAR(160) NOT NULL,
    [body] NVARCHAR(500) NOT NULL,
    [readAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Notification_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Notification_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AdminAuditLog] (
    [id] INT NOT NULL IDENTITY(1,1),
    [adminId] INT,
    [action] NVARCHAR(60) NOT NULL,
    [entity] NVARCHAR(40) NOT NULL,
    [entityId] NVARCHAR(40),
    [details] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AdminAuditLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AdminAuditLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[StoreSettings] (
    [id] INT NOT NULL IDENTITY(1,1),
    [key] NVARCHAR(60) NOT NULL,
    [value] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [StoreSettings_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [StoreSettings_key_key] UNIQUE NONCLUSTERED ([key])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_roleId_idx] ON [dbo].[User]([roleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [UserSession_userId_idx] ON [dbo].[UserSession]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [UserSession_expiresAt_idx] ON [dbo].[UserSession]([expiresAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Category_kind_sortOrder_idx] ON [dbo].[Category]([kind], [sortOrder]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Product_categoryId_idx] ON [dbo].[Product]([categoryId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Product_petTypeId_idx] ON [dbo].[Product]([petTypeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Product_isActive_isFeatured_idx] ON [dbo].[Product]([isActive], [isFeatured]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Product_price_idx] ON [dbo].[Product]([price]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ProductImage_productId_idx] ON [dbo].[ProductImage]([productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ProductVariant_productId_idx] ON [dbo].[ProductVariant]([productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Cart_userId_idx] ON [dbo].[Cart]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Cart_guestToken_idx] ON [dbo].[Cart]([guestToken]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Order_userId_idx] ON [dbo].[Order]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Order_status_idx] ON [dbo].[Order]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Order_createdAt_idx] ON [dbo].[Order]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OrderItem_orderId_idx] ON [dbo].[OrderItem]([orderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OrderItem_productId_idx] ON [dbo].[OrderItem]([productId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Payment_orderId_idx] ON [dbo].[Payment]([orderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ShippingAddress_userId_idx] ON [dbo].[ShippingAddress]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Shipment_orderId_idx] ON [dbo].[Shipment]([orderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Review_productId_status_idx] ON [dbo].[Review]([productId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Pet_userId_idx] ON [dbo].[Pet]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AdoptionListing_status_idx] ON [dbo].[AdoptionListing]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AdoptionApplication_listingId_idx] ON [dbo].[AdoptionApplication]([listingId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AdoptionApplication_userId_idx] ON [dbo].[AdoptionApplication]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AdoptionApplication_status_idx] ON [dbo].[AdoptionApplication]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BlogPost_status_publishedAt_idx] ON [dbo].[BlogPost]([status], [publishedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BlogPost_categoryId_idx] ON [dbo].[BlogPost]([categoryId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CouponRedemption_couponId_idx] ON [dbo].[CouponRedemption]([couponId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Notification_userId_readAt_idx] ON [dbo].[Notification]([userId], [readAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AdminAuditLog_createdAt_idx] ON [dbo].[AdminAuditLog]([createdAt]);

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_roleId_fkey] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[UserSession] ADD CONSTRAINT [UserSession_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Product] ADD CONSTRAINT [Product_categoryId_fkey] FOREIGN KEY ([categoryId]) REFERENCES [dbo].[Category]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Product] ADD CONSTRAINT [Product_petTypeId_fkey] FOREIGN KEY ([petTypeId]) REFERENCES [dbo].[Category]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ProductImage] ADD CONSTRAINT [ProductImage_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ProductVariant] ADD CONSTRAINT [ProductVariant_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Inventory] ADD CONSTRAINT [Inventory_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Cart] ADD CONSTRAINT [Cart_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[CartItem] ADD CONSTRAINT [CartItem_cartId_fkey] FOREIGN KEY ([cartId]) REFERENCES [dbo].[Cart]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[CartItem] ADD CONSTRAINT [CartItem_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CartItem] ADD CONSTRAINT [CartItem_variantId_fkey] FOREIGN KEY ([variantId]) REFERENCES [dbo].[ProductVariant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Order] ADD CONSTRAINT [Order_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OrderItem] ADD CONSTRAINT [OrderItem_orderId_fkey] FOREIGN KEY ([orderId]) REFERENCES [dbo].[Order]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[OrderItem] ADD CONSTRAINT [OrderItem_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OrderItem] ADD CONSTRAINT [OrderItem_variantId_fkey] FOREIGN KEY ([variantId]) REFERENCES [dbo].[ProductVariant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_orderId_fkey] FOREIGN KEY ([orderId]) REFERENCES [dbo].[Order]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ShippingAddress] ADD CONSTRAINT [ShippingAddress_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Shipment] ADD CONSTRAINT [Shipment_orderId_fkey] FOREIGN KEY ([orderId]) REFERENCES [dbo].[Order]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Wishlist] ADD CONSTRAINT [Wishlist_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Wishlist] ADD CONSTRAINT [Wishlist_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Review] ADD CONSTRAINT [Review_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Review] ADD CONSTRAINT [Review_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Pet] ADD CONSTRAINT [Pet_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AdoptionApplication] ADD CONSTRAINT [AdoptionApplication_listingId_fkey] FOREIGN KEY ([listingId]) REFERENCES [dbo].[AdoptionListing]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AdoptionApplication] ADD CONSTRAINT [AdoptionApplication_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BlogPost] ADD CONSTRAINT [BlogPost_categoryId_fkey] FOREIGN KEY ([categoryId]) REFERENCES [dbo].[BlogCategory]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BlogPost] ADD CONSTRAINT [BlogPost_authorId_fkey] FOREIGN KEY ([authorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CouponRedemption] ADD CONSTRAINT [CouponRedemption_couponId_fkey] FOREIGN KEY ([couponId]) REFERENCES [dbo].[Coupon]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CouponRedemption] ADD CONSTRAINT [CouponRedemption_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CouponRedemption] ADD CONSTRAINT [CouponRedemption_orderId_fkey] FOREIGN KEY ([orderId]) REFERENCES [dbo].[Order]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Notification] ADD CONSTRAINT [Notification_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AdminAuditLog] ADD CONSTRAINT [AdminAuditLog_adminId_fkey] FOREIGN KEY ([adminId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
