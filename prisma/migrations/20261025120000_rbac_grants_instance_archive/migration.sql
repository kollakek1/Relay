-- Additive per-membership permission grants (on top of the role baseline).
ALTER TABLE "membership" ADD COLUMN "grantedPermissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Reversible soft-delete/archive for finished process instances.
ALTER TABLE "process_instance" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "process_instance" ADD COLUMN "archivedById" TEXT;

CREATE INDEX "process_instance_organizationId_archivedAt_idx" ON "process_instance"("organizationId", "archivedAt");

ALTER TABLE "process_instance" ADD CONSTRAINT "process_instance_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
