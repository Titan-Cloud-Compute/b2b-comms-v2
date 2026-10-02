-- Drop tables that are no longer part of the neutral-shell schema.
DROP TABLE IF EXISTS "LlmUsage" CASCADE;
DROP TABLE IF EXISTS "UserLlmModel" CASCADE;
DROP TABLE IF EXISTS "Record" CASCADE;

-- Drop enum that is no longer referenced.
DROP TYPE IF EXISTS "LlmUsageSource";

-- Shrink UserRole: WB_ADMIN → ADMIN, FIRM_USER → USER. Keep ADMIN, MANAGER, USER.
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'MANAGER', 'USER');
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole_new"
  USING (
    CASE
      WHEN "role"::text = 'WB_ADMIN'   THEN 'ADMIN'
      WHEN "role"::text = 'FIRM_USER'  THEN 'USER'
      ELSE "role"::text
    END
  )::"UserRole_new";
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';
