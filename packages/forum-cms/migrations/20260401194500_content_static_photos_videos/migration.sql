-- 靜態頁面 Content 與 Image／Video 隱式多對多
CREATE TABLE "_Content_photos" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

CREATE UNIQUE INDEX "_Content_photos_AB_unique" ON "_Content_photos"("A", "B");
CREATE INDEX "_Content_photos_B_index" ON "_Content_photos"("B");

ALTER TABLE "_Content_photos" ADD CONSTRAINT "_Content_photos_A_fkey" FOREIGN KEY ("A") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_Content_photos" ADD CONSTRAINT "_Content_photos_B_fkey" FOREIGN KEY ("B") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "_Content_videos" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

CREATE UNIQUE INDEX "_Content_videos_AB_unique" ON "_Content_videos"("A", "B");
CREATE INDEX "_Content_videos_B_index" ON "_Content_videos"("B");

ALTER TABLE "_Content_videos" ADD CONSTRAINT "_Content_videos_A_fkey" FOREIGN KEY ("A") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_Content_videos" ADD CONSTRAINT "_Content_videos_B_fkey" FOREIGN KEY ("B") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
