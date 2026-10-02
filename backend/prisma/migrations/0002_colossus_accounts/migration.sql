-- AddValue: MANAGER role
ALTER TYPE "UserRole" ADD VALUE 'MANAGER';

-- AlterTable: rename password column on User to match new passwordHash field
ALTER TABLE "User" RENAME COLUMN "password" TO "passwordHash";

-- CreateTable: colossus_accounts
CREATE TABLE "colossus_accounts" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "login_path" TEXT,
    "created_by" TEXT NOT NULL DEFAULT 'colossus',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colossus_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "colossus_accounts_email_key" ON "colossus_accounts"("email");
