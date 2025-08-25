-- AlterTable
ALTER TABLE "Goal" ALTER COLUMN "preferredTime" SET DEFAULT CURRENT_DATE + interval '10 hours';

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "preferredTime" SET DEFAULT CURRENT_DATE + interval '10 hours';

-- CreateTable
CREATE TABLE "Mood" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mood" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mood_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Mood" ADD CONSTRAINT "Mood_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
