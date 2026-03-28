-- Ad.image 關聯至 Image(id)；僅在 Ad 端選圖，圖片 list 不新增反向欄位
ALTER TABLE "Ad" DROP COLUMN IF EXISTS "imageUrl";

ALTER TABLE "Ad" ADD COLUMN IF NOT EXISTS "image" INTEGER;

CREATE INDEX IF NOT EXISTS "Ad_image_idx" ON "Ad"("image");

ALTER TABLE "Ad" DROP CONSTRAINT IF EXISTS "Ad_image_fkey";

ALTER TABLE "Ad" ADD CONSTRAINT "Ad_image_fkey" FOREIGN KEY ("image") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;
