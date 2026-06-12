const alpha3ToAlpha2: Record<string, string> = {
  ALG: 'DZ',
  ARG: 'AR',
  AUS: 'AU',
  AUT: 'AT',
  BEL: 'BE',
  BIH: 'BA',
  BRA: 'BR',
  CAN: 'CA',
  CIV: 'CI',
  COD: 'CD',
  COL: 'CO',
  CPV: 'CV',
  CRO: 'HR',
  CUW: 'CW',
  CZE: 'CZ',
  ECU: 'EC',
  EGY: 'EG',
  ESP: 'ES',
  FRA: 'FR',
  GER: 'DE',
  GHA: 'GH',
  HAI: 'HT',
  IRN: 'IR',
  IRQ: 'IQ',
  JOR: 'JO',
  JPN: 'JP',
  KOR: 'KR',
  KSA: 'SA',
  MAR: 'MA',
  MEX: 'MX',
  NED: 'NL',
  NOR: 'NO',
  NZL: 'NZ',
  PAN: 'PA',
  PAR: 'PY',
  POR: 'PT',
  QAT: 'QA',
  RSA: 'ZA',
  SEN: 'SN',
  SUI: 'CH',
  SWE: 'SE',
  TUN: 'TN',
  TUR: 'TR',
  URU: 'UY',
  USA: 'US',
  UZB: 'UZ',
};

const subdivisionFlags: Record<string, string> = {
  ENG: 'gbeng',
  SCO: 'gbsct',
};

type TeamNameWithFlagProps = {
  countryCode?: string | null;
  name: string;
};

export function TeamNameWithFlag({ countryCode, name }: TeamNameWithFlagProps) {
  const flag = countryCodeToFlagEmoji(countryCode);

  if (flag === null) {
    return <>{name}</>;
  }

  return (
    <>
      <span aria-label={`${name} flag`} role="img">
        {flag}
      </span>{' '}
      <span>{name}</span>
    </>
  );
}

function countryCodeToFlagEmoji(countryCode?: string | null): string | null {
  const normalizedCode = countryCode?.trim().toUpperCase();

  if (!normalizedCode) {
    return null;
  }

  const subdivisionFlag = subdivisionFlags[normalizedCode];

  if (subdivisionFlag) {
    return subdivisionFlagToEmoji(subdivisionFlag);
  }

  const alpha2Code = normalizedCode.length === 2 ? normalizedCode : alpha3ToAlpha2[normalizedCode];

  if (!alpha2Code || !/^[A-Z]{2}$/.test(alpha2Code)) {
    return null;
  }

  return Array.from(alpha2Code)
    .map((character) => String.fromCodePoint(0x1f1e6 + character.charCodeAt(0) - 65))
    .join('');
}

function subdivisionFlagToEmoji(subdivisionCode: string): string {
  return String.fromCodePoint(
    0x1f3f4,
    ...Array.from(subdivisionCode).map((character) => 0xe0000 + character.charCodeAt(0)),
    0xe007f,
  );
}
