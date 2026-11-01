import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Kol } from '@snk/contracts';
import { onchainApi } from '@/services/api/onchainApi';
import { Button } from '@/components/ui/button';
import { RemoteImage } from '../RemoteImage';
import { LoadingState } from '@/components/feedback/LoadingState';
import { errorMessage } from '@/utils/format';
export function KolTimeline({
  accounts,
  configured,
  selectedId,
  onSelect,
}: {
  accounts: Kol[];
  configured: boolean;
  selectedId?: string;
  onSelect?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [selected, setSelected] = useState('');
  const [page, setPage] = useState(1);
  const section = useRef<HTMLElement>(null);
  const active = accounts.find((a) => a.id === (selectedId || selected)) || accounts[0];
  const timeline = useQuery({
    queryKey: ['kols', 'posts', active?.id],
    queryFn: () => onchainApi.kolPosts(active!.id),
    enabled: !!active,
    retry: false,
  });
  const sync = useMutation({
    mutationFn: onchainApi.syncKol,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['kols'] });
    },
  });
  const posts = timeline.data?.posts ?? [];
  const pages = Math.max(1, Math.ceil(posts.length / 10));
  const currentPage = Math.min(page, pages);
  const changePage = (next: number) => {
    setPage(next);
    section.current?.scrollIntoView({ block: 'start' });
  };
  if (!accounts.length) return null;
  return (
    <section ref={section} className="panel kol-timeline" aria-label={t('social.timeline')}>
      <div className="section-heading">
        <RemoteImage src={active.avatarUrl} label={active.displayName || active.handle} size={30} />
        <div className="kol-timeline-identity">
          <h3>{active.displayName || active.handle}</h3>
          <a
            className="quiet-link small"
            href={`https://x.com/${active.handle}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`X @${active.handle}`}
          >
            @{active.handle} ↗
          </a>
        </div>
        {!onSelect && (
          <select
            value={active.id}
            aria-label={t('social.account')}
            onChange={(e) => {
              setSelected(e.target.value);
              setPage(1);
              sync.reset();
            }}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName ? `${a.displayName} · @${a.handle}` : `@${a.handle}`}
              </option>
            ))}
          </select>
        )}
      </div>
      {!configured && <p className="wallet-notice">{t('social.keyMissing')}</p>}
      <div className="agent-toolbar">
        <Button
          variant="outline"
          aria-label={t('social.sync')}
          title={t('social.manualHint')}
          disabled={!configured || sync.isPending}
          onClick={() => sync.mutate({ id: active.id })}
        >
          {sync.isPending ? t('onchain.loading') : t('social.syncShort')}
        </Button>
        {timeline.data?.nextCursor && (
          <Button
            variant="outline"
            disabled={!configured || sync.isPending}
            onClick={() => sync.mutate({ id: active.id, more: true })}
          >
            {t('social.more')}
          </Button>
        )}
      </div>
      {(timeline.error || sync.error || timeline.data?.error) && (
        <p className="error-message" role="alert">
          {timeline.error || sync.error
            ? errorMessage(timeline.error || sync.error)
            : timeline.data?.error}
        </p>
      )}
      {timeline.isPending && <LoadingState />}
      {timeline.data && (
        <>
          <p className="data-caption">
            xapi.to · {t('social.lastSync')}:{' '}
            {timeline.data.lastSyncedAt
              ? new Date(timeline.data.lastSyncedAt).toLocaleString()
              : t('social.never')}
          </p>
          {!timeline.data.posts.length && (
            <p className="empty-small">
              {t(timeline.data.lastSyncedAt ? 'social.empty' : 'social.notSynced')}
            </p>
          )}
          <div className="kol-post-list">
            {posts.slice((currentPage - 1) * 10, currentPage * 10).map((p) => (
              <article className="kol-post" key={p.id}>
                <div className="activity-meta">
                  <RemoteImage
                    src={active.avatarUrl}
                    label={active.displayName || active.handle}
                    size={20}
                  />
                  <a
                    href={`https://x.com/${p.authorHandle}/status/${p.postId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {active.displayName || p.authorHandle} ↗
                  </a>
                  <time>
                    {p.postedAt ? new Date(p.postedAt).toLocaleString() : t('agent.unknown')}
                  </time>
                </div>
                <details className="post-content">
                  <summary>
                    <p className="post-text">{p.text}</p>
                    <span className="post-expand">{t('social.expand')}</span>
                    <span className="post-collapse">{t('social.collapse')}</span>
                  </summary>
                </details>
                <p className="muted small">
                  {t('social.likes')} {p.likes ?? '—'} · {t('social.reposts')} {p.reposts ?? '—'} ·{' '}
                  {t('social.replies')} {p.replies ?? '—'}
                </p>
              </article>
            ))}
          </div>
          {posts.length > 0 && (
            <nav className="kol-pagination" aria-label={t('social.pagination')}>
              <Button
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => changePage(currentPage - 1)}
              >
                {t('social.previousPage')}
              </Button>
              <span>
                {t('social.pageCount', { page: currentPage, pages, count: posts.length })}
              </span>
              <Button
                variant="outline"
                disabled={currentPage === pages}
                onClick={() => changePage(currentPage + 1)}
              >
                {t('social.nextPage')}
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
