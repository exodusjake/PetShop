BEGIN TRY

BEGIN TRAN;

-- DropIndex
ALTER TABLE [dbo].[CartItem] DROP CONSTRAINT [CartItem_cartId_productId_key];

-- CreateIndex
ALTER TABLE [dbo].[CartItem] ADD CONSTRAINT [CartItem_cartId_productId_variantId_key] UNIQUE NONCLUSTERED ([cartId], [productId], [variantId]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

