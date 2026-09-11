-- CKYC identity binding from the become-a-seller wizard.
-- All nullable: unknown for legacy rows, no backfill needed.
ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "idType" TEXT;
ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "idNumber" TEXT;
ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "nameOnId" TEXT;
ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "dob" TEXT;
ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "pan" TEXT;
ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "bankAccount" TEXT;
ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "selfieUrl" TEXT;
