-- AlterTable
ALTER TABLE "Goal" ALTER COLUMN "preferredTime" SET DEFAULT CURRENT_DATE + interval '10 hours';

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "preferredTime" SET DEFAULT CURRENT_DATE + interval '10 hours';

-- CreateIndex
CREATE INDEX "Chat_userId_idx" ON "Chat"("userId");

-- CreateIndex
CREATE INDEX "LearningPlan_userId_idx" ON "LearningPlan"("userId");

-- CreateIndex
CREATE INDEX "Mood_userId_idx" ON "Mood"("userId");
