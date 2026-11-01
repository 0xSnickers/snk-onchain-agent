export function tokenUnits(raw: string, decimals: number | null): string | null {
  if (
    !/^\d+$/.test(raw) ||
    decimals === null ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 36
  )
    return null;
  if (decimals === 0) return BigInt(raw).toString();
  const s = raw.padStart(decimals + 1, '0');
  return `${s.slice(0, -decimals)}.${s.slice(-decimals)}`.replace(/\.?0+$/, '') || '0';
}
