import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExecutorSession } from '@snk/contracts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ExecutorEditor } from './ExecutorEditor';
export function ExecutorManager({ sessions }: { sessions: ExecutorSession[] }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<ExecutorSession | null | undefined>();
  const trigger = useRef<HTMLElement | null>(null);
  const open = (account: ExecutorSession | null) => {
    trigger.current = document.activeElement as HTMLElement;
    setSelected(account);
  };
  return (
    <>
      <Button variant="outline" onClick={() => open(null)}>
        {t('delegation.add')}
      </Button>
      <div className="item-grid">
        {sessions.map((s) => (
          <article className="candidate-row" key={s.id}>
            <div className="activity-meta">
              <strong>
                {s.label || s.id} · {s.id}
              </strong>
              <span className="badge">{t(`delegation.${s.role}`)}</span>
              {s.isDefault && <span className="badge">{t('delegation.defaultTag')}</span>}
            </div>
            <p className="muted small">
              {t(
                s.paused
                  ? 'delegation.pausedStatus'
                  : !s.heartbeatAt
                    ? 'delegation.waitingHeartbeat'
                    : s.online
                      ? 'delegation.online'
                      : 'delegation.offline',
              )}
            </p>
            {s.agentId && (
              <p className="muted small">
                {t('delegation.agentId')}: {s.agentId}
              </p>
            )}
            {!!s.sourceRoles?.length && (
              <p className="muted small">
                {t('delegation.sourceRoles')}:{' '}
                {s.sourceRoles.map((r) => t(`delegation.${r}`)).join(' · ')}
              </p>
            )}
            <code className="full-address">{s.walletScope}</code>
            <Button
              variant="ghost"
              onClick={() => open(s)}
              aria-label={`${t('delegation.edit')} ${s.id}`}
            >
              {t('delegation.edit')}
            </Button>
          </article>
        ))}
      </div>
      <Dialog
        open={selected !== undefined}
        onOpenChange={(value) => {
          if (!value) setSelected(undefined);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            trigger.current?.focus();
          }}
        >
          <DialogTitle>{t(selected ? 'delegation.edit' : 'delegation.add')}</DialogTitle>
          <DialogDescription>{t('delegation.manageHint')}</DialogDescription>
          {selected !== undefined && (
            <ExecutorEditor account={selected || undefined} onDone={() => setSelected(undefined)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
