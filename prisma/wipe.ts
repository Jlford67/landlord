import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: "file:./prisma/landlord.db",
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // Delete children first (FK order)
  await prisma.notification.deleteMany();
  await prisma.notificationRule.deleteMany();

  await prisma.recurringPosting.deleteMany();
  await prisma.recurringTransaction.deleteMany();

  await prisma.transaction.deleteMany();

  await prisma.leaseTenant.deleteMany();
  await prisma.lease.deleteMany();
  await prisma.tenant.deleteMany();

  await prisma.insurancePolicy.deleteMany();
  await prisma.propertyTaxAccount.deleteMany();

  await prisma.loanSnapshot.deleteMany();
  await prisma.loan.deleteMany();

  await prisma.propertyManagerAssignment.deleteMany();
  await prisma.propertyManager.deleteMany();

  await prisma.propertyOwnership.deleteMany();
  await prisma.property.deleteMany();

  await prisma.category.deleteMany();
  await prisma.entity.deleteMany();

  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  console.log("All data wiped.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
