-- CreateTable
CREATE TABLE "automation_rule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trigger" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "config" JSONB,
    "createdById" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_run" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automation_rule_organizationId_enabled_idx" ON "automation_rule"("organizationId", "enabled");

-- CreateIndex
CREATE INDEX "automation_run_ruleId_createdAt_idx" ON "automation_run"("ruleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "automation_run_ruleId_eventId_key" ON "automation_run"("ruleId", "eventId");

-- AddForeignKey
ALTER TABLE "automation_rule" ADD CONSTRAINT "automation_rule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rule" ADD CONSTRAINT "automation_rule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_run" ADD CONSTRAINT "automation_run_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "automation_rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

