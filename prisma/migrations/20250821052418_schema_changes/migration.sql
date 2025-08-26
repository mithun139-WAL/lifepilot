/*
  Warnings:

  - You are about to drop the column `learningPlanId` on the `Goal` table. All the data in the column will be lost.
  - You are about to drop the column `goalId` on the `Habit` table. All the data in the column will be lost.
  - You are about to drop the column `goalId` on the `Planner` table. All the data in the column will be lost.
  - You are about to drop the column `roadmap` on the `Planner` table. All the data in the column will be lost.
  - You are about to drop the column `learningPlanId` on the `Task` table. All the data in the column will be lost.
  - Added the required column `week` to the `Planner` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Habit" DROP CONSTRAINT "Habit_goalId_fkey";

-- DropForeignKey
ALTER TABLE "Planner" DROP CONSTRAINT "Planner_goalId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_learningPlanId_fkey";

-- DropIndex
DROP INDEX "Goal_learningPlanId_key";

-- DropIndex
DROP INDEX "Planner_goalId_idx";

-- AlterTable
ALTER TABLE "Goal" DROP COLUMN "learningPlanId",
ALTER COLUMN "preferredTime" SET DEFAULT CURRENT_DATE + interval '10 hours';

-- AlterTable
ALTER TABLE "Habit" DROP COLUMN "goalId";

-- AlterTable
ALTER TABLE "Planner" DROP COLUMN "goalId",
DROP COLUMN "roadmap",
ADD COLUMN     "week" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "learningPlanId",
ALTER COLUMN "preferredTime" SET DEFAULT CURRENT_DATE + interval '10 hours';
