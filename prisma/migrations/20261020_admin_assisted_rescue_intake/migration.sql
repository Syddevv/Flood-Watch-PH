-- Additive: legacy public and admin-assisted requests retain their existing values.
ALTER TABLE "RescueRequest" ADD COLUMN "assistedIntakeMethod" TEXT;
ALTER TABLE "RescueRequest" ADD CONSTRAINT "RescueRequest_assistedIntakeMethod_chk"
  CHECK ("assistedIntakeMethod" IS NULL OR "assistedIntakeMethod" IN ('phone', 'walk_in', 'other'));
