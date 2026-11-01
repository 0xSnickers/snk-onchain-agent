import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { delegationApi } from '@/services/api/delegationApi';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/utils/format';
export function DelegatedBuyForm({ briefId }: { briefId: string }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const sessions = useQuery({
    queryKey: ['delegation', 'sessions'],
    queryFn: delegationApi.sessions,
    retry: false,
  });
  const [amount, setAmount] = useState('');
  const [asset, setAsset] = useState<'BNB' | 'USDT'>('BNB');
  const [confirmationText, setConfirmationText] = useState('');
  const [targetId, setTargetId] = useState('');
  const paidSessions = (sessions.data || []).filter((s) => s.role === 'PAID');
  const target = paidSessions.find((s) => s.id === targetId);
  const confirm = useMutation({
    mutationFn: () =>
      delegationApi.confirm(briefId, {
        amount,
        asset,
        confirmationText,
        walletScope: target!.walletScope,
      }),
    onSuccess: () => {
      setConfirmationText('');
      void client.invalidateQueries({ queryKey: ['delegation'] });
    },
  });
  return (
    <details>
      <summary>{t('delegation.buy')}</summary>
      <p className="muted small">{t('delegation.buyHint')}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (target) confirm.mutate();
        }}
      >
        <label>
          {t('delegation.target')}{' '}
          <select
            value={target?.id || ''}
            onChange={(e) => {
              setTargetId(e.target.value);
              setConfirmationText('');
              confirm.reset();
            }}
            required
          >
            <option value="">{t('delegation.selectTarget')}</option>
            {paidSessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label || s.id} · {s.id}
              </option>
            ))}
          </select>
        </label>
        <code className="full-address">{target?.walletScope}</code>
        <label>
          {t('delegation.amount')}{' '}
          <input
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          {t('delegation.asset')}{' '}
          <select value={asset} onChange={(e) => setAsset(e.target.value as 'BNB' | 'USDT')}>
            <option>BNB</option>
            <option>USDT</option>
          </select>
        </label>
        <label>
          {t('delegation.confirmation')}{' '}
          <input
            required
            value={confirmationText}
            placeholder={`确认买入 ${amount} ${asset}`}
            onChange={(e) => setConfirmationText(e.target.value)}
          />
        </label>
        <Button
          type="submit"
          disabled={
            !target || confirm.isPending || confirmationText !== `确认买入 ${amount} ${asset}`
          }
        >
          {t('delegation.submit')}
        </Button>
      </form>
      {(confirm.error || sessions.error) && (
        <p role="alert">{errorMessage(confirm.error || sessions.error)}</p>
      )}
      {confirm.isSuccess && <p role="status">{t('delegation.queued')}</p>}
    </details>
  );
}
