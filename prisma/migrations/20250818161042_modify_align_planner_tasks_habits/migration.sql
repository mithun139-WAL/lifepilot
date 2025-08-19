/*
  Warnings:

  - You are about to drop the column `title` on the `Habit` table. All the data in the column will be lost.
  - The `frequency` column on the `Habit` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `completed` on the `Task` table. All the data in the column will be lost.
  - Added the required column `name` to the `Habit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `plannerId` to the `Habit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Habit` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "HabitFrequency" AS ENUM ('DAILY', 'WEEKLY');

-- DropForeignKey
ALTER TABLE "Habit" DROP CONSTRAINT "Habit_goalId_fkey";

-- DropIndex
DROP INDEX "Habit_goalId_idx";

-- DropIndex
DROP INDEX "Task_dueDate_idx";

-- DropIndex
DROP INDEX "Task_userId_createdAt_idx";

-- AlterTable
ALTER TABLE "Habit" DROP COLUMN "title",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "plannerId" TEXT NOT NULL,
ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "userId" TEXT NOT NULL,
ALTER COLUMN "goalId" DROP NOT NULL,
DROP COLUMN "frequency",
ADD COLUMN     "frequency" "HabitFrequency" NOT NULL DEFAULT 'DAILY';

-- AlterTable
ALTER TABLE "Planner" ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "completed",
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "status" "TaskStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "Habit_plannerId_idx" ON "Habit"("plannerId");

-- CreateIndex
CREATE INDEX "Habit_userId_idx" ON "Habit"("userId");

-- CreateIndex
CREATE INDEX "Planner_startDate_endDate_idx" ON "Planner"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Task_userId_idx" ON "Task"("userId");

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_plannerId_fkey" FOREIGN KEY ("plannerId") REFERENCES "Planner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
