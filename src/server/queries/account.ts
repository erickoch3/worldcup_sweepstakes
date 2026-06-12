import { prisma } from '../../lib/prisma';

export async function getAccountData(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      preferenceSubmission: {
        include: {
          choices: {
            orderBy: { rank: 'asc' },
            include: { team: true },
          },
        },
      },
      assignments: {
        orderBy: [{ pickNumber: 'asc' }, { createdAt: 'asc' }],
        include: {
          team: true,
          draft: true,
        },
      },
    },
  });
}
