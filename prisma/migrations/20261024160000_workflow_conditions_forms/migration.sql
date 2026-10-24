-- CreateEnum
CREATE TYPE "StepKind" AS ENUM ('TASK', 'APPROVAL');

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "fields" JSONB,
ADD COLUMN     "formValues" JSONB,
ADD COLUMN     "kind" "StepKind" NOT NULL DEFAULT 'TASK';

-- AlterTable
ALTER TABLE "workflow_step" ADD COLUMN     "condition" JSONB,
ADD COLUMN     "fields" JSONB,
ADD COLUMN     "kind" "StepKind" NOT NULL DEFAULT 'TASK';

