-- AlterTable
ALTER TABLE "task" ADD COLUMN     "blockedByTaskId" TEXT,
ADD COLUMN     "observerIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_blockedByTaskId_fkey" FOREIGN KEY ("blockedByTaskId") REFERENCES "task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

