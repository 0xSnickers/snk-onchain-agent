import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { agentApi } from '@/services/api/agentApi';
import { useRefreshAgent } from '../hooks/useAgent';
import { errorMessage } from '@/utils/format';
export function CandidateForm() {
  const { t } = useTranslation();
  const refresh = useRefreshAgent();
  const [address, setAddress] = useState(''),
    [name, setName] = useState(''),
    [symbol, setSymbol] = useState(''),
    [kind, setKind] = useState('PAID_TOKEN'),
    [data, setData] = useState('0x'),
    [auto, setAuto] = useState(false);
  const add = useMutation({
    mutationFn: agentApi.addCandidate,
    onSuccess: () => {
      setAddress('');
      setName('');
      setSymbol('');
      setData('0x');
      setAuto(false);
      void refresh();
    },
  });
  return (
    <section className="panel">
      <h2>{t('agent.addCandidate')}</h2>
      <form
        className="agent-form"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate({
            chainId: '56',
            contractAddress: address.trim(),
            name,
            symbol,
            class: kind,
            inputData: data,
            autoExecute: kind === 'FREE_MINT' && auto,
          });
        }}
      >
        <label>
          {t('agent.contract')}
          <input
            required
            pattern="0x[0-9a-fA-F]{40}"
            maxLength={42}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>
        <div className="agent-form-grid">
          <label>
            {t('agent.name')}
            <input maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            {t('agent.symbol')}
            <input maxLength={30} value={symbol} onChange={(e) => setSymbol(e.target.value)} />
          </label>
          <label>
            {t('agent.classification')}
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setAuto(false);
              }}
            >
              {['PAID_TOKEN', 'UNKNOWN', 'FREE_MINT'].map((k) => (
                <option key={k} value={k}>
                  {t(`agent.${k}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {kind !== 'PAID_TOKEN' && (
          <label>
            {t('agent.calldata')}
            <textarea value={data} maxLength={8194} onChange={(e) => setData(e.target.value)} />
          </label>
        )}
        {kind === 'FREE_MINT' && (
          <label className="checkbox-label">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            {t('agent.autoConsent')}
          </label>
        )}
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? t('agent.busy') : t('agent.addCandidate')}
        </Button>
      </form>
      {add.error && (
        <p role="alert" className="error-message">
          {errorMessage(add.error)}
        </p>
      )}
    </section>
  );
}
