import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ExecutorSession, ExecutorRole } from '@snk/contracts';
import { delegationApi } from '@/services/api/delegationApi';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/utils/format';
export function ExecutorEditor({
  account,
  onDone,
}: {
  account?: ExecutorSession;
  onDone: () => void;
}) {
  const { t } = useTranslation(),
    client = useQueryClient();
  const [id, setId] = useState(account?.id || '');
  const [address, setAddress] = useState(account?.walletScope.slice(4) || '');
  const [label, setLabel] = useState(account?.label || '');
  const [role, setRole] = useState<ExecutorRole>(account?.role || 'MONITOR');
  const [isDefault, setDefault] = useState(account?.isDefault || false);
  const [paused, setPaused] = useState(account?.paused || false);
  const save = useMutation({
    mutationFn: () =>
      account
        ? delegationApi.update(account.id, {
            label,
            role,
            isDefault: role !== 'MONITOR' && isDefault,
            paused,
          })
        : delegationApi.register({
            id,
            walletScope: `EVM:${address.replace(/^EVM:/i, '').trim().toLowerCase()}`,
            label,
            role,
            isDefault: role !== 'MONITOR' && isDefault,
          }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['delegation'] });
      onDone();
    },
  });
  return (
    <form
      className="kol-editor"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <label>
        {t('delegation.id')}
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          required
          maxLength={32}
          disabled={!!account}
        />
      </label>
      <label>
        {t('delegation.label')}
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} />
      </label>
      <label>
        {t('delegation.address')}
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
          disabled={!!account}
          autoComplete="off"
        />
      </label>
      <label>
        {t('delegation.role')}
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value as ExecutorRole);
            setDefault(false);
          }}
        >
          {(['MONITOR', 'FREE_MINT', 'PAID'] as const).map((r) => (
            <option key={r} value={r}>
              {t(`delegation.${r}`)}
            </option>
          ))}
        </select>
      </label>
      {role !== 'MONITOR' && (
        <label>
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setDefault(e.target.checked)}
          />
          {t('delegation.default')}
        </label>
      )}
      {account && (
        <label>
          <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} />
          {t('delegation.paused')}
        </label>
      )}
      {save.error && (
        <p role="alert" className="error-message">
          {errorMessage(save.error)}
        </p>
      )}
      <Button type="submit" disabled={save.isPending}>
        {t('delegation.save')}
      </Button>
    </form>
  );
}
