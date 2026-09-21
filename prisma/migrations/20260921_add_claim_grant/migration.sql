-- Add ClaimGrant ledger for the promo → 1-month Studio claim flow (t_6b6b0ff9).
-- The free month NEVER touches Stripe: grants are direct DB entitlement writes
-- (Organization.plan = 'pro' + ClaimGrant.expiresAt). Raw license keys are never
-- stored — only the SHA-256 hash; single-use is enforced by the unique
-- constraint on licenseKeyHash, one-grant-per-email+product by the composite.
-- organizationId is nullable (pre-signup grants) — the FK below is enforced
-- only when a tenant is present.

CREATE TABLE "ClaimGrant" (
    "id" TEXT NOT NULL,
    "licenseKeyHash" TEXT NOT NULL,
    "orderEmail" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'gumroad-license',
    "organizationId" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'pro',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClaimGrant_licenseKeyHash_key" ON "ClaimGrant"("licenseKeyHash");

CREATE UNIQUE INDEX "ClaimGrant_orderEmail_productId_key" ON "ClaimGrant"("orderEmail", "productId");

CREATE INDEX "ClaimGrant_organizationId_idx" ON "ClaimGrant"("organizationId");

CREATE INDEX "ClaimGrant_expiresAt_idx" ON "ClaimGrant"("expiresAt");

ALTER TABLE "ClaimGrant" ADD CONSTRAINT "ClaimGrant_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
