/** Display only. Parsing stays in decimal strings so large amounts are not rounded by floats. */
function parseParts(value: string | number | null | undefined) {
  if (value == null) return null;
  const text = String(value);
  if (text.length > 1024) return null;
  const match = text
    .replace(/^([+-]?)\./, '$10.')
    .match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if (!match) return null;
  const exponent = Number(match[4] || 0);
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 1000) return null;
  const digits = match[2] + (match[3] || '');
  const point = match[2].length + exponent;
  const whole = (point <= 0 ? '0' : digits.slice(0, point).padEnd(point, '0')).replace(/^0+(?=\d)/, '');
  const fraction = point < 0 ? '0'.repeat(-point) + digits : digits.slice(point);
  return { sign: match[1] === '-' ? '-' : '', whole: whole || '0', fraction };
}

function roundParts(whole: string, fraction: string, places: number) {
  const head = fraction.padEnd(places + 1, '0');
  let scaled = BigInt((whole || '0') + head.slice(0, places));
  if (Number(head[places] || '0') >= 5) scaled += 1n;
  const text = scaled.toString().padStart(places + 1, '0');
  const integer = (places === 0 ? text : text.slice(0, -places)).replace(/^0+(?=\d)/, '') || '0';
  const frac = places === 0 ? '' : text.slice(-places);
  return { integer, fraction: frac, zero: scaled === 0n };
}

function group(integer: string) {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function decimal6(value: string | number | null | undefined) {
  const parts = parseParts(value);
  if (!parts) return '—';
  const rounded = roundParts(parts.whole, parts.fraction, 6);
  const sign = parts.sign === '-' && !rounded.zero ? '-' : '';
  return `${sign}${group(rounded.integer)}.${rounded.fraction}`;
}

function adaptivePlaces(whole: string, fraction: string) {
  const magnitude = whole.replace(/^0+/, '');
  if (magnitude.length >= 4) return 2;
  if (magnitude.length >= 1) return 4;
  const lead = /^0*/.exec(fraction)?.[0].length ?? 0;
  const significant = fraction.slice(lead).replace(/0+$/, '');
  if (!significant) return 0;
  if (lead < 6) return Math.min(6, lead + significant.length);
  return Math.min(lead + 4, 18);
}

/** More fraction digits for sub-0.000001 prices, fewer for larger ones, without trailing zeros. */
export function adaptiveDecimal(value: string | number | null | undefined) {
  const parts = parseParts(value);
  if (!parts) return '—';
  const rounded = roundParts(parts.whole, parts.fraction, adaptivePlaces(parts.whole, parts.fraction));
  const fraction = rounded.fraction.replace(/0+$/, '');
  const sign = parts.sign === '-' && !rounded.zero ? '-' : '';
  return `${sign}${group(rounded.integer)}${fraction ? `.${fraction}` : ''}`;
}

export function usd(value: string | number | null | undefined) {
  return withDollar(decimal6(value));
}
export function tokenUsd(value: string | number | null | undefined) {
  return withDollar(adaptiveDecimal(value));
}
function withDollar(formatted: string) {
  if (formatted === '—') return formatted;
  return formatted.startsWith('-') ? `-$${formatted.slice(1)}` : `$${formatted}`;
}
export function percent6(value: number | null | undefined, signed = false) {
  if (value == null) return '—';
  return `${signed && value > 0 ? '+' : ''}${decimal6(value)}%`;
}
export function tokenPercent(value: number | null | undefined, signed = false) {
  if (value == null) return '—';
  return `${signed && value > 0 ? '+' : ''}${adaptiveDecimal(value)}%`;
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
