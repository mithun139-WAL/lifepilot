/*
  Warnings:

  - You are about to drop the column `plannerId` on the `Habit` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Habit" DROP CONSTRAINT "Habit_plannerId_fkey";

-- AlterTable
ALTER TABLE "Goal" ALTER COLUMN "preferredTime" SET DEFAULT CURRENT_DATE + interval '10 hours';

-- AlterTable
ALTER TABLE "Habit" DROP COLUMN "plannerId";

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "preferredTime" SET DEFAULT CURRENT_DATE + interval '10 hours';
