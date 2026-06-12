import { config as loadEnv } from 'dotenv';

import { computeDraftAssignments } from '../src/domain/draft';
import { allocateAssignmentBuyIns } from '../src/domain/buy-ins';
import { prisma } from '../src/lib/prisma';

loadEnv({ quiet: true });

const demoUsers = [
  { email: 'alex.demo@example.test', name: 'Alex Demo' },
  { email: 'bailey.demo@example.test', name: 'Bailey Demo' },
  { email: 'casey.demo@example.test', name: 'Casey Demo' },
  { email: 'devon.demo@example.test', name: 'Devon Demo' },
  { email: 'ellis.demo@example.test', name: 'Ellis Demo' },
  { email: 'frankie.demo@example.test', name: 'Frankie Demo' },
];

async function main() {
  assertLocalSqliteDatabase();

  const teams = await prisma.team.findMany({
    where: { active: true },
    orderBy: [{ decimalOdds: 'asc' }, { displayName: 'asc' }],
    select: { id: true, decimalOdds: true },
  });

  if (teams.length === 0) {
    throw new Error('No active teams found. Run `npm run db:seed` before seeding demo data.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.assignment.deleteMany();
    await tx.draft.deleteMany();

    const users = [];
    for (const [index, demoUser] of demoUsers.entries()) {
      const user = await tx.user.upsert({
        where: { email: demoUser.email },
        update: { name: demoUser.name },
        create: {
          email: demoUser.email,
          emailVerified: new Date(),
          name: demoUser.name,
        },
        select: { id: true },
      });
      users.push(user);

      await tx.preferenceSubmission.deleteMany({
        where: { userId: user.id },
      });

      await tx.preferenceSubmission.create({
        data: {
          lockedAt: new Date(),
          userId: user.id,
          choices: {
            create: rotate(teams, index * 5).map((team, rank) => ({
              rank: rank + 1,
              teamId: team.id,
            })),
          },
        },
      });
    }

    const submissions = await tx.preferenceSubmission.findMany({
      where: { userId: { in: users.map((user) => user.id) } },
      include: { choices: { orderBy: { rank: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });

    const draftResult = computeDraftAssignments({
      rng: seededRng(2026),
      submissions: submissions.map((submission) => ({
        submittedAt: submission.createdAt,
        teamIdsByRank: submission.choices.map((choice) => choice.teamId),
        userId: submission.userId,
      })),
      teams,
    });
    const assignmentBuyIns = allocateAssignmentBuyIns({
      assignments: draftResult.assignments,
      targetWinProbability: draftResult.targetWinProbability,
      userTotals: draftResult.userTotals,
    });

    await tx.draft.create({
      data: {
        status: 'LOCKED',
        assignments: {
          create: draftResult.assignments.map((assignment, index) => ({
            buyInPence: assignmentBuyIns[index] ?? 0,
            normalizedWinProbability: assignment.normalizedWinProbability,
            pickNumber: assignment.pickNumber,
            preferenceRankWon: assignment.preferenceRankWon,
            teamId: assignment.teamId,
            teamShareCount: assignment.teamShareCount,
            teamShareIndex: assignment.teamShareIndex,
            userId: assignment.userId,
          })),
        },
      },
    });
  });

  console.log(`Seeded ${demoUsers.length} demo users with draft assignments.`);
}

function assertLocalSqliteDatabase() {
  const databaseUrl = process.env.DATABASE_URL ?? 'file:./data/worldcup.db';

  if (!databaseUrl.startsWith('file:')) {
    throw new Error('Refusing to seed demo data because DATABASE_URL is not a local SQLite file URL.');
  }
}

function rotate<T>(items: T[], offset: number): T[] {
  return items.map((_, index) => items[(index + offset) % items.length]);
}

function seededRng(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
