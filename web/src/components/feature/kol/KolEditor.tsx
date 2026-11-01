import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Kol, KolCategory } from '@snk/contracts';
import { onchainApi } from '@/services/api/onchainApi';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/utils/format';
import { kolCategories } from './kolCategories';
export function KolEditor({ account, onDone }: { account?: Kol; onDone: () => void }) {
  const { t } = useTranslation(),
    client = useQueryClient();
  const [handle, setHandle] = useState(account?.handle || '');
  const [category, setCategory] = useState<KolCategory>(account?.category || 'DAILY');
  const save = useMutation({
    mutationFn: () =>
      account
        ? onchainApi.updateKol({ id: account.id, handle: handle.replace(/^@/, ''), category })
        : onchainApi.addKol({ handle: handle.replace(/^@/, ''), category }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['kols'] });
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
        {t('onchain.handle')}
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          required
          pattern="@?[A-Za-z0-9_]{1,15}"
          maxLength={16}
          autoComplete="off"
        />
      </label>
      <label>
        {t('social.categoryLabel')}
        <select
          aria-label={t('social.categoryLabel')}
          value={category}
          onChange={(e) => setCategory(e.target.value as KolCategory)}
        >
          {kolCategories.map((c) => (
            <option key={c} value={c}>
              {t(`social.category.${c}`)}
            </option>
          ))}
        </select>
      </label>
      {account && handle.replace(/^@/, '').toLowerCase() !== account.handle.toLowerCase() && (
        <p className="muted small">{t('social.handleChange')}</p>
      )}
      {save.error && (
        <p className="error-message" role="alert">
          {errorMessage(save.error)}
        </p>
      )}
      <div className="kol-editor-actions">
        <button type="button" className="quiet-link" onClick={onDone}>
          {t('social.cancel')}
        </button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? t('onchain.loading') : t(account ? 'social.save' : 'onchain.add')}
        </Button>
      </div>
    </form>
  );
}
