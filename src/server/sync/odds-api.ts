import { countryCodeFromProviderName } from './team-codes';

const ODDS_API_BASE_URL = 'https://api.the-odds-api.com';
const ODDS_API_WORLD_CUP_WINNER_SPORT = 'soccer_fifa_world_cup_winner';

export type TeamOddsSnapshotInput = {
  provider: 'the-odds-api';
  sourceEventId: string;
  sourceSportKey: string;
  sourceLastUpdate: Date | null;
  sampledAt: Date;
  bookmakerKey: string;
  bookmakerTitle: string;
  marketKey: string;
  outcomeName: string;
  countryCode: string;
  decimalOdds: number;
  impliedProbability: number;
};

export type TeamOddsSummary = {
  countryCode: string;
  decimalOdds: number;
  impliedProbability: number;
  normalizedWinProbability: number;
};

type OddsApiFetchOptions = {
  apiKey: string;
  baseUrl?: string;
  bookmakers?: string | null;
  fetcher?: typeof fetch;
  regions?: string;
  sampledAt: Date;
  sport?: string;
};

export async function fetchOddsApiOutrights({
  apiKey,
  baseUrl = ODDS_API_BASE_URL,
  bookmakers,
  fetcher = fetch,
  regions = 'uk',
  sampledAt,
  sport = ODDS_API_WORLD_CUP_WINNER_SPORT,
}: OddsApiFetchOptions): Promise<TeamOddsSnapshotInput[]> {
  const url = new URL(`/v4/sports/${sport}/odds`, baseUrl);
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('markets', 'outrights');
  url.searchParams.set('oddsFormat', 'decimal');
  if (bookmakers != null && bookmakers.trim() !== '') {
    url.searchParams.set('bookmakers', bookmakers);
  } else {
    url.searchParams.set('regions', regions);
  }

  const response = await fetcher(url);

  if (!response.ok) {
    throw new Error(`The Odds API outright request failed with HTTP ${response.status}.`);
  }

  return parseOddsApiOutrights(await response.json(), sampledAt);
}

export function parseOddsApiOutrights(payload: unknown, sampledAt: Date): TeamOddsSnapshotInput[] {
  assertOddsApiResponse(payload);

  const snapshots: TeamOddsSnapshotInput[] = [];

  for (const event of payload) {
    const sourceEventId = optionalString(event.id);
    const sourceSportKey = optionalString(event.sport_key) ?? ODDS_API_WORLD_CUP_WINNER_SPORT;

    if (sourceEventId === null) {
      continue;
    }

    for (const bookmaker of event.bookmakers ?? []) {
      const bookmakerKey = optionalString(bookmaker.key);
      const bookmakerTitle = optionalString(bookmaker.title) ?? bookmakerKey;
      const bookmakerLastUpdate = optionalDate(bookmaker.last_update);

      if (bookmakerKey === null || bookmakerTitle === null) {
        continue;
      }

      for (const market of bookmaker.markets ?? []) {
        const marketKey = optionalString(market.key);

        if (marketKey !== 'outrights') {
          continue;
        }

        const sourceLastUpdate = optionalDate(market.last_update) ?? bookmakerLastUpdate;

        for (const outcome of market.outcomes ?? []) {
          const outcomeName = optionalString(outcome.name);
          const countryCode = countryCodeFromProviderName(outcomeName);
          const decimalOdds = optionalDecimalOdds(outcome.price);

          if (outcomeName === null || countryCode === null || decimalOdds === null) {
            continue;
          }

          snapshots.push({
            provider: 'the-odds-api',
            sourceEventId,
            sourceSportKey,
            sourceLastUpdate,
            sampledAt,
            bookmakerKey,
            bookmakerTitle,
            marketKey,
            outcomeName,
            countryCode,
            decimalOdds,
            impliedProbability: 1 / decimalOdds,
          });
        }
      }
    }
  }

  return snapshots;
}

export function summarizeBestTeamOdds(snapshots: TeamOddsSnapshotInput[]): TeamOddsSummary[] {
  const bestByCountryCode = new Map<string, TeamOddsSnapshotInput>();

  for (const snapshot of snapshots) {
    const current = bestByCountryCode.get(snapshot.countryCode);

    if (
      current === undefined ||
      snapshot.decimalOdds > current.decimalOdds ||
      (snapshot.decimalOdds === current.decimalOdds && snapshot.bookmakerKey.localeCompare(current.bookmakerKey) < 0)
    ) {
      bestByCountryCode.set(snapshot.countryCode, snapshot);
    }
  }

  const bestSnapshots = [...bestByCountryCode.values()];
  const impliedTotal = bestSnapshots.reduce((total, snapshot) => total + snapshot.impliedProbability, 0);

  if (impliedTotal <= 0) {
    return [];
  }

  return bestSnapshots
    .map((snapshot) => ({
      countryCode: snapshot.countryCode,
      decimalOdds: snapshot.decimalOdds,
      impliedProbability: snapshot.impliedProbability,
      normalizedWinProbability: snapshot.impliedProbability / impliedTotal,
    }))
    .sort((left, right) => {
      if (left.normalizedWinProbability !== right.normalizedWinProbability) {
        return right.normalizedWinProbability - left.normalizedWinProbability;
      }

      return left.countryCode.localeCompare(right.countryCode);
    });
}

function assertOddsApiResponse(payload: unknown): asserts payload is Array<{
  id?: unknown;
  sport_key?: unknown;
  bookmakers?: Array<{
    key?: unknown;
    title?: unknown;
    last_update?: unknown;
    markets?: Array<{
      key?: unknown;
      last_update?: unknown;
      outcomes?: Array<{
        name?: unknown;
        price?: unknown;
      }>;
    }>;
  }>;
}> {
  if (!Array.isArray(payload)) {
    throw new Error('The Odds API response must be an array.');
  }
}

function optionalDecimalOdds(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 1 ? value : null;
}

function optionalDate(value: unknown): Date | null {
  const raw = optionalString(value);

  if (raw === null) {
    return null;
  }

  const date = new Date(raw);

  return Number.isNaN(date.getTime()) ? null : date;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}
