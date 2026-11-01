const markup = /<|>|onerror|javascript:|import\s*\(/i;

export function tokenLabel(value: string | null | undefined) {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > 48 || markup.test(text)) return '';
  return text;
}

export function shortAddress(address: string) {
  return address.length < 12 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`;
}
