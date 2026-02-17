import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: "file:./prisma/landlord.db",
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("delegates:", {
    account: typeof prisma.account,
    accountMember: typeof prisma.accountMember,
    user: typeof prisma.user,
  });

  const account = await prisma.account.upsert({

    where: { name: "Primary Account" },
    update: {},
    create: { name: "Primary Account" },
  });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
  });

  for (const [index, user] of users.entries()) {
    await prisma.accountMember.upsert({
      where: {
        accountId_userId: {
          accountId: account.id,
          userId: user.id,
        },
      },
      update: {
        role: index === 0 ? "owner" : "member",
      },
      create: {
        accountId: account.id,
        userId: user.id,
        role: index === 0 ? "owner" : "member",
      },
    });
  }

  const updatedProperties = await prisma.property.updateMany({
    where: { accountId: null },
    data: { accountId: account.id },
  });

  console.log(`Backfill complete for account ${account.id}`);
  console.log(`Users processed: ${users.length}`);
  console.log(`Properties assigned: ${updatedProperties.count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
