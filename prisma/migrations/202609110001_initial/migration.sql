-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EVENT_STAFF');

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('POOL', 'SEMIFINAL', 'THIRD', 'FINAL');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('CONFIRMED', 'SUPERSEDED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PREVIEW', 'COMMITTED');

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EVENT_STAFF',

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "venue" TEXT NOT NULL,
    "overview" TEXT NOT NULL,
    "public" BOOLEAN NOT NULL DEFAULT false,
    "schedulePublished" BOOLEAN NOT NULL DEFAULT false,
    "resultsPublished" BOOLEAN NOT NULL DEFAULT false,
    "placementsConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pool" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Pool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamEntry" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),

    CONSTRAINT "TeamEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterEntry" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "checkedInAt" TIMESTAMP(3),

    CONSTRAINT "RosterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fixture" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "poolId" TEXT,
    "code" TEXT NOT NULL,
    "stage" "Stage" NOT NULL,
    "court" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "homeId" TEXT,
    "awayId" TEXT,
    "homeSource" TEXT NOT NULL,
    "awaySource" TEXT NOT NULL,

    CONSTRAINT "Fixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameResult" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "homeId" TEXT NOT NULL,
    "awayId" TEXT NOT NULL,
    "homeScore" INTEGER NOT NULL,
    "awayScore" INTEGER NOT NULL,
    "status" "ResultStatus" NOT NULL DEFAULT 'CONFIRMED',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staffId" TEXT NOT NULL,

    CONSTRAINT "GameResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultCorrection" (
    "id" TEXT NOT NULL,
    "previousId" TEXT NOT NULL,
    "replacementId" TEXT,
    "reason" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventPlacement" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "place" INTEGER NOT NULL,

    CONSTRAINT "EventPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAnnouncement" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PREVIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMP(3),

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "line" INTEGER NOT NULL,
    "team" TEXT NOT NULL,
    "player" TEXT NOT NULL,
    "pool" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorAction" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperatorAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Staff_username_key" ON "Staff"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Pool_eventId_name_key" ON "Pool"("eventId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Pool_id_eventId_key" ON "Pool"("id", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamEntry_eventId_nameKey_key" ON "TeamEntry"("eventId", "nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "TeamEntry_eventId_seed_key" ON "TeamEntry"("eventId", "seed");

-- CreateIndex
CREATE UNIQUE INDEX "TeamEntry_id_eventId_key" ON "TeamEntry"("id", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterEntry_entryId_nameKey_key" ON "RosterEntry"("entryId", "nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "RosterEntry_entryId_slot_key" ON "RosterEntry"("entryId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "Fixture_eventId_code_key" ON "Fixture"("eventId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Fixture_eventId_court_startsAt_key" ON "Fixture"("eventId", "court", "startsAt");

-- CreateIndex
CREATE INDEX "GameResult_fixtureId_status_idx" ON "GameResult"("fixtureId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EventPlacement_eventId_place_key" ON "EventPlacement"("eventId", "place");

-- CreateIndex
CREATE UNIQUE INDEX "EventPlacement_eventId_entryId_key" ON "EventPlacement"("eventId", "entryId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportRow_batchId_line_key" ON "ImportRow"("batchId", "line");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pool" ADD CONSTRAINT "Pool_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamEntry" ADD CONSTRAINT "TeamEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamEntry" ADD CONSTRAINT "TeamEntry_poolId_eventId_fkey" FOREIGN KEY ("poolId", "eventId") REFERENCES "Pool"("id", "eventId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "TeamEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_poolId_eventId_fkey" FOREIGN KEY ("poolId", "eventId") REFERENCES "Pool"("id", "eventId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_homeId_eventId_fkey" FOREIGN KEY ("homeId", "eventId") REFERENCES "TeamEntry"("id", "eventId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_awayId_eventId_fkey" FOREIGN KEY ("awayId", "eventId") REFERENCES "TeamEntry"("id", "eventId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultCorrection" ADD CONSTRAINT "ResultCorrection_previousId_fkey" FOREIGN KEY ("previousId") REFERENCES "GameResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultCorrection" ADD CONSTRAINT "ResultCorrection_replacementId_fkey" FOREIGN KEY ("replacementId") REFERENCES "GameResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultCorrection" ADD CONSTRAINT "ResultCorrection_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPlacement" ADD CONSTRAINT "EventPlacement_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPlacement" ADD CONSTRAINT "EventPlacement_entryId_eventId_fkey" FOREIGN KEY ("entryId", "eventId") REFERENCES "TeamEntry"("id", "eventId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAnnouncement" ADD CONSTRAINT "EventAnnouncement_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorAction" ADD CONSTRAINT "OperatorAction_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorAction" ADD CONSTRAINT "OperatorAction_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Database guardrails complement command-layer validation.
CREATE UNIQUE INDEX "one_confirmed_result_per_fixture" ON "GameResult" ("fixtureId") WHERE status = 'CONFIRMED';
ALTER TABLE "Fixture" ADD CONSTRAINT "distinct_fixture_teams" CHECK ("homeId" IS NULL OR "awayId" IS NULL OR "homeId" <> "awayId");
ALTER TABLE "GameResult" ADD CONSTRAINT "valid_result" CHECK ("homeId" <> "awayId" AND "homeScore" BETWEEN 0 AND 50 AND "awayScore" BETWEEN 0 AND 50 AND "homeScore" <> "awayScore");
ALTER TABLE "TeamEntry" ADD CONSTRAINT "valid_seed" CHECK (seed BETWEEN 1 AND 8);
ALTER TABLE "RosterEntry" ADD CONSTRAINT "valid_slot" CHECK (slot BETWEEN 1 AND 4);
ALTER TABLE "EventPlacement" ADD CONSTRAINT "valid_place" CHECK (place BETWEEN 1 AND 8);
