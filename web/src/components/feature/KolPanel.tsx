import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Pencil, Users } from 'lucide-react';
import type { Kol } from '@snk/contracts';
import { onchainApi } from '@/services/api/onchainApi';
import { onchainKeys } from '@/hooks/useOnchain';
import { errorMessage } from '@/utils/format';
import { KolTimeline } from './kol/KolTimeline';
import { KolEditor } from './kol/KolEditor';
import { RemoteImage } from './RemoteImage';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { kolCategories } from './kol/kolCategories';
export function KolPanel({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation(),
    client = useQueryClient();
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [editing, setEditing] = useState<Kol | 'add' | null>(null);
  const kols = useQuery({ queryKey: onchainKeys.kols, queryFn: onchainApi.kols, retry: false });
  const active = kols.data?.accounts.find((a) => a.id === selectedId) || kols.data?.accounts[0];
  const remove = useMutation({
    mutationFn: onchainApi.removeKol,
    onSuccess: () => client.invalidateQueries({ queryKey: onchainKeys.kols }),
  });
  return (
    <div className={compact ? 'kol-compact' : 'kol-workspace'}>
      <section className="panel kol-watchlist">
        <div className="section-heading">
          <h2>{t('onchain.watch')}</h2>
          <span className="badge">{kols.data?.accounts.length ?? '—'}</span>
          <button
            className="icon-button kol-add"
            aria-label={t('social.addShort')}
            title={t('onchain.add')}
            onClick={(e) => {
              returnFocus.current = e.currentTarget;
              setEditing('add');
            }}
          >
            <Plus size={14} />
          </button>
        </div>
        {!compact && kols.data && !kols.data.x.configured && (
          <details className="kol-setup">
            <summary>{t('onchain.xMissing')}</summary>
            <p>{t('social.keyMissing')}</p>
          </details>
        )}
        {kols.isPending && <LoadingState />}
        {(kols.error || remove.error) && (
          <p role="alert" className="error-message">
            {errorMessage(kols.error || remove.error)}
          </p>
        )}
        {kols.data?.accounts.length === 0 && (
          <div className="empty-state">
            <Users size={22} />
            <h3>{t('onchain.kolEmpty')}</h3>
          </div>
        )}
        <div className="kol-account-list">
          {kolCategories.map((category) => {
            const accounts =
              kols.data?.accounts.filter((a) => (a.category || 'DAILY') === category) || [];
            return accounts.length ? (
              <div className="kol-group" key={category}>
                <div className="kol-group-heading">
                  {t(`social.category.${category}`)}
                  <span>{accounts.length}</span>
                </div>
                {accounts.map((k) => (
                  <div className={`kol-row ${active?.id === k.id ? 'is-selected' : ''}`} key={k.id}>
                    {compact ? (
                      <a
                        className="kol-account-select"
                        href={`https://x.com/${k.handle}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <RemoteImage
                          src={k.avatarUrl}
                          label={k.displayName || k.handle}
                          size={24}
                        />
                        <span className="kol-account-label">
                          <strong>{k.displayName || k.handle}</strong>
                          <small>@{k.handle}</small>
                        </span>
                      </a>
                    ) : (
                      <button
                        className="kol-account-select"
                        aria-pressed={active?.id === k.id}
                        onClick={(e) => {
                          setSelectedId(k.id);
                          e.currentTarget.closest('main')?.scrollTo(0, 0);
                        }}
                      >
                        <RemoteImage
                          src={k.avatarUrl}
                          label={k.displayName || k.handle}
                          size={24}
                        />
                        <span className="kol-account-label">
                          <strong>{k.displayName || k.handle}</strong>
                          <small>@{k.handle}</small>
                        </span>
                      </button>
                    )}
                    <div className="kol-row-actions">
                      <button
                        className="icon-button"
                        aria-label={`${t('social.edit')} @${k.handle}`}
                        onClick={(e) => {
                          returnFocus.current = e.currentTarget;
                          setEditing(k);
                        }}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`${t('onchain.remove')} @${k.handle}`}
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(k.id)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null;
          })}
        </div>
        {!compact && (
          <p className="data-caption" title={t('social.manualHint')}>
            xapi.to · {t('social.manualOnly')}
          </p>
        )}
      </section>
      {!compact && kols.data && (
        <KolTimeline
          key={active?.id}
          accounts={kols.data.accounts}
          configured={kols.data.x.configured}
          selectedId={active?.id}
          onSelect={setSelectedId}
        />
      )}
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent
          className="kol-dialog"
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            returnFocus.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {t(editing && editing !== 'add' ? 'social.edit' : 'onchain.add')}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <KolEditor
              key={editing === 'add' ? 'add' : editing.id}
              account={editing === 'add' ? undefined : editing}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
