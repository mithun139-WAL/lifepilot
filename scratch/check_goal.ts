
import { PrismaClient } from './src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const goalId = 'cmosiqpx00001vpap2amavw0r';
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
  });
  console.log('Goal:', JSON.stringify(goal, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
