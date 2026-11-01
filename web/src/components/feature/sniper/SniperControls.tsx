import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { SniperControls as Controls } from '@snk/contracts';
import { sniperApi } from '@/services/api/sniperApi';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/utils/format';

const key = ['sniper', 'board'] as const;
const band = (value: string, min: number, max: number) => {
  if (!/^\d+$/.test(value)) return false;
  const n = Number(value);
  return n >= min && n <= max;
};

export function SniperControls({ controls }: { controls: Controls }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [armed, setArmed] = useState(controls.armed);
  const [minProgress, setMinProgress] = useState(String(controls.minProgress));
  const [minAgentWallets, setMinAgentWallets] = useState(String(controls.minAgentWallets));
  const [maxUsd, setMaxUsd] = useState(String(controls.maxUsd));
  const [dailyUsdCap, setDailyUsdCap] = useState(String(controls.dailyUsdCap));
  const [address, setAddress] = useState('');
  const valid =
    band(minProgress, 60, 70) &&
    band(minAgentWallets, 100, 130) &&
    band(maxUsd, 1, 20) &&
    band(dailyUsdCap, 1, 60) &&
    Number(maxUsd) <= Number(dailyUsdCap);
  const save = useMutation({
    mutationFn: () =>
      sniperApi.saveControls({
        armed,
        minProgress: Number(minProgress),
        minAgentWallets: Number(minAgentWallets),
        maxUsd: Number(maxUsd),
        dailyUsdCap: Number(dailyUsdCap),
      }),
    onSuccess: (board) => client.setQueryData(key, board),
  });
  const add = useMutation({
    mutationFn: () => sniperApi.add(address.trim()),
    onSuccess: () => {
      setAddress('');
      void client.invalidateQueries({ queryKey: key });
    },
  });
  const addressOk = /^0x(?!0{40}$)[0-9a-fA-F]{40}$/.test(address.trim());
  return (
    <section className="panel sniper-controls">
      <p className={armed ? 'badge positive' : 'badge'} role="status">
        {armed ? t('sniper.armed') : t('sniper.disarmed')}
      </p>
      <form
        className="agent-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) save.mutate();
        }}
      >
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={armed}
            onChange={(event) => setArmed(event.target.checked)}
          />
          {t('sniper.armSwitch')}
        </label>
        <div className="agent-form-grid">
          <label>
            {t('sniper.minProgress')}
            <input value={minProgress} onChange={(event) => setMinProgress(event.target.value)} />
          </label>
          <label>
            {t('sniper.minWallets')}
            <input
              value={minAgentWallets}
              onChange={(event) => setMinAgentWallets(event.target.value)}
            />
          </label>
          <label>
            {t('sniper.maxUsd')}
            <input value={maxUsd} onChange={(event) => setMaxUsd(event.target.value)} />
          </label>
          <label>
            {t('sniper.daily')}
            <input value={dailyUsdCap} onChange={(event) => setDailyUsdCap(event.target.value)} />
          </label>
        </div>
        <p className="muted small">{t('sniper.armHint')}</p>
        <Button type="submit" disabled={!valid || save.isPending}>
          {t('sniper.save')}
        </Button>
        <details>
          <summary>{t('sniper.manual')}</summary>
          <label>
            {t('sniper.manual')}
            <input
              value={address}
              placeholder="0x"
              onChange={(event) => setAddress(event.target.value)}
            />
          </label>
          <p className="muted small">{t('sniper.manualHint')}</p>
          <Button
            type="button"
            variant="outline"
            disabled={!addressOk || add.isPending}
            onClick={() => add.mutate()}
          >
            {t('sniper.manualAction')}
          </Button>
        </details>
      </form>
      {(save.error || add.error) && <p role="alert">{errorMessage(save.error || add.error)}</p>}
    </section>
  );
}
