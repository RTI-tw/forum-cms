-- CreateEnum
CREATE TYPE "EventStatusType" AS ENUM ('draft', 'published', 'closed', 'cancelled');

-- CreateEnum
CREATE TYPE "EventRegistrationStatusType" AS ENUM ('registered', 'checkedIn', 'cancelled');

-- CreateEnum
CREATE TYPE "EventRegistrationIdentityTypeType" AS ENUM ('national_id', 'resident_certificate');

-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "status" "EventStatusType" NOT NULL DEFAULT 'draft',
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "registrationStartAt" TIMESTAMP(3),
    "registrationEndAt" TIMESTAMP(3),
    "checkInStartAt" TIMESTAMP(3),
    "checkInEndAt" TIMESTAMP(3),
    "capacity" INTEGER,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRegistration" (
    "id" SERIAL NOT NULL,
    "event" INTEGER,
    "member" INTEGER,
    "status" "EventRegistrationStatusType" NOT NULL DEFAULT 'registered',
    "registeredAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "checkedInAt" TIMESTAMP(3),
    "checkedInBy" INTEGER,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" INTEGER,
    "identityType" "EventRegistrationIdentityTypeType",
    "identityMasked" TEXT,
    "identityHash" TEXT,
    "phoneMasked" TEXT,
    "phoneHash" TEXT,
    "lastQrTokenHash" TEXT,
    "lastQrTokenIssuedAt" TIMESTAMP(3),
    "lastQrTokenUsedAt" TIMESTAMP(3),
    "checkInNotes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "EventRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Event_createdBy_idx" ON "Event"("createdBy");

-- CreateIndex
CREATE INDEX "Event_updatedBy_idx" ON "Event"("updatedBy");

-- CreateIndex
CREATE INDEX "EventRegistration_event_idx" ON "EventRegistration"("event");

-- CreateIndex
CREATE INDEX "EventRegistration_member_idx" ON "EventRegistration"("member");

-- CreateIndex
CREATE INDEX "EventRegistration_checkedInBy_idx" ON "EventRegistration"("checkedInBy");

-- CreateIndex
CREATE INDEX "EventRegistration_cancelledBy_idx" ON "EventRegistration"("cancelledBy");

-- CreateIndex
CREATE INDEX "EventRegistration_identityHash_idx" ON "EventRegistration"("identityHash");

-- CreateIndex
CREATE INDEX "EventRegistration_phoneHash_idx" ON "EventRegistration"("phoneHash");

-- CreateIndex
CREATE INDEX "EventRegistration_lastQrTokenHash_idx" ON "EventRegistration"("lastQrTokenHash");

-- CreateIndex
CREATE INDEX "EventRegistration_createdBy_idx" ON "EventRegistration"("createdBy");

-- CreateIndex
CREATE INDEX "EventRegistration_updatedBy_idx" ON "EventRegistration"("updatedBy");

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_event_member_key" ON "EventRegistration"("event", "member");

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_event_identityHash_key" ON "EventRegistration"("event", "identityHash");

-- CreateIndex
CREATE INDEX "EventRegistration_event_status_idx" ON "EventRegistration"("event", "status");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_event_fkey" FOREIGN KEY ("event") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_member_fkey" FOREIGN KEY ("member") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_checkedInBy_fkey" FOREIGN KEY ("checkedInBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_cancelledBy_fkey" FOREIGN KEY ("cancelledBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
