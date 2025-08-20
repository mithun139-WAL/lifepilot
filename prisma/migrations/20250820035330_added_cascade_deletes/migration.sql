/*
  Warnings:

  - You are about to drop the column `habits` on the `LearningPlan` table. All the data in the column will be lost.
  - Added the required column `learningPlanId` to the `Habit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `goalId` to the `LearningPlan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `habits_list` to the `LearningPlan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `learningPlanId` to the `Planner` table without a default value. This is not possible if the table is not empty.
  - Added the required column `learningPlanId` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Chat" DROP CONSTRAINT "Chat_userId_fkey";

-- DropForeignKey
ALTER TABLE "Habit" DROP CONSTRAINT "Habit_goalId_fkey";

-- DropForeignKey
ALTER TABLE "LearningPlan" DROP CONSTRAINT "LearningPlan_userId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_chatId_fkey";

-- AlterTable
ALTER TABLE "Habit" ADD COLUMN     "learningPlanId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "LearningPlan" DROP COLUMN "habits",
ADD COLUMN     "goalId" TEXT NOT NULL,
ADD COLUMN     "habits_list" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "Planner" ADD COLUMN     "learningPlanId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "learningPlanId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Planner" ADD CONSTRAINT "Planner_learningPlanId_fkey" FOREIGN KEY ("learningPlanId") REFERENCES "LearningPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_learningPlanId_fkey" FOREIGN KEY ("learningPlanId") REFERENCES "LearningPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_learningPlanId_fkey" FOREIGN KEY ("learningPlanId") REFERENCES "LearningPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPlan" ADD CONSTRAINT "LearningPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPlan" ADD CONSTRAINT "LearningPlan_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
