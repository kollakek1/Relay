-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'REOPENED';

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "workflow_template" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "steps" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflow_template_organizationId_idx" ON "workflow_template"("organizationId");

-- AddForeignKey
ALTER TABLE "workflow_template" ADD CONSTRAINT "workflow_template_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_template" ADD CONSTRAINT "workflow_template_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

