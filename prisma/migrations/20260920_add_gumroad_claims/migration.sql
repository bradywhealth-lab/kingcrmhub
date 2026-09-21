-- Gumroad purchase -> account claim flow (t_55f06113)
--
-- ONE-TIME promotional entitlement grant. Grants do NOT touch Stripe and
-- never modify Organization.plan directly: a claim writes promo columns
-- (promoPlanId/promoPlanExpiresAt) and entitlement reads the effective
-- tier via effectivePlanId(promos.ts). Expiry (day 31) falls back to the
-- stored plan automatically — data stays visible, new adds are gated by
-- the entitlement ladder (Brady decision record 2026-09-21).
--
-- RLS EXEMPTION (deliberate): this table is NOT added to the rls.sql
-- tenant list. It is a CROSS-TENANT allowlist: a claim is created
-- pre-signup (organizationId NULL, no tenant context) and read later by
-- whatever org claims it. A tenant-scoped policy would make claims
-- unreachable. Keep this table out of rls.sql forever — the schema
-- comment documents it.

CREATE TABLE "GumroadClaim" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "purchaseRef" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "planId" TEXT NOT NULL DEFAULT 'pro',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "organizationId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "grantedAt" TIMESTAMP(3),
  CONSTRAINT "GumroadClaim_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GumroadClaim_purchaseRef_key" UNIQUE ("purchaseRef")
);

CREATE INDEX "GumroadClaim_email_idx" ON "GumroadClaim"("email");

ALTER TABLE "Organization" ADD COLUMN "promoPlanId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "promoPlanExpiresAt" TIMESTAMP(3);

-- Down migration (documented rollback path)
-- DROP TABLE "GumroadClaim";
-- ALTER TABLE "Organization" DROP COLUMN IF EXISTS "promoPlanId";
-- ALTER TABLE "Organization" DROP COLUMN IF EXISTS "promoPlanExpiresAt";
