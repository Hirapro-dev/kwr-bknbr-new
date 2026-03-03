-- Rename showForGeneral -> showForGen
ALTER TABLE "posts" RENAME COLUMN "showForGeneral" TO "showForGen";

-- Rename showForFull -> showForVip
ALTER TABLE "posts" RENAME COLUMN "showForFull" TO "showForVip";

-- Add showForVC column
ALTER TABLE "posts" ADD COLUMN "showForVC" BOOLEAN NOT NULL DEFAULT false;
