import { decimal6 } from '@/utils/format';
/** Exact source quantity remains inspectable; display formatting never changes submitted values. */
export function PreciseAmount({ value }: { value: string | number | null | undefined }) {
  return <span title={value == null ? undefined : String(value)}>{decimal6(value)}</span>;
}
