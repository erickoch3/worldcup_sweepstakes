import { STANDARD_BUY_IN_PENCE } from './buy-ins';

export type PrizeEntry = {
  userId: string;
  buyInPence: number;
};

export type PrizePayout = {
  place: number;
  label: string;
  amountPence: number;
};

export type PrizeSummary = {
  totalPrizePoolPence: number;
  payouts: PrizePayout[];
};

export function computePrizeSummary(entries: PrizeEntry[]): PrizeSummary {
  const buyInByUserId = new Map<string, number>();

  for (const entry of entries) {
    buyInByUserId.set(entry.userId, (buyInByUserId.get(entry.userId) ?? 0) + entry.buyInPence);
  }

  const chargedPlayerCount = [...buyInByUserId.values()].filter((buyInPence) => buyInPence > 0).length;
  const totalPrizePoolPence = chargedPlayerCount * STANDARD_BUY_IN_PENCE;

  return {
    totalPrizePoolPence,
    payouts: [{ place: 1, label: 'Winner', amountPence: totalPrizePoolPence }],
  };
}
