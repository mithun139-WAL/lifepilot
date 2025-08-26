-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "preferredTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_DATE + interval '10 hours';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "preferredTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_DATE + interval '10 hours';
