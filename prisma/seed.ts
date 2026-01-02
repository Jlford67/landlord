import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

/**
 * EDIT THESE BEFORE RUNNING SEED
 */
const SEED_USERS = [
  { email: "jlford67@gmail.com", password: "RealEstate-2025", role: "owner" as const },
  { email: "fordimelda@gmail.com", password: "RealEstate-2025", role: "spouse" as const },
];

const SEED_ENTITIES = [
  { name: "Personal", type: "personal" as const },
  { name: "LLC", type: "llc" as const },
];

const SEED_PROPERTIES = [
  {
    nickname: "MO - Duplex",
    street: "1905-1907 S Arrowhead Ct",
    city: "Independence",
    state: "MO",
    zip: "64057",
    doors: 2,
    beds: 6,
    baths: 5,
    sqFt: 2128,
    entityName: "Personal",
    ownershipPct: 100,
  },
  {
    nickname: "MO - SFH",
    street: "801 SW Orchard Court",
    city: "Grain Valley",
    state: "MO",
    zip: "64029",
    doors: 1,
    beds: 3,
    baths: 2,
    sqFt: 1322,
    entityName: "Personal",
    ownershipPct: 100,
  },
  {
    nickname: "TX - Arlington",
    street: "816 Dunkirk Ln",
    city: "Arlington",
    state: "TX",
    zip: "76017",
    doors: 1,
    beds: 3,
    baths: 2,
    sqFt: 1881,
    entityName: "Personal",
    ownershipPct: 100,
  },
  {
    nickname: "SC - Clemson",
    street: "146 F University Village",
    city: "Central",
    state: "SC",
    zip: "29630",
    doors: 1,
    beds: 3,
    baths: 3,
    sqFt: 1190,
    entityName: "Personal",
    ownershipPct: 100,
  },
  {
    nickname: "IL - Urbana",
    street: "3020 E Stillwater Lndg #201",
    city: "Urbana",
    state: "IL",
    zip: "61802",
    doors: 1,
    beds: 2,
    baths: 2,
    sqFt: 1150,
    entityName: "Personal",
    ownershipPct: 100,
  },
  {
    nickname: "MO - Columbia",
    street: "5451 S Bethel Church Rd #4-203",
    city: "Columbia",
    state: "MO",
    zip: "65203",
    doors: 1,
    beds: 3,
    baths: 2,
    sqFt: 1152,
    entityName: "Personal",
    ownershipPct: 100,
  },
  {
    nickname: "TX - Houston",
    street: "12935 Arnage Lane",
    city: "Houston",
    state: "TX",
    zip: "77085",
    doors: 1,
    beds: 3,
    baths: 2,
    sqFt: 1800,
    entityName: "Personal",
    ownershipPct: 100,
  },
  {
    nickname: "SC - Myrtle Beach",
    street: "498 Wallingford Circle",
    city: "Myrtle Beach",
    state: "SC",
    zip: "29588",
    doors: 1,
    beds: 3,
    baths: 2,
    sqFt: 1305,
    entityName: "Personal",
    ownershipPct: 100,
  },
  {
    nickname: "AL - Etowah",
    street: "1033 Etowah St",
    city: "Tarrant",
    state: "AL",
    zip: "35217",
    doors: 1,
    beds: 3,
    baths: 1,
    sqFt: 912,
    entityName: "Personal",
    ownershipPct: 100,
  },
  {
    nickname: "AL - Burgin",
    street: "1556 Burgin Ave",
    city: "Birmingham",
    state: "AL",
    zip: "35208",
    doors: 1,
    beds: 3,
    baths: 1,
    sqFt: 1168,
    entityName: "Personal",
    ownershipPct: 100,
  },
  {
    nickname: "AL - Princeton",
    street: "1827 Princeton Ct SW",
    city: "Birmingham",
    state: "AL",
    zip: "35211",
    doors: 1,
    beds: 5,
    baths: 2,
    sqFt: 2100,
    entityName: "Personal",
    ownershipPct: 100,
  },
  {
    nickname: "PH - Rada",
    street: "Rada Regency, Unit 2109, 100 Rada St, Legaspi Village",
    city: "Makati City",
    state: "PH",
    zip: "00000",
    doors: 1,
    beds: 1,
    baths: 1,
    sqFt: 303,
    entityName: "Personal",
    ownershipPct: 100,
  },
];

// Insurance
const SEED_INSURANCE = [
  {
    propertyNickname: "MO - Duplex",
    propertyAddress: "1905-1907 S Arrowhead Ct., Independence, MO 64057",
    insurer: "Foremost Insurance Group",
    policyNum: "5023370262",
    agentName: "Steadily (Jordan Weinstein)",
    phone: "(913) 398-2536",
    premium: 3525,
    dueExcel: 46366,
    paidExcel: 46001,
    webPortal: "http://steadily.com",
  },
  {
    propertyNickname: "MO - SFH",
    propertyAddress: "801 SW Orchard Court, Grain Valley, MO 64029",
    insurer: "Shelter Insurance",
    policyNum: "24-73-5281114-1",
    agentName: "Steven Taylor",
    phone: "816-224-0355",
    premium: 2361,
    dueExcel: 46348,
    paidExcel: 45985,
    webPortal: "https://shelterinsurance.com",
  },
  {
    propertyNickname: "TX - Arlington",
    propertyAddress: "816 Dunkirk Ln, Arlington, TX 76017",
    insurer: "Safeco Insurance Company",
    policyNum: "Acct: OY8351488",
    agentName: "Lena Shin / Allrisc Insurance Agency",
    phone: "713-777-6000",
    premium: 2873,
    dueExcel: 46181,
    paidExcel: 45827,
    webPortal: "http://safeco.com",
  },
  {
    propertyNickname: "SC - Clemson",
    propertyAddress: "146 F University Village, Central, SC 29630",
    insurer: "State Farm",
    policyNum: "99-BT-A804-4",
    agentName: `Von S Dean / Lewis Patterson`,
    phone: "864-654-2420",
    premium: 619,
    dueExcel: 46305,
    paidExcel: 45940,
    webPortal: "http://statefarm.com",
  },
  {
    propertyNickname: "IL - Urbana",
    propertyAddress: "3020 E Stillwater Lndg #201, Urbana IL 61802",
    insurer: "Safeco",
    policyNum: "OZ5068408",
    agentName: "Dave Rueck",
    phone: "217-355-9075",
    premium: 392,
    dueExcel: 46091,
    paidExcel: 45700,
    webPortal: "http://safeco.com",
  },
  {
    propertyNickname: "MO - Columbia",
    propertyAddress: "5451 S Bethel Church Rd # 4-203 Columbia, MO 65203",
    insurer: `Hereth Insurance Consulting (formerly Concord)\nSafeco (from Concord)`,
    policyNum: "OZ4408714",
    agentName: "Deb Huffman",
    phone: "573-445-7157",
    premium: 648,
    dueExcel: 46089,
    paidExcel: 45724,
    webPortal: "http://safeco.com",
  },
  {
    propertyNickname: "TX - Houston",
    propertyAddress: "12935 Arnage Lane, Houston TX 77085",
    insurer: "Homeowners of America Insurance Company",
    policyNum: "42-503166-02",
    agentName: "Lena Shin / Allrisc Insurance Agency",
    phone: "713-777-6000",
    premium: 2630,
    dueExcel: 46389,
    paidExcel: 46021,
    webPortal: "https://my.sagesure.com/my/overview",
  },
  {
    propertyNickname: "SC - Myrtle Beach",
    propertyAddress: "498 Wallingford Circle, Myrtle Beach, SC 29588",
    insurer: "State Farm",
    policyNum: "99EF67237",
    agentName: "Curtis Ward",
    phone: "843-235-1033",
    premium: 2548,
    dueExcel: 46162,
    paidExcel: 45810,
    webPortal: "http://statefarm.com",
  },
  {
    propertyNickname: "AL - Etowah",
    propertyAddress: "1033 Etowah St. Tarrant, AL 35217",
    insurer: "Millennial Specialty Insurance, LLC",
    policyNum: `Certificate 58509823037\nMaster Policy SPIN3H0003`,
    agentName: "Lucas Ramos (Steadly)",
    phone: "913-347-6460",
    premium: 1024.76,
    dueExcel: 46035,
    paidExcel: 45643,
    webPortal: "http://steadily.com",
  },
  {
    propertyNickname: "AL - Burgin",
    propertyAddress: "1556 Burgin Ave, Birmingham, AL 35208",
    insurer: "Spinnaker Specialty Insurance Company",
    policyNum: "58509828965",
    agentName: "Lucas Ramos (Steadly)",
    phone: "913-347-6460",
    premium: 1115,
    dueExcel: 46095,
    paidExcel: 45700,
    webPortal: "http://steadily.com",
  },
  {
    propertyNickname: "AL - Princeton",
    propertyAddress: "1827 Princeton Ct SW, Birmingham, AL 35211",
    insurer: "Fortegra Specialty Insurance Company",
    policyNum: `Certificate FP3-AL-10332507-00\nMaster Policy FP0-DE-16419385-00`,
    agentName: "Lucas Ramos (Steadly)",
    phone: "913-347-6460",
    premium: 1718.04,
    dueExcel: 45934,
    paidExcel: null, // "auto-monthly"
    webPortal: "http://steadily.com",
    allPolicies: "Paid: auto-monthly",
  },
] as const;

const SEED_PROPERTY_TAX = [
  {
    propertyNickname: "MO - Duplex",
    propertyAddress: "1905-1907 S Arrowhead Ct., Independence, MO 64057",
    annual: 4106.08,
    dueDate: "12/31/2026",
    lastPaid: "11/25/2025",
    parcel: "25-510-05-22-00-0-00-000",
    billNum: "13681119",
    assessed: 49961,
    market: null,
    improvement: null,
    landValue: null,
    phone: "816-881-3186",
    officeName: "Jackson County Property Tax",
    address1: null,
    address2: null,
    city: null,
    st: null,
    zip: null,
    web: "https://payments.jacksongov.org/auth",
    email: null,
  },
  {
    propertyNickname: "MO - SFH",
    propertyAddress: "801 SW Orchard Court, Grain Valley, MO 64029",
    annual: 3373.53,
    dueDate: "12/31/2026",
    lastPaid: "11/25/2025",
    parcel: "40-410-01-43-00-0-00-000",
    billNum: "13681119",
    assessed: 43246,
    market: null,
    improvement: null,
    landValue: null,
    phone: "816-881-3186",
    officeName: "Jackson County Property Tax",
    address1: null,
    address2: null,
    city: null,
    st: null,
    zip: null,
    web: "https://payments.jacksongov.org/auth",
    email: null,
  },
  {
    propertyNickname: "TX - Arlington",
    propertyAddress: "816 Dunkirk Ln, Arlington, TX 76017",
    annual: 5085.21,
    dueDate: "1/31/2027",
    lastPaid: "12/10/2025",
    parcel: "Acct: 7845006",
    billNum: null,
    assessed: null,
    market: 291746,
    improvement: 236746,
    landValue: 55000,
    phone: "817-884-1100",
    officeName: "Tarrant County Tax Assessor-Collector",
    address1: "100 E. Weatherford",
    address2: null,
    city: "Fort Worth",
    st: "TX",
    zip: "76196",
    web: "https://taxonline.tarrantcounty.com/TaxPayer/search",
    email: "taxoffice@tarrantcountytx.gov",
  },
  {
    propertyNickname: "SC - Clemson",
    propertyAddress: "146 F University Village, Central, SC 29630",
    annual: 1296.55,
    dueDate: "12/1/2026",
    lastPaid: "12/10/2025",
    parcel: "406518215265030",
    billNum: "025030253",
    assessed: null,
    market: null,
    improvement: null,
    landValue: null,
    phone: "864-898-5883",
    officeName: "Pickens County",
    address1: "025030253",
    address2: null,
    city: null,
    st: null,
    zip: null,
    web: "www.pickenscountysc.gov",
    email: null,
  },
  {
    propertyNickname: "IL - Urbana",
    propertyAddress: "3020 E Stillwater Lndg #201, Urbana IL 61802",
    annual: 4283.46,
    dueDate: "9/1/2025",
    lastPaid: "8/15/2025",
    parcel: null,
    billNum: null,
    assessed: null,
    market: null,
    improvement: null,
    landValue: null,
    phone: null,
    officeName: null,
    address1: null,
    address2: null,
    city: null,
    st: null,
    zip: null,
    web: null,
    email: null,
  },
  {
    propertyNickname: "MO - Columbia",
    propertyAddress: "5451 S Bethel Church Rd # 4-203 Columbia, MO 65203",
    annual: 955.14,
    dueDate: "12/31/2025",
    lastPaid: "12/16/2024",
    parcel: "20-306-00-06-023.00",
    billNum: "2023R61400",
    assessed: null,
    market: null,
    improvement: null,
    landValue: null,
    phone: "573-886-4288",
    officeName: "Boone County Collector",
    address1: "801 E. Walnut St.",
    address2: "Room 118",
    city: "Columbia",
    st: "MO",
    zip: "65201-4890",
    web: "https://showmeboone.com/collector",
    email: null,
  },
  {
    propertyNickname: "TX - Houston",
    propertyAddress: "12935 Arnage Lane, Houston TX 77085",
    annual: 5038.62,
    dueDate: "1/31/2027",
    lastPaid: "12/10/2025",
    parcel: "125 203 001 0015",
    billNum: null,
    assessed: null,
    market: null,
    improvement: null,
    landValue: null,
    phone: null,
    officeName: "Harris County",
    address1: null,
    address2: null,
    city: null,
    st: null,
    zip: null,
    web: "https://payments.myharriscountytax.com/service/harris_county_tx_ptax",
    email: null,
  },
  {
    propertyNickname: "SC - Myrtle Beach",
    propertyAddress: "498 Wallingford Circle, Myrtle Beach, SC 29588",
    annual: 1861.22,
    dueDate: "1/15/2026",
    lastPaid: "11/25/2025",
    parcel: "Pin: 44012030093",
    billNum: "174011233",
    assessed: 7610,
    market: 126903,
    improvement: 97853,
    landValue: 29050,
    phone: "843-915-5470",
    officeName: "Horry County Treasurer’s office",
    address1: "1301 2nd Ave, Ste 1C09",
    address2: null,
    city: "Conway",
    st: "SC",
    zip: "29526",
    web: "https://www.horrycountysc.gov/tax-payer-services/",
    email: null,
  },
  {
    propertyNickname: "AL - Etowah",
    propertyAddress: "1033 Etowah St. Tarrant, AL 35217",
    annual: 819.26,
    dueDate: "10/1/2026",
    lastPaid: "11/25/2025",
    parcel: "23 00 08 1 019 019.000",
    billNum: "5194875",
    assessed: 14260,
    market: 71300,
    improvement: 44900,
    landValue: 11300,
    phone: "205-325-5500",
    officeName: "Jefferson County Tax, J.T. Smallwood, Tax Collector",
    address1: "716 Richard Arrington Jr. Blvd.",
    address2: "N Room 160 Courthouse",
    city: "Birmingham",
    st: "AL",
    zip: "35203",
    web: "https://eringcapture.jccal.org/caportal/CAPortal_MainPage.aspx?IsHTTPS=1&IFrameURL=CA_PayTaxLogin.aspx",
    email: null,
  },
  {
    propertyNickname: "AL - Burgin",
    propertyAddress: "1556 Burgin Ave, Birmingham, AL 35208",
    annual: 710.05,
    dueDate: "10/1/2026",
    lastPaid: "11/25/2025",
    parcel: "29 00 07 4 008 019.000",
    billNum: "5118494",
    assessed: 9660,
    market: 48300,
    improvement: 33200,
    landValue: 15100,
    phone: "205-325-5500",
    officeName: "Jefferson County Tax, J.T. Smallwood, Tax Collector",
    address1: "716 Richard Arrington Jr. Blvd.",
    address2: "N Room 160 Courthouse",
    city: "Birmingham",
    st: "AL",
    zip: "35203",
    web: "https://eringcapture.jccal.org/caportal/CAPortal_MainPage.aspx?IsHTTPS=1&IFrameURL=CA_PayTaxLogin.aspx",
    email: null,
  },
  {
    propertyNickname: "AL - Princeton",
    propertyAddress: "1827 Princeton Ct SW, Birmingham, AL 35211",
    annual: 1061.32,
    dueDate: "10/1/2026",
    lastPaid: "11/25/2025",
    parcel: "29 00 08 1 025 007.000",
    billNum: "5117589",
    assessed: 15660,
    market: 78300,
    improvement: 61900,
    landValue: 16400,
    phone: "205-325-5500",
    officeName: "Jefferson County Tax, J.T. Smallwood, Tax Collector",
    address1: "716 Richard Arrington Jr. Blvd.",
    address2: "N Room 160 Courthouse",
    city: "Birmingham",
    st: "AL",
    zip: "35203",
    web: "https://eringcapture.jccal.org/caportal/CAPortal_MainPage.aspx?IsHTTPS=1&IFrameURL=CA_PayTaxLogin.aspx",
    email: null,
  },
] as const;


function parseMdyToUtcDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = Number(m[3]);
  return new Date(Date.UTC(year, month - 1, day));
}


function excelSerialToDateUtc(serial: number | null | undefined): Date | null {
  if (!serial || !Number.isFinite(serial)) return null;
  // Excel serial date (Windows): days since 1899-12-30
  return new Date(Date.UTC(1899, 11, 30 + serial));
}

async function upsertPropertyTaxAccounts() {
  for (const row of SEED_PROPERTY_TAX) {
    const property = await prisma.property.findFirst({
      where: { nickname: row.propertyNickname },
      select: { id: true },
    });

    if (!property) {
      throw new Error(`Property tax seed failed. No property found with nickname: "${row.propertyNickname}"`);
    }

    const dueDate = parseMdyToUtcDate(row.dueDate);
    const lastPaid = parseMdyToUtcDate(row.lastPaid);

    const existing = await prisma.propertyTaxAccount.findFirst({
      where: row.parcel
        ? { propertyId: property.id, parcel: row.parcel }
        : { propertyId: property.id, name: row.officeName ?? undefined },
      select: { id: true },
    });

    const data = {
      propertyId: property.id,
      annualAmount: row.annual ?? null,
      dueDate,
      lastPaid,
      parcel: row.parcel ?? null,
      billNumber: row.billNum ?? null,
      phone: row.phone ?? null,
      name: row.officeName ?? null,
      address1: row.address1 ?? null,
      address2: row.address2 ?? null,
      city: row.city ?? null,
      state: row.st ?? null,
      zip: row.zip ?? null,
      web: row.web ?? null,
      email: row.email ?? null,
    };

    if (existing) {
      await prisma.propertyTaxAccount.update({ where: { id: existing.id }, data });
    } else {
      await prisma.propertyTaxAccount.create({ data });
    }
  }
}


async function upsertInsurancePolicies() {
  for (const row of SEED_INSURANCE) {
    // Prefer nickname lookup (much safer than address parsing)
    const property = await prisma.property.findFirst({
      where: { nickname: row.propertyNickname },
      select: { id: true },
    });

    if (!property) {
      throw new Error(`Insurance seed failed. No property found with nickname: "${row.propertyNickname}"`);
    }

    const dueDate = excelSerialToDateUtc(row.dueExcel ?? null);
    const paidDate = excelSerialToDateUtc(row.paidExcel ?? null);

    const existing = await prisma.insurancePolicy.findFirst({
      where: {
        propertyId: property.id,
        policyNum: row.policyNum,
      },
      select: { id: true },
    });

    const data = {
      propertyId: property.id,
      insurer: row.insurer ?? null,
      policyNum: row.policyNum ?? null,
      agentName: row.agentName ?? null,
      phone: row.phone ?? null,
      premium: row.premium ?? null,
      dueDate,
      paidDate,
      webPortal: row.webPortal ?? null,
      allPolicies: row.allPolicies ?? null,
    };

    if (existing) {
      await prisma.insurancePolicy.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.insurancePolicy.create({
        data,
      });
    }
  }
}

// Prisma 7 requires an adapter (or accelerateUrl). For SQLite, use PrismaBetterSqlite3.
const adapter = new PrismaBetterSqlite3({
  url: "file:./prisma/landlord.db",
});

const prisma = new PrismaClient({ adapter });

async function upsertUsers() {
  for (const u of SEED_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 12);

    await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash, role: u.role },
      create: { email: u.email, passwordHash, role: u.role },
    });
  }
}

async function findPropertyIdByNickname(nickname: string): Promise<string> {
  const p = await prisma.property.findFirst({
    where: { nickname },
    select: { id: true },
  });
  if (!p) throw new Error(`No property found with nickname: "${nickname}"`);
  return p.id;
}

async function upsertEntities() {
  for (const e of SEED_ENTITIES) {
    const existing = await prisma.entity.findFirst({ where: { name: e.name } });
    if (existing) {
      await prisma.entity.update({ where: { id: existing.id }, data: { type: e.type } });
    } else {
      await prisma.entity.create({ data: { name: e.name, type: e.type } });
    }
  }
}

async function upsertProperties() {
  const entities = await prisma.entity.findMany({ select: { id: true, name: true } });
  const entityByName = new Map(entities.map((e) => [e.name, e.id]));

  for (const p of SEED_PROPERTIES) {
    const entityId = entityByName.get(p.entityName);
    if (!entityId) throw new Error(`Missing entity "${p.entityName}"`);

    const existing = await prisma.property.findFirst({
      where: { street: p.street, city: p.city, state: p.state, zip: p.zip },
      select: { id: true },
    });

    const property = existing
      ? await prisma.property.update({
          where: { id: existing.id },
          data: {
            nickname: p.nickname ?? null,
            doors: p.doors ?? null,
            beds: p.beds ?? null,
            baths: p.baths ?? null,
            sqFt: p.sqFt ?? null,
          },
          select: { id: true },
        })
      : await prisma.property.create({
          data: {
            nickname: p.nickname ?? null,
            street: p.street,
            city: p.city,
            state: p.state,
            zip: p.zip,
            doors: p.doors ?? null,
            beds: p.beds ?? null,
            baths: p.baths ?? null,
            sqFt: p.sqFt ?? null,
            status: "active",
          },
          select: { id: true },
        });

    const ownershipPct = p.ownershipPct ?? 100;

    const existingOwnership = await prisma.propertyOwnership.findFirst({
      where: { propertyId: property.id, entityId },
      select: { id: true },
    });

    if (existingOwnership) {
      await prisma.propertyOwnership.update({
        where: { id: existingOwnership.id },
        data: { ownershipPct },
      });
    } else {
      await prisma.propertyOwnership.create({
        data: { propertyId: property.id, entityId, ownershipPct },
      });
    }
  }
}

async function main() {
  await upsertUsers();
  await upsertEntities();
  await upsertProperties();
  
  await upsertInsurancePolicies();
  await upsertPropertyTaxAccounts();

  const count = await prisma.property.count();
  console.log("Seed complete. Properties loaded:", count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
