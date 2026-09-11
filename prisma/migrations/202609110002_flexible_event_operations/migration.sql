-- CreateEnum
CREATE TYPE "DrawStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "ResultKind" AS ENUM ('PLAYED', 'WALKOVER');

-- CreateEnum
CREATE TYPE "FixtureStatus" AS ENUM ('SCHEDULED', 'DELAYED', 'READY', 'IN_PROGRESS', 'COMPLETED', 'WALKOVER', 'REPLAY_REQUIRED');

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('QUALIFIER', 'WINNER', 'LOSER', 'POOL_RANK');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PROPOSED', 'APPLIED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Stage" ADD VALUE 'PLAY_IN';
ALTER TYPE "Stage" ADD VALUE 'ROUND32';
ALTER TYPE "Stage" ADD VALUE 'ROUND16';
ALTER TYPE "Stage" ADD VALUE 'QUARTERFINAL';

-- DropIndex
DROP INDEX "ImportRow_batchId_line_key";

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "automaticQualifiers" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "courtCount" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "expectedTeams" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "formatVersion" TEXT NOT NULL DEFAULT 'KHLIM_3X3_V2',
ADD COLUMN     "knockoutSize" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "maxTeams" INTEGER NOT NULL DEFAULT 128,
ADD COLUMN     "plannedStart" TEXT NOT NULL DEFAULT '09:00',
ADD COLUMN     "poolCount" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "restMinutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "scheduleRevision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "slotMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "standingsVersion" TEXT NOT NULL DEFAULT 'FIBA_INSPIRED_V2',
ADD COLUMN     "thirdPlace" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
ADD COLUMN     "turnaroundMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "wildcardCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TeamEntry" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "seedScore" INTEGER,
ADD COLUMN     "seedingVersion" TEXT,
ALTER COLUMN "poolId" DROP NOT NULL,
ALTER COLUMN "seed" DROP NOT NULL;

-- AlterTable
ALTER TABLE "RosterEntry" ADD COLUMN     "fibaPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pointsProvenance" TEXT NOT NULL DEFAULT 'Unranked; lab default';

-- AlterTable
ALTER TABLE "Fixture" ADD COLUMN     "actualEnd" TIMESTAMP(3),
ADD COLUMN     "actualStart" TIMESTAMP(3),
ADD COLUMN     "projectedStartsAt" TIMESTAMP(3),
ADD COLUMN     "round" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "FixtureStatus" NOT NULL DEFAULT 'SCHEDULED';

-- AlterTable
ALTER TABLE "GameResult" ADD COLUMN     "kind" "ResultKind" NOT NULL DEFAULT 'PLAYED';

-- AlterTable
ALTER TABLE "ImportBatch" ADD COLUMN     "layout" TEXT NOT NULL DEFAULT 'long',
ADD COLUMN     "sourceHash" TEXT NOT NULL DEFAULT 'legacy-unavailable';

-- AlterTable
ALTER TABLE "ImportRow" ADD COLUMN     "fibaPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "playerColumn" TEXT NOT NULL DEFAULT 'player',
ADD COLUMN     "pointsColumn" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "pool" SET DEFAULT '',
ALTER COLUMN "seed" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "Draw" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "DrawStatus" NOT NULL DEFAULT 'ACTIVE',
    "algorithmVersion" TEXT NOT NULL,
    "seedingVersion" TEXT NOT NULL,
    "rngSeed" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Draw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawEntry" (
    "id" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "inputOrder" INTEGER NOT NULL,
    "seedScore" INTEGER NOT NULL,
    "eventSeed" INTEGER NOT NULL,
    "tieBreak" INTEGER NOT NULL,
    "pot" INTEGER NOT NULL,
    "poolId" TEXT NOT NULL,

    CONSTRAINT "DrawEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawPlayer" (
    "id" TEXT NOT NULL,
    "drawEntryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "provenance" TEXT NOT NULL,

    CONSTRAINT "DrawPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixtureSource" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "kind" "SourceKind" NOT NULL,
    "qualifierRank" INTEGER,
    "sourceFixtureId" TEXT,
    "poolId" TEXT,
    "poolRank" INTEGER,

    CONSTRAINT "FixtureSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixtureTiming" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixtureTiming_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryProposal" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "baseRevision" INTEGER NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "court" TEXT,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PROPOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "RecoveryProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryItem" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "previous" TIMESTAMP(3) NOT NULL,
    "proposed" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportMapping" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "column" TEXT NOT NULL,

    CONSTRAINT "ImportMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Draw_eventId_version_key" ON "Draw"("eventId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "DrawEntry_drawId_entryId_key" ON "DrawEntry"("drawId", "entryId");

-- CreateIndex
CREATE UNIQUE INDEX "DrawEntry_drawId_eventSeed_key" ON "DrawEntry"("drawId", "eventSeed");

-- CreateIndex
CREATE UNIQUE INDEX "FixtureSource_fixtureId_side_key" ON "FixtureSource"("fixtureId", "side");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryItem_proposalId_fixtureId_key" ON "RecoveryItem"("proposalId", "fixtureId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportMapping_batchId_field_key" ON "ImportMapping"("batchId", "field");

-- CreateIndex
CREATE UNIQUE INDEX "Fixture_id_eventId_key" ON "Fixture"("id", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportRow_batchId_line_slot_key" ON "ImportRow"("batchId", "line", "slot");

-- AddForeignKey
ALTER TABLE "Draw" ADD CONSTRAINT "Draw_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draw" ADD CONSTRAINT "Draw_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawEntry" ADD CONSTRAINT "DrawEntry_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "Draw"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawEntry" ADD CONSTRAINT "DrawEntry_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "TeamEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawEntry" ADD CONSTRAINT "DrawEntry_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawPlayer" ADD CONSTRAINT "DrawPlayer_drawEntryId_fkey" FOREIGN KEY ("drawEntryId") REFERENCES "DrawEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureSource" ADD CONSTRAINT "FixtureSource_fixtureId_eventId_fkey" FOREIGN KEY ("fixtureId", "eventId") REFERENCES "Fixture"("id", "eventId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureSource" ADD CONSTRAINT "FixtureSource_sourceFixtureId_eventId_fkey" FOREIGN KEY ("sourceFixtureId", "eventId") REFERENCES "Fixture"("id", "eventId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureSource" ADD CONSTRAINT "FixtureSource_poolId_eventId_fkey" FOREIGN KEY ("poolId", "eventId") REFERENCES "Pool"("id", "eventId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureTiming" ADD CONSTRAINT "FixtureTiming_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureTiming" ADD CONSTRAINT "FixtureTiming_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryProposal" ADD CONSTRAINT "RecoveryProposal_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryProposal" ADD CONSTRAINT "RecoveryProposal_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryItem" ADD CONSTRAINT "RecoveryItem_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "RecoveryProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryItem" ADD CONSTRAINT "RecoveryItem_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportMapping" ADD CONSTRAINT "ImportMapping_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Preserve existing schedules, outcomes and their governing policy; never silently redraw history.
UPDATE "Fixture" SET "projectedStartsAt" = "startsAt", "round" = CASE WHEN stage = 'SEMIFINAL' THEN 2 WHEN stage IN ('FINAL','THIRD') THEN 1 ELSE 0 END;
ALTER TABLE "Fixture" ALTER COLUMN "projectedStartsAt" SET NOT NULL;
UPDATE "Fixture" f SET status = 'COMPLETED' WHERE EXISTS (SELECT 1 FROM "GameResult" r WHERE r."fixtureId" = f.id AND r.status = 'CONFIRMED');
UPDATE "Event" SET "formatVersion" = 'LEGACY_V1', "standingsVersion" = 'LEGACY_V1', "restMinutes" = 0;
UPDATE "TeamEntry" SET "seedingVersion" = 'LEGACY_MANUAL_V1';
ALTER TABLE "TeamEntry" DROP CONSTRAINT "valid_seed";
ALTER TABLE "TeamEntry" ADD CONSTRAINT "valid_seed" CHECK (seed IS NULL OR seed BETWEEN 1 AND 128);
ALTER TABLE "EventPlacement" DROP CONSTRAINT "valid_place";
ALTER TABLE "EventPlacement" ADD CONSTRAINT "valid_place" CHECK (place BETWEEN 1 AND 128);
ALTER TABLE "RosterEntry" ADD CONSTRAINT "valid_fiba_points" CHECK ("fibaPoints" BETWEEN 0 AND 100000000);
ALTER TABLE "GameResult" ADD CONSTRAINT "valid_walkover" CHECK (kind <> 'WALKOVER' OR ("homeScore"=21 AND "awayScore"=0) OR ("homeScore"=0 AND "awayScore"=21));
CREATE UNIQUE INDEX "one_active_draw" ON "Draw" ("eventId") WHERE status = 'ACTIVE';
ALTER TABLE "FixtureSource" ADD CONSTRAINT "valid_source" CHECK (
  side IN ('HOME','AWAY') AND (
    (kind='QUALIFIER' AND "qualifierRank" BETWEEN 1 AND 32 AND "sourceFixtureId" IS NULL AND "poolId" IS NULL AND "poolRank" IS NULL)
    OR (kind IN ('WINNER','LOSER') AND "sourceFixtureId" IS NOT NULL AND "sourceFixtureId"<>"fixtureId" AND "qualifierRank" IS NULL AND "poolId" IS NULL AND "poolRank" IS NULL)
    OR (kind='POOL_RANK' AND "poolId" IS NOT NULL AND "poolRank">0 AND "sourceFixtureId" IS NULL AND "qualifierRank" IS NULL)
  ));
ALTER TABLE "Fixture" ADD CONSTRAINT "valid_actual_times" CHECK ("actualEnd" IS NULL OR ("actualStart" IS NOT NULL AND "actualEnd">="actualStart"));
ALTER TABLE "Event" ADD CONSTRAINT "valid_format_bounds" CHECK ("courtCount" BETWEEN 1 AND 16 AND "poolCount" BETWEEN 1 AND 16 AND "maxTeams" BETWEEN 4 AND 128 AND "expectedTeams" BETWEEN 4 AND "maxTeams" AND "knockoutSize" BETWEEN 2 AND 32 AND "slotMinutes" BETWEEN 5 AND 60 AND "restMinutes" BETWEEN 0 AND 120 AND "turnaroundMinutes" BETWEEN 0 AND 30 AND "automaticQualifiers">0 AND "wildcardCount">=0 AND "automaticQualifiers"*"poolCount"+"wildcardCount"="knockoutSize");
-- Turn old source labels into typed edges without changing any participant/result record.
INSERT INTO "FixtureSource" (id,"eventId","fixtureId",side,kind,"poolId","poolRank")
SELECT md5(f.id||s.side), f."eventId", f.id, s.side, 'POOL_RANK', p.id,
 CASE WHEN (f.code='SF-1' AND s.side='HOME') OR (f.code='SF-2' AND s.side='HOME') THEN 1 ELSE 2 END
FROM "Fixture" f CROSS JOIN (VALUES ('HOME'),('AWAY')) s(side)
JOIN "Pool" p ON p."eventId"=f."eventId" AND p.name=CASE WHEN (f.code='SF-1' AND s.side='HOME') OR (f.code='SF-2' AND s.side='AWAY') THEN 'A' ELSE 'B' END
WHERE f.code IN ('SF-1','SF-2');
INSERT INTO "FixtureSource" (id,"eventId","fixtureId",side,kind,"sourceFixtureId")
SELECT md5(f.id||s.side), f."eventId", f.id, s.side, CASE WHEN f.code='FINAL' THEN 'WINNER'::"SourceKind" ELSE 'LOSER'::"SourceKind" END, parent.id
FROM "Fixture" f CROSS JOIN (VALUES ('HOME'),('AWAY')) s(side)
JOIN "Fixture" parent ON parent."eventId"=f."eventId" AND parent.code=CASE WHEN s.side='HOME' THEN 'SF-1' ELSE 'SF-2' END WHERE f.code IN ('FINAL','THIRD');
