// Demo seed for local development: several forecasters and markets across states.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DAY = 24 * 60 * 60 * 1000;

// Pad a label to a 44-char base58-ish string (max VarChar(44) for publicKey).
const key = (prefix, fill) => (prefix + fill.repeat(44)).slice(0, 44);

const USERS = [
  { key: key("DemoMaker", "1"), username: "demo_maker", rep: 128 },
  { key: key("OracleQueen", "2"), username: "oracle_queen", rep: 94 },
  { key: key("BackflipBro", "3"), username: "backflip_bro", rep: 61 },
  { key: key("ParkRanger", "4"), username: "park_ranger", rep: 37 },
  { key: key("NewcomerNat", "5"), username: "newcomer_nat", rep: 6 },
];

const MARKETS = [
  {
    pda: "Demo111111111111111111111111111111111111111",
    status: "OPEN",
    days: 3,
    target: "Subj111111111111111111111111111111111111111",
    creator: 2,
    title: "Will Amir land the backflip at Saturday's meetup?",
    description: "Resolves YES if Amir lands a standing backflip on video before 6pm.",
    pools: { yes: "82500000", no: "41250000" },
  },
  {
    pda: "Demo222222222222222222222222222222222222222",
    status: "RESOLVING",
    days: -1,
    target: null,
    creator: 3,
    title: "Does the food truck return to Dolores Park this week?",
    description: "Any weekday appearance counts. Photo proof in comments.",
    pools: { yes: "12000000", no: "36000000" },
  },
  {
    pda: "Demo333333333333333333333333333333333333333",
    status: "SETTLED",
    days: -5,
    target: "Subj333333333333333333333333333333333333333",
    creator: 0,
    title: "Did Priya finish the marathon under 4 hours?",
    description: "Official chip time from the race site.",
    pools: { yes: "150000000", no: "50000000" },
    finalOutcome: 1,
  },
  {
    pda: "Demo444444444444444444444444444444444444444",
    status: "OPEN",
    days: 6,
    target: "Subj444444444444444444444444444444444444444",
    creator: 0,
    title: "Will the group hit 500 miles in the cycling challenge?",
    description: "Combined Strava mileage across all members by month end.",
    pools: { yes: "64000000", no: "96000000" },
  },
  {
    pda: "Demo555555555555555555555555555555555555555",
    status: "DISPUTED",
    days: -2,
    target: null,
    creator: 1,
    title: "Did the startup demo actually crash on stage?",
    description: "Resolves YES if the live demo threw a visible error. Contested.",
    pools: { yes: "28000000", no: "22000000" },
  },
];

async function main() {
  const users = [];
  for (const u of USERS) {
    users.push(
      await prisma.user.upsert({
        where: { publicKey: u.key },
        update: { reputationScore: u.rep },
        create: { publicKey: u.key, username: u.username, reputationScore: u.rep },
      })
    );
  }

  for (const m of MARKETS) {
    const { pda, status, days, target, creator, finalOutcome, ...meta } = m;
    const market = await prisma.market.upsert({
      where: { pdaAddress: pda },
      update: { status, metadata: { ...meta, ...(finalOutcome != null ? { finalOutcome } : {}) } },
      create: {
        pdaAddress: pda,
        status,
        resolutionDate: new Date(Date.now() + days * DAY),
        targetWallet: target,
        creatorId: users[creator].id,
        metadata: { ...meta, ...(finalOutcome != null ? { finalOutcome } : {}) },
      },
    });
    await prisma.comment.deleteMany({ where: { marketId: market.id } });
    await prisma.comment.createMany({
      data: [
        {
          marketId: market.id,
          userId: users[(creator + 1) % users.length].id,
          content: "Taking the other side of this — the line looks off to me.",
        },
        {
          marketId: market.id,
          userId: users[(creator + 2) % users.length].id,
          content: "In. This resolves exactly how I think it will.",
        },
      ],
    });
  }

  console.log(`seeded ${USERS.length} forecasters, ${MARKETS.length} markets`);
}

main().finally(() => prisma.$disconnect());
