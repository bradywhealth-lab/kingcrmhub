-- Rename tables from Carrier* to ServicePackage/PackageDocument*
-- This migration renames the insurance-specific table names to generic freelancer terminology

-- Rename Carrier → ServicePackage
ALTER TABLE "Carrier" RENAME TO "ServicePackage";
ALTER INDEX "Carrier_pkey" RENAME TO "ServicePackage_pkey";
ALTER INDEX "Carrier_organizationId_slug_key" RENAME TO "ServicePackage_organizationId_slug_key";
ALTER INDEX "Carrier_organizationId_idx" RENAME TO "ServicePackage_organizationId_idx";

-- Rename CarrierDocument → PackageDocument
ALTER TABLE "CarrierDocument" RENAME TO "PackageDocument";
ALTER INDEX "CarrierDocument_pkey" RENAME TO "PackageDocument_pkey";
ALTER INDEX "CarrierDocument_organizationId_idx" RENAME TO "PackageDocument_organizationId_idx";
ALTER INDEX "CarrierDocument_carrierId_idx" RENAME TO "PackageDocument_packageId_idx";

-- Rename CarrierDocumentChunk → PackageDocumentChunk
ALTER TABLE "CarrierDocumentChunk" RENAME TO "PackageDocumentChunk";
ALTER INDEX "CarrierDocumentChunk_pkey" RENAME TO "PackageDocumentChunk_pkey";
ALTER INDEX "CarrierDocumentChunk_organizationId_idx" RENAME TO "PackageDocumentChunk_organizationId_idx";
ALTER INDEX "CarrierDocumentChunk_carrierDocumentId_idx" RENAME TO "PackageDocumentChunk_packageDocumentId_idx";
ALTER INDEX "CarrierDocumentChunk_carrierDocumentId_chunkIndex_key" RENAME TO "PackageDocumentChunk_packageDocumentId_chunkIndex_key";

-- Rename columns
ALTER TABLE "PackageDocument" RENAME COLUMN "carrierId" TO "packageId";
ALTER TABLE "PackageDocumentChunk" RENAME COLUMN "carrierDocumentId" TO "packageDocumentId";

-- Rename foreign key constraints
ALTER TABLE "PackageDocument" DROP CONSTRAINT IF EXISTS "CarrierDocument_carrierId_fkey";
ALTER TABLE "PackageDocument" ADD CONSTRAINT "PackageDocument_packageId_fkey" 
  FOREIGN KEY ("packageId") REFERENCES "ServicePackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PackageDocumentChunk" DROP CONSTRAINT IF EXISTS "CarrierDocumentChunk_carrierDocumentId_fkey";
ALTER TABLE "PackageDocumentChunk" ADD CONSTRAINT "PackageDocumentChunk_packageDocumentId_fkey" 
  FOREIGN KEY ("packageDocumentId") REFERENCES "PackageDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rename organizationId FK constraints
ALTER TABLE "ServicePackage" DROP CONSTRAINT IF EXISTS "Carrier_organizationId_fkey";
ALTER TABLE "PackageDocument" DROP CONSTRAINT IF EXISTS "CarrierDocument_organizationId_fkey";
ALTER TABLE "PackageDocumentChunk" DROP CONSTRAINT IF EXISTS "CarrierDocumentChunk_organizationId_fkey";
