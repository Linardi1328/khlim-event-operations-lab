-- Composite cascades can visit pools before draw/source rows. Check these internal
-- references at commit, after the complete event deletion; individual deletion still fails.
ALTER TABLE "DrawEntry" ALTER CONSTRAINT "DrawEntry_entryId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "DrawEntry" ALTER CONSTRAINT "DrawEntry_poolId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "FixtureSource" ALTER CONSTRAINT "FixtureSource_sourceFixtureId_eventId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "FixtureSource" ALTER CONSTRAINT "FixtureSource_poolId_eventId_fkey" DEFERRABLE INITIALLY DEFERRED;
