-- Reliability hardening: leases, bounded retries and dead-letter support for
-- the transactional outbox, webhook deliveries and automation runs.
--
-- All added columns are nullable or carry a default, so this migration applies
-- cleanly to a populated database without rewriting existing rows.

-- AlterTable: automation_run
ALTER TABLE "automation_run"
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "lockedAt" TIMESTAMP(3),
  ADD COLUMN "lockedBy" TEXT;

-- AlterTable: webhook_delivery
ALTER TABLE "webhook_delivery"
  ADD COLUMN "eventId" TEXT,
  ADD COLUMN "lockedAt" TIMESTAMP(3),
  ADD COLUMN "lockedBy" TEXT;

-- AlterTable: outbox_event
ALTER TABLE "outbox_event"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastError" TEXT,
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "lockedAt" TIMESTAMP(3),
  ADD COLUMN "lockedBy" TEXT;

-- Backfill: events processed before this migration keep their terminal state.
UPDATE "outbox_event" SET "status" = 'PROCESSED' WHERE "processedAt" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "webhook_delivery_endpointId_eventId_key" ON "webhook_delivery"("endpointId", "eventId");

-- CreateIndex
CREATE INDEX "automation_run_status_nextAttemptAt_idx" ON "automation_run"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "outbox_event_status_nextAttemptAt_idx" ON "outbox_event"("status", "nextAttemptAt");
