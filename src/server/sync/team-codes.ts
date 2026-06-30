const CODE_ALIASES: Record<string, string> = {
  DRC: 'COD',
  KSA: 'KSA',
  ROK: 'KOR',
  UKR: 'UKR',
  USA: 'USA',
  ZAF: 'RSA',
};

const NAME_ALIASES: Record<string, string> = {
  algeria: 'ALG',
  argentina: 'ARG',
  australia: 'AUS',
  austria: 'AUT',
  belgium: 'BEL',
  'bosnia and herzegovina': 'BIH',
  bosnia: 'BIH',
  brazil: 'BRA',
  'cabo verde': 'CPV',
  'cape verde': 'CPV',
  canada: 'CAN',
  colombia: 'COL',
  'congo dr': 'COD',
  'congo d r': 'COD',
  'democratic republic of the congo': 'COD',
  'dr congo': 'COD',
  croatia: 'CRO',
  curacao: 'CUW',
  curacaoo: 'CUW',
  czechia: 'CZE',
  'czech republic': 'CZE',
  ecuador: 'ECU',
  egypt: 'EGY',
  england: 'ENG',
  france: 'FRA',
  germany: 'GER',
  ghana: 'GHA',
  haiti: 'HAI',
  iran: 'IRN',
  'ir iran': 'IRN',
  iraq: 'IRQ',
  'ivory coast': 'CIV',
  japan: 'JPN',
  jordan: 'JOR',
  'korea republic': 'KOR',
  'south korea': 'KOR',
  mexico: 'MEX',
  morocco: 'MAR',
  netherlands: 'NED',
  'new zealand': 'NZL',
  norway: 'NOR',
  panama: 'PAN',
  paraguay: 'PAR',
  portugal: 'POR',
  qatar: 'QAT',
  'saudi arabia': 'KSA',
  scotland: 'SCO',
  senegal: 'SEN',
  southafrica: 'RSA',
  'south africa': 'RSA',
  spain: 'ESP',
  sweden: 'SWE',
  switzerland: 'SUI',
  tunisia: 'TUN',
  turkey: 'TUR',
  turkiye: 'TUR',
  türkiye: 'TUR',
  usa: 'USA',
  'united states': 'USA',
  'united states of america': 'USA',
  uruguay: 'URU',
  uzbekistan: 'UZB',
  'cote divoire': 'CIV',
  "cote d'ivoire": 'CIV',
  'cote d ivoire': 'CIV',
};

export function countryCodeFromProviderTeam(team: {
  code?: string | null;
  name?: string | null;
}): string | null {
  const code = normalizeCode(team.code);
  const codeAlias = code === null ? null : CODE_ALIASES[code] ?? code;
  const nameAlias = countryCodeFromProviderName(team.name);

  return nameAlias ?? codeAlias;
}

export function countryCodeFromProviderName(name: string | null | undefined): string | null {
  const normalizedName = normalizeName(name);

  if (normalizedName === null) {
    return null;
  }

  return NAME_ALIASES[normalizedName] ?? null;
}

function normalizeCode(code: string | null | undefined): string | null {
  if (typeof code !== 'string') {
    return null;
  }

  const trimmed = code.trim().toUpperCase();

  return /^[A-Z]{3}$/.test(trimmed) ? trimmed : null;
}

function normalizeName(name: string | null | undefined): string | null {
  if (typeof name !== 'string') {
    return null;
  }

  const normalized = name
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  return normalized === '' ? null : normalized;
}
