-- Add onboarding tracking fields to Organization
-- These track whether the setup wizard has been completed and at what step

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "onboardingCompleted"   BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "onboardingStep"        INTEGER   NOT NULL DEFAULT 0;
