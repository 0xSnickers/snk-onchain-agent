import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, RefreshCw, Trash2, Users } from 'lucide-react';
import type { Kol, KolCategory } from '@snk/contracts';
import { RemoteImage } from '../RemoteImage';
import { kolCategories } from './kolCategories';

type Filter = 'ALL' | KolCategory;

export function KolWatchlist({
  accounts,
  compact = false,
  selectedId,
  loaded,
  error,
  syncPending = false,
  syncSummary,
  onSyncShared,
  onSelect,
  onAdd,
  onEdit,
  onRemove,
  removePending = false,
}: {
  accounts: Kol[];
  compact?: boolean;
  loaded: boolean;
  error?: string | null;
  selectedId?: string;
  syncPending?: boolean;
  syncSummary?: string | null;
  onSyncShared?: () => void;
  onSelect: (id: string) => void;
  onAdd: (focus: HTMLButtonElement | null) => void;
  onEdit: (account: Kol, focus: HTMLButtonElement | null) => void;
  onRemove: (id: string) => void;
  removePending?: boolean;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('ALL');
  const rowsFor = (category: KolCategory) =>
    accounts.filter((account) => (account.category || 'DAILY') === category);
  const visible = kolCategories.filter((category) => {
    if (filter !== 'ALL' && filter !== category) return false;
    if (compact && rowsFor(category).length === 0) return false;
    return true;
  });
  return (
    <section className="panel kol-watchlist">
      <div className="section-heading">
        <div className="kol-desk-title">
          <h2>{t('onchain.watch')}</h2>
          {!compact && <p className="kol-desk-hint">{t('social.deskHint')}</p>}
        </div>
        <span className="badge">{accounts.length}</span>
        <button
          className="icon-button kol-add"
          aria-label={t('social.addShort')}
          title={t('onchain.add')}
          onClick={(event) => onAdd(event.currentTarget)}
        >
          <Plus size={14} />
        </button>
      </div>
      {!compact && onSyncShared && (
        <button
          type="button"
          className="kol-sync-shared"
          aria-busy={syncPending}
          disabled={syncPending}
          onClick={onSyncShared}
        >
          <RefreshCw size={13} />
          {syncPending ? t('onchain.loading') : t('social.syncShared')}
        </button>
      )}
      {syncSummary && (
        <p className="data-caption" role="status">
          {syncSummary}
        </p>
      )}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {loaded && accounts.length === 0 && (
        <div className="empty-state">
          <Users size={22} />
          <h3>{t('onchain.kolEmpty')}</h3>
        </div>
      )}
      {loaded && !compact && (
        <div className="kol-chips" aria-label={t('social.filterCategories')}>
          <button
            type="button"
            className={filter === 'ALL' ? 'kol-chip is-active' : 'kol-chip'}
            aria-pressed={filter === 'ALL'}
            onClick={() => setFilter('ALL')}
          >
            {t('social.filterAll')}
          </button>
          {kolCategories.map((category) => (
            <button
              key={category}
              type="button"
              className={filter === category ? 'kol-chip is-active' : 'kol-chip'}
              aria-pressed={filter === category}
              onClick={() => setFilter(category)}
            >
              {t(`social.category.${category}`)}
              <span>{rowsFor(category).length}</span>
            </button>
          ))}
        </div>
      )}
      {loaded && (
        <div className="kol-account-list">
          {visible.map((category) => {
            const rows = rowsFor(category);
            return (
              <div className="kol-group" key={category}>
                <h3 className="kol-group-heading">
                  {t(`social.category.${category}`)}
                  <span>{rows.length}</span>
                </h3>
                {rows.length === 0 && <p className="kol-group-empty">{t('social.groupEmpty')}</p>}
                {rows.map((account) => (
                  <KolAccountRow
                    key={account.id}
                    account={account}
                    compact={compact}
                    selected={selectedId === account.id}
                    removePending={removePending}
                    onSelect={onSelect}
                    onEdit={onEdit}
                    onRemove={onRemove}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
      {loaded && !compact && <p className="data-caption">{t('social.rosterHint')}</p>}
    </section>
  );
}

function KolAccountRow({
  account,
  compact,
  selected,
  removePending,
  onSelect,
  onEdit,
  onRemove,
}: {
  account: Kol;
  compact: boolean;
  selected: boolean;
  removePending: boolean;
  onSelect: (id: string) => void;
  onEdit: (account: Kol, focus: HTMLButtonElement | null) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();
  const label = account.displayName || account.handle;
  const status = syncStatus(account, t('social.syncStatusNever'), t('social.syncStatusError'));
  const identity = (
    <>
      <RemoteImage src={account.avatarUrl} label={label} size={22} />
      <span className="kol-account-label">
        <strong>{label}</strong>
        <small>@{account.handle}</small>
      </span>
    </>
  );
  return (
    <div className={`kol-row ${selected ? 'is-selected' : ''}`}>
      {compact ? (
        <a
          className="kol-account-select"
          href={`https://x.com/${account.handle}`}
          target="_blank"
          rel="noreferrer"
        >
          {identity}
        </a>
      ) : (
        <button
          type="button"
          className="kol-account-select"
          aria-pressed={selected}
          onClick={(event) => {
            onSelect(account.id);
            event.currentTarget.closest('main')?.scrollTo(0, 0);
          }}
        >
          {identity}
        </button>
      )}
      <div className="kol-account-meta">
        {!compact && (
          <a
            href={`https://x.com/${account.handle}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`X @${account.handle}`}
          >
            ↗
          </a>
        )}
        {account.source === 'SHARED' && (
          <span className="kol-source-badge">{t('social.sourceShared')}</span>
        )}
        <span
          className={account.syncError ? 'kol-sync-status is-error' : 'kol-sync-status'}
          title={account.syncError || t('social.lastSync')}
        >
          {status}
        </span>
      </div>
      <div className="kol-row-actions">
        <button
          type="button"
          className="icon-button"
          aria-label={`${t('social.edit')} @${account.handle}`}
          onClick={(event) => onEdit(account, event.currentTarget)}
        >
          <Pencil size={12} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={`${t('onchain.remove')} @${account.handle}`}
          disabled={removePending}
          onClick={() => onRemove(account.id)}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function syncStatus(account: Kol, never: string, failed: string) {
  if (account.syncError) return failed;
  if (!account.lastSyncedAt) return never;
  const date = new Date(account.lastSyncedAt);
  if (Number.isNaN(date.getTime())) return never;
  return date.toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
