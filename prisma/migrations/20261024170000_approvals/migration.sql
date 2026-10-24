-- CreateEnum
CREATE TYPE "ApprovalMode" AS ENUM ('ANY', 'ALL');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'DECIDED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'APPROVAL_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'APPROVAL_DECIDED';

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "decision" "ApprovalDecision",
ADD COLUMN     "decisionNote" TEXT;

-- AlterTable
ALTER TABLE "workflow_step" ADD COLUMN     "approvalMode" "ApprovalMode";

-- CreateTable
CREATE TABLE "task_decision" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_decision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_decision_taskId_idx" ON "task_decision"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "task_decision_taskId_userId_key" ON "task_decision"("taskId", "userId");

-- AddForeignKey
ALTER TABLE "task_decision" ADD CONSTRAINT "task_decision_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_decision" ADD CONSTRAINT "task_decision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

