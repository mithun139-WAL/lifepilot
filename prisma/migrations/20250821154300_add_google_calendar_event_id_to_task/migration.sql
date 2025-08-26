-- AlterTable
ALTER TABLE "Goal" ALTER COLUMN "preferredTime" SET DEFAULT CURRENT_DATE + interval '10 hours';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "googleCalendarEventId" TEXT,
ALTER COLUMN "preferredTime" SET DEFAULT CURRENT_DATE + interval '10 hours';
