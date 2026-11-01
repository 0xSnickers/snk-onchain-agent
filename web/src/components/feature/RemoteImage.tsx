import { useState } from 'react';
import { tokenLabel } from '@/utils/tokenLabel';
export function RemoteImage({
  src,
  label,
  size = 24,
}: {
  src?: string | null;
  label: string;
  size?: number;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const usable = src?.startsWith('https://') && failed !== src;
  const mark = tokenLabel(label) || '?';
  return (
    <span className="remote-image" style={{ width: size, height: size }} aria-hidden="true">
      {usable ? (
        <img
          src={src ?? undefined}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(src ?? null)}
        />
      ) : (
        <span>{Array.from(mark).slice(0, 2).join('').toUpperCase()}</span>
      )}
    </span>
  );
}
