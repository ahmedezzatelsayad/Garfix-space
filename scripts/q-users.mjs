import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
try {
  const users = await p.appUser.findMany({ select: { email: true, role: true }, take: 5 });
  console.log(JSON.stringify(users, null, 1));
} catch (e) {
  console.error('ERR:', e.message.slice(0, 300));
}
await p.$disconnect();
