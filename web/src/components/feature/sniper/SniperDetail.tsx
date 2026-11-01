import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { SniperTarget } from '@snk/contracts';
import { sniperApi } from '@/services/api/sniperApi';
import { Button } from '@/components/ui/button';
import { errorMessage, tokenPercent } from '@/utils/format';
import { shortAddress, tokenLabel } from '@/utils/tokenLabel';

const key = ['sniper', 'board'] as const;
const amountOk = (value: string) =>
  /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value) && Number(value) > 0;

export function SniperDetail({
  target,
  armed,
}: {
  target: SniperTarget | undefined;
  armed: boolean;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [amount, setAmount] = useState('5');
  const [phrase, setPhrase] = useState('');
  const [recorded, setRecorded] = useState(false);
  const refresh = () => client.invalidateQueries({ queryKey: key });
  const arm = useMutation({ mutationFn: () => sniperApi.arm(target!.id), onSuccess: refresh });
  const disarm = useMutation({
    mutationFn: () => sniperApi.disarm(target!.id),
    onSuccess: refresh,
  });
  const preview = useMutation({
    mutationFn: () => sniperApi.preview(target!.id, amount),
    onSuccess: refresh,
  });
  const confirm = useMutation({
    mutationFn: () => sniperApi.confirm(target!.id, target!.preview!.amount, phrase),
    onSuccess: () => {
      setRecorded(true);
      setPhrase('');
      void refresh();
    },
  });
  if (!target) return <p className="muted">{t('sniper.select')}</p>;
  const title =
    tokenLabel(target.symbol) || tokenLabel(target.name) || shortAddress(target.contractAddress);
  const expected = target.preview ? `确认狙击 ${target.preview.amount} USDT` : '';
  const failure = arm.error || disarm.error || preview.error || confirm.error;
  return (
    <section className="panel" aria-live="polite">
      <div className="section-heading">
        <h2>{title}</h2>
        <span className="badge">{t(`sniper.status.${target.status}`)}</span>
      </div>
      <p className="mono full-address">{target.contractAddress}</p>
      <p className="muted small">
        {t('sniper.progress')} {tokenPercent(target.progress)} · {t('sniper.holders')}{' '}
        {target.holders ?? '—'} · {t('sniper.agentWallets')} {target.agentWallets ?? '—'}
      </p>
      <ul className="sniper-reasons">
        {target.reasons.map((reason) => (
          <li key={reason}>{t(`sniper.reason.${reason}`)}</li>
        ))}
      </ul>
      <a href={target.url} target="_blank" rel="noreferrer">
        {shortAddress(target.contractAddress)}
      </a>
      {target.status === 'THRESHOLD' && (
        <Button type="button" disabled={!armed || arm.isPending} onClick={() => arm.mutate()}>
          {t('sniper.armTarget')}
        </Button>
      )}
      {(target.status === 'ARMED' || target.status === 'AWAITING_CONFIRM') && (
        <Button
          type="button"
          variant="outline"
          disabled={disarm.isPending}
          onClick={() => disarm.mutate()}
        >
          {t('sniper.disarmTarget')}
        </Button>
      )}
      {target.status === 'ARMED' && (
        <form
          className="agent-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (amountOk(amount)) preview.mutate();
          }}
        >
          <label>
            {t('sniper.amount')}
            <input value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <Button type="submit" disabled={!armed || !amountOk(amount) || preview.isPending}>
            {t('sniper.preview')}
          </Button>
        </form>
      )}
      {target.status === 'AWAITING_CONFIRM' && target.preview && (
        <form
          className="agent-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (phrase === expected) confirm.mutate();
          }}
        >
          <p className="muted small">{t('sniper.phraseHint', { amount: target.preview.amount })}</p>
          <label>
            {t('sniper.phrase')}
            <input value={phrase} onChange={(event) => setPhrase(event.target.value)} />
          </label>
          <Button type="submit" disabled={phrase !== expected || confirm.isPending}>
            {t('sniper.confirm')}
          </Button>
        </form>
      )}
      {recorded && <p role="status">{t('sniper.recorded')}</p>}
      {failure && <p role="alert">{errorMessage(failure)}</p>}
    </section>
  );
}
