import { WORLD_CUP_FIXTURES } from '../src/data/world-cup-fixtures';
import { WORLD_CUP_TEAMS } from '../src/data/world-cup-teams';
import { prisma } from '../src/lib/prisma';

async function main() {
  for (const team of WORLD_CUP_TEAMS) {
    await prisma.team.upsert({
      where: { countryCode: team.countryCode },
      update: {
        displayName: team.displayName,
        groupName: team.groupName,
        bracketSeed: team.bracketSeed,
      },
      create: team,
    });
  }

  const teams = await prisma.team.findMany({
    select: {
      id: true,
      countryCode: true,
    },
  });
  const teamIdsByCode = new Map(teams.map((team) => [team.countryCode, team.id]));

  for (const fixture of WORLD_CUP_FIXTURES) {
    const teamAId = teamIdsByCode.get(fixture.teamACode);
    const teamBId = teamIdsByCode.get(fixture.teamBCode);

    if (teamAId == null || teamBId == null) {
      throw new Error(`Fixture references an unknown team: ${fixture.teamACode} v ${fixture.teamBCode}`);
    }

    const kickoffAt = new Date(fixture.kickoffAt);

    await prisma.match.updateMany({
      where: {
        matchNumber: null,
        teamAId,
        teamBId,
        kickoffAt,
      },
      data: {
        matchNumber: fixture.matchNumber,
      },
    });

    await prisma.match.upsert({
      where: {
        matchNumber: fixture.matchNumber,
      },
      update: {
        teamAId,
        teamBId,
        kickoffAt,
        stage: fixture.stage,
      },
      create: {
        matchNumber: fixture.matchNumber,
        teamAId,
        teamBId,
        kickoffAt,
        stage: fixture.stage,
      },
    });
  }

  console.log(`Seeded ${WORLD_CUP_TEAMS.length} teams and ${WORLD_CUP_FIXTURES.length} fixtures.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
