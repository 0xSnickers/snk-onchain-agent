import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Kol, KolReportDay, KolReportSnapshot } from '@snk/contracts';
import { kolCategories } from './kolCategories';
import { KolTimeline } from './KolTimeline';
import { LoadingState } from '@/components/feedback/LoadingState';

export function KolReport({
  accounts,
  days,
  pending,
  error,
  configured,
  selectedId,
  onSelect,
}: {
  accounts: Kol[];
  days: KolReportDay[];
  pending: boolean;
  error: string | null;
  configured: boolean;
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [date, setDate] = useState('');
  const [raw, setRaw] = useState(false);
  const [showEarlier, setShowEarlier] = useState(false);
  const orderedDays = [...days].sort((a, b) => b.reportDate.localeCompare(a.reportDate));
  const active = orderedDays.find((day) => day.reportDate === date) ?? orderedDays[0];
  const selected = accounts.find((account) => account.id === selectedId);
  return (
    <section className="panel kol-report" aria-label={t('social.dailySummary')}>
      {pending && <LoadingState />}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {!pending && orderedDays.length > 0 && active && (
        <>
          <div className="kol-report-dates" role="tablist" aria-label={t('social.reportDates')}>
            {orderedDays.map((day) => (
              <button
                key={day.reportDate}
                type="button"
                role="tab"
                className={day.reportDate === active.reportDate ? 'kol-chip is-active' : 'kol-chip'}
                aria-selected={day.reportDate === active.reportDate}
                onClick={() => {
                  setDate(day.reportDate);
                  setShowEarlier(false);
                }}
              >
                {formatReportDate(day.reportDate, i18n.language)}
              </button>
            ))}
          </div>
          <ReportSnapshotView
            snapshot={active.latest}
            reportDate={active.reportDate}
            accounts={accounts}
            selectedHandle={selected?.handle}
            onSelect={onSelect}
          />
          {active.earlierCount > 0 && (
            <details
              className="kol-earlier"
              onToggle={(event) => setShowEarlier(event.currentTarget.open)}
            >
              <summary>{t('social.earlierSnapshots', { count: active.earlierCount })}</summary>
              {showEarlier &&
                active.earlier.map((snapshot) => (
                  <ReportSnapshotView
                    key={snapshot.id}
                    snapshot={snapshot}
                    reportDate={active.reportDate}
                    accounts={accounts}
                    selectedHandle={selected?.handle}
                    onSelect={onSelect}
                  />
                ))}
            </details>
          )}
        </>
      )}
      {!pending && orderedDays.length === 0 && (
        <div className="kol-day">
          <h2>{t('social.currentRoster')}</h2>
          <p className="kol-day-summary">{t('social.noReports')}</p>
        </div>
      )}
      {accounts.length > 0 && (
        <details className="kol-raw-posts" onToggle={(event) => setRaw(event.currentTarget.open)}>
          <summary>{t('social.rawPosts')}</summary>
          {raw && (
            <KolTimeline
              key={selected?.id || accounts[0]?.id}
              accounts={accounts}
              configured={configured}
              selectedId={selected?.id}
              onSelect={onSelect}
            />
          )}
        </details>
      )}
    </section>
  );
}

function ReportSnapshotView({
  snapshot,
  reportDate,
  accounts,
  selectedHandle,
  onSelect,
}: {
  snapshot: KolReportSnapshot;
  reportDate: string;
  accounts: Kol[];
  selectedHandle?: string;
  onSelect: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <article className="kol-day">
      <h2>
        {t('social.dailySummary')}
        <span>{formatReportDate(reportDate, i18n.language)}</span>
      </h2>
      <p className="kol-day-summary">{snapshot.summary || t('social.noSummary')}</p>
      {snapshot.sections.map((section) => (
        <section className="kol-report-section" key={`${snapshot.id}-${section.category}`}>
          <h3>{sectionTitle(section.label, section.category, t)}</h3>
          {section.summary && <p className="kol-section-summary">{section.summary}</p>}
          {section.highlights.length > 0 && (
            <>
              <h4>{t('social.highlights')}</h4>
              <ul>
                {section.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          )}
          {section.actions.length > 0 && (
            <>
              <h4>{t('social.actions')}</h4>
              <ul>
                {section.actions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          )}
          {section.accounts.map((account) => (
            <ReportAccount
              key={account.handle}
              account={account}
              kol={accounts.find((row) => row.handle === account.handle)}
              selected={selectedHandle === account.handle}
              onSelect={onSelect}
            />
          ))}
        </section>
      ))}
    </article>
  );
}

function ReportAccount({
  account,
  kol,
  selected,
  onSelect,
}: {
  account: KolReportSnapshot['sections'][number]['accounts'][number];
  kol?: Kol;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const name = kol?.displayName || account.handle;
  return (
    <div className={selected ? 'kol-report-account is-selected' : 'kol-report-account'}>
      <button type="button" onClick={() => kol && onSelect(kol.id)} disabled={!kol}>
        <strong>{name}</strong>
        <small>@{account.handle}</small>
      </button>
      <a
        href={account.profileUrl || `https://x.com/${account.handle}`}
        target="_blank"
        rel="noreferrer"
        aria-label={`X @${account.handle}`}
      >
        ↗
      </a>
      {account.summary && account.summary !== account.note && <p>{account.summary}</p>}
      {account.note && <p>{account.note}</p>}
      {account.projects.length > 0 && <p className="muted small">{account.projects.join(' · ')}</p>}
      {account.tweetUrls.length > 0 && (
        <p className="muted small">
          {t('social.sourceLink')}{' '}
          {account.tweetUrls.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer">
              {url.replace(/^https:\/\/(?:www\.)?(?:x|twitter)\.com\//, '')}
            </a>
          ))}
        </p>
      )}
    </div>
  );
}

function sectionTitle(label: string, category: string, t: (key: string) => string) {
  if (label) return label;
  return (kolCategories as readonly string[]).includes(category)
    ? t(`social.category.${category}`)
    : category;
}

function formatReportDate(value: string, language: string) {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  if (language.startsWith('zh')) return `${year}年${Number(month)}月${Number(day)}日`;
  return value;
}
