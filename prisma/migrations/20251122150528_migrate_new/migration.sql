-- AlterTable
ALTER TABLE "Goal" ALTER COLUMN "preferredTime" SET DEFAULT CURRENT_DATE + interval '10 hours';

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "preferredTime" SET DEFAULT CURRENT_DATE + interval '10 hours';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deadline" TIMESTAMP(3),
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pace" TEXT,
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "preferredFormats" JSONB,
ADD COLUMN     "skillLevel" TEXT,
ADD COLUMN     "weeklyHours" INTEGER;
