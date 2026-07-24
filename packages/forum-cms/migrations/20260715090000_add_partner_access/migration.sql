ALTER TABLE "Member"
ADD COLUMN "partnerUser" INTEGER;

CREATE UNIQUE INDEX "Member_partnerUser_key" ON "Member"("partnerUser");

ALTER TABLE "Member"
ADD CONSTRAINT "Member_partnerUser_fkey"
FOREIGN KEY ("partnerUser") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Event"
ADD COLUMN "creator" INTEGER;

CREATE INDEX "Event_creator_idx" ON "Event"("creator");

ALTER TABLE "Event"
ADD CONSTRAINT "Event_creator_fkey"
FOREIGN KEY ("creator") REFERENCES "Member"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
