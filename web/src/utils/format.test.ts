import { adaptiveDecimal, decimal6, tokenUsd, usd } from './format';
it.each([
  ['1', '1.000000'],
  ['.5', '0.500000'],
  ['1.1234565', '1.123457'],
  ['999999999999999999.9999995', '1,000,000,000,000,000,000.000000'],
  ['-1.1234565', '-1.123457'],
  ['1e-7', '0.000000'],
  ['1.2345678e2', '123.456780'],
  ['0', '0.000000'],
  [null, '—'],
  ['invalid', '—'],
])('formats %s with six decimal places', (input, expected) =>
  expect(decimal6(input)).toBe(expected),
);
it('uses six digits for USD without changing source precision', () =>
  expect(usd('2.5')).toBe('$2.500000'));
it.each([
  ['2.5', '2.5'],
  ['0.12', '0.12'],
  ['0.000018', '0.000018'],
  ['0.000000018234', '0.00000001823'],
  ['1e-7', '0.0000001'],
  ['1234.5', '1,234.5'],
  ['-0.000000018', '-0.000000018'],
  [null, '—'],
])('formats market price %s by magnitude', (input, expected) =>
  expect(adaptiveDecimal(input)).toBe(expected),
);
it('keeps a sub-micro token price visible in USD', () =>
  expect(tokenUsd('0.000000018')).toBe('$0.000000018'));
