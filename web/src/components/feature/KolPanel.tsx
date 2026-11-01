import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Kol } from '@snk/contracts';
import { onchainApi } from '@/services/api/onchainApi';
import { onchainKeys } from '@/hooks/useOnchain';
import { errorMessage } from '@/utils/format';
import { KolEditor } from './kol/KolEditor';
import { KolWatchlist } from './kol/KolWatchlist';
import { KolReport } from './kol/KolReport';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function KolPanel({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [editing, setEditing] = useState<Kol | 'add' | null>(null);
  const kols = useQuery({ queryKey: onchainKeys.kols, queryFn: onchainApi.kols, retry: false });
  const reports = useQuery({
    queryKey: [...onchainKeys.kols, 'reports'],
    queryFn: onchainApi.kolReports,
    enabled: !compact,
    retry: false,
  });
  const accounts = kols.data?.accounts ?? [];
  const active = accounts.find((account) => account.id === selectedId) || accounts[0];
  const remove = useMutation({
    mutationFn: onchainApi.removeKol,
    onSuccess: () => client.invalidateQueries({ queryKey: onchainKeys.kols }),
  });
  const syncShared = useMutation({
    mutationFn: onchainApi.syncSharedKols,
    onSuccess: () => client.invalidateQueries({ queryKey: onchainKeys.kols }),
  });
  const failure = kols.error || remove.error || syncShared.error;
  const openEditor = (next: Kol | 'add', focus: HTMLButtonElement | null) => {
    returnFocus.current = focus;
    setEditing(next);
  };
  return (
    <div className={compact ? 'kol-compact' : 'kol-workspace'}>
      {kols.isPending && (
        <section className="panel kol-watchlist">
          <LoadingState />
        </section>
      )}
      {!kols.isPending && (
        <KolWatchlist
          accounts={accounts}
          compact={compact}
          loaded={Boolean(kols.data)}
          error={failure ? errorMessage(failure) : null}
          selectedId={active?.id}
          syncPending={syncShared.isPending}
          syncSummary={
            syncShared.isSuccess && syncShared.data
              ? t('social.syncSharedResult', {
                  created: syncShared.data.created,
                  updated: syncShared.data.updated,
                  skipped: syncShared.data.skipped,
                })
              : null
          }
          onSyncShared={compact ? undefined : () => syncShared.mutate()}
          onSelect={setSelectedId}
          onAdd={(focus) => openEditor('add', focus)}
          onEdit={(account, focus) => openEditor(account, focus)}
          onRemove={(id) => remove.mutate(id)}
          removePending={remove.isPending}
        />
      )}
      {!compact && !kols.isPending && (
        <KolReport
          accounts={accounts}
          days={reports.data?.days ?? []}
          pending={reports.isPending}
          error={reports.error ? errorMessage(reports.error) : null}
          configured={Boolean(kols.data?.x.configured)}
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
          onCloseAutoFocus={(event) => {
            event.preventDefault();
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
