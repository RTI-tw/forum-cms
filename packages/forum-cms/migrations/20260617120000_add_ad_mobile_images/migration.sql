ALTER TABLE "Ad" ADD COLUMN IF NOT EXISTS "mobileImage" INTEGER;
ALTER TABLE "AdSlide" ADD COLUMN IF NOT EXISTS "mobileImage" INTEGER;

CREATE INDEX IF NOT EXISTS "Ad_mobileImage_idx" ON "Ad"("mobileImage");
CREATE INDEX IF NOT EXISTS "AdSlide_mobileImage_idx" ON "AdSlide"("mobileImage");

ALTER TABLE "Ad" DROP CONSTRAINT IF EXISTS "Ad_mobileImage_fkey";
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_mobileImage_fkey" FOREIGN KEY ("mobileImage") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdSlide" DROP CONSTRAINT IF EXISTS "AdSlide_mobileImage_fkey";
ALTER TABLE "AdSlide" ADD CONSTRAINT "AdSlide_mobileImage_fkey" FOREIGN KEY ("mobileImage") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;
