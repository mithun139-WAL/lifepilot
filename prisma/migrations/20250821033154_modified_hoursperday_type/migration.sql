-- AlterTable
ALTER TABLE "Goal" ALTER COLUMN "hoursPerDay" SET DATA TYPE TEXT,
ALTER COLUMN "preferredTime" SET DEFAULT CURRENT_DATE + interval '10 hours';

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "preferredTime" SET DEFAULT CURRENT_DATE + interval '10 hours';
