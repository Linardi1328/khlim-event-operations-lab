-- NO ACTION checks after a statement, allowing an entire event's cascades to finish.
-- Deleting a referenced individual pool, entry or source game remains prohibited.
ALTER TABLE "DrawEntry" DROP CONSTRAINT "DrawEntry_entryId_fkey";
ALTER TABLE "DrawEntry" ADD CONSTRAINT "DrawEntry_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "TeamEntry"(id) ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "DrawEntry" DROP CONSTRAINT "DrawEntry_poolId_fkey";
ALTER TABLE "DrawEntry" ADD CONSTRAINT "DrawEntry_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"(id) ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "FixtureSource" DROP CONSTRAINT "FixtureSource_sourceFixtureId_eventId_fkey";
ALTER TABLE "FixtureSource" ADD CONSTRAINT "FixtureSource_sourceFixtureId_eventId_fkey" FOREIGN KEY ("sourceFixtureId","eventId") REFERENCES "Fixture"(id,"eventId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "FixtureSource" DROP CONSTRAINT "FixtureSource_poolId_eventId_fkey";
ALTER TABLE "FixtureSource" ADD CONSTRAINT "FixtureSource_poolId_eventId_fkey" FOREIGN KEY ("poolId","eventId") REFERENCES "Pool"(id,"eventId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "FixtureSource" DROP CONSTRAINT "valid_source";
ALTER TABLE "FixtureSource" ADD CONSTRAINT "valid_source" CHECK (side IN ('HOME','AWAY') AND (
 (kind='QUALIFIER' AND "qualifierRank" IS NOT NULL AND "qualifierRank" BETWEEN 1 AND 32 AND "sourceFixtureId" IS NULL AND "poolId" IS NULL AND "poolRank" IS NULL)
 OR (kind IN ('WINNER','LOSER') AND "sourceFixtureId" IS NOT NULL AND "sourceFixtureId"<>"fixtureId" AND "qualifierRank" IS NULL AND "poolId" IS NULL AND "poolRank" IS NULL)
 OR (kind='POOL_RANK' AND "poolId" IS NOT NULL AND "poolRank" IS NOT NULL AND "poolRank">0 AND "sourceFixtureId" IS NULL AND "qualifierRank" IS NULL)
));
