/*
  Warnings:

  - You are about to drop the column `targetDays` on the `Goal` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[learningPlanId]` on the table `Goal` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[goalId]` on the table `LearningPlan` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `targetWeeks` to the `Goal` table without a default value. This is not possible if the table is not empty.
  - Made the column `goalId` on table `Habit` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Habit" DROP CONSTRAINT "Habit_plannerId_fkey";

-- DropIndex
DROP INDEX "Habit_plannerId_idx";

-- AlterTable
ALTER TABLE "Goal" DROP COLUMN "targetDays",
ADD COLUMN     "learningPlanId" TEXT,
ADD COLUMN     "targetWeeks" INTEGER NOT NULL,
ALTER COLUMN "preferredTime" SET DEFAULT CURRENT_DATE + interval '10 hours';

-- AlterTable
ALTER TABLE "Habit" ALTER COLUMN "goalId" SET NOT NULL,
ALTER COLUMN "plannerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "preferredTime" SET DEFAULT CURRENT_DATE + interval '10 hours';

-- CreateTable
CREATE TABLE "Checklist" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "expectedTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Checklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Checklist_taskId_idx" ON "Checklist"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "Goal_learningPlanId_key" ON "Goal"("learningPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPlan_goalId_key" ON "LearningPlan"("goalId");

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_plannerId_fkey" FOREIGN KEY ("plannerId") REFERENCES "Planner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
