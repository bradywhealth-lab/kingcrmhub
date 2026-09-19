-- Add Stripe billing state to Organization (task t_004fc492)
-- All columns nullable: existing rows are free-tier orgs with no billing.
-- `plan` remains the single entitlement source; billing columns make the
-- billing→plan sync observable and idempotent.

ALTER TABLE "Organization" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "stripeSubscriptionId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "stripeSubscriptionStatus" TEXT;
ALTER TABLE "Organization" ADD COLUMN "planUpdatedAt" TIMESTAMP(3);
