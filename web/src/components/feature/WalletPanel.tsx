import { useState } from 'react';
import type { HoldingAsset } from '@snk/contracts';
import { useTranslation } from 'react-i18next';
import { Check, Copy, ExternalLink, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { LoadingState } from '@/components/feedback/LoadingState';
import { PreciseAmount } from './PreciseAmount';
import { HoldingsSummary } from './wallet/HoldingsSummary';
import { byKind, shortAddress, useHoldings } from './wallet/useHoldings';
import { errorMessage, usd } from '@/utils/format';

const groups = ['NATIVE', 'TOKEN', 'NFT'] as const;

export function WalletPanel({ detailed = false }: { detailed?: boolean }) {
  const { t } = useTranslation();
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);
  const holdings = useHoldings();
  const data = holdings.data;
  const [picked, setPicked] = useState<(typeof groups)[number] | null>(null);
  const mask = (value: string) => (hidden ? '••••' : value);
  async function copyAddress() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }
  return (
    <section className="wallet-board" aria-label={t('design.balance')}>
      <div className="wallet-identity panel">
        <div>
          <span className="badge">{t('onchain.delegated')}</span>
          <span className="badge">{t('onchain.assetsSource')}</span>
          <p className="eyebrow">{t('onchain.ledgerAddress')}</p>
          {data && <code className="full-address">{data.address}</code>}
        </div>
        <div className="wallet-actions">
          <button
            className="text-action"
            type="button"
            onClick={() => void holdings.refetch()}
            disabled={holdings.isFetching}
            aria-label={t('onchain.refresh')}
          >
            <RefreshCw size={14} className={holdings.isFetching ? 'spin' : undefined} />
          </button>
          <button
            className="text-action"
            type="button"
            onClick={() => void copyAddress()}
            disabled={!data}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {t(copied ? 'design.copied' : 'design.copyAddress')}
          </button>
          {data && (
            <a
              className="text-action"
              href={`https://bscscan.com/address/${data.address}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={14} />
              {t('design.explorer')}
            </a>
          )}
          <button
            className="text-action"
            type="button"
            aria-label={t(hidden ? 'design.show' : 'design.hide')}
            onClick={() => setHidden((value) => !value)}
          >
            {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>
      {holdings.isPending && <LoadingState />}
      {holdings.error && (
        <p role="alert" className="error-message">
          {errorMessage(holdings.error)}
        </p>
      )}
      {data && (
        <>
          <HoldingsSummary data={data} hidden={hidden} />
          {data.failures.length > 0 && (
            <div role="status" className="wallet-unread">
              <p className="error-message">{t('onchain.assetsPartial')}</p>
              <ul>
                {data.failures.map((failure) => (
                  <li key={failure.contractAddress}>
                    <span>{failure.name}</span>
                    {failure.note && <small>{failure.note}</small>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.assets.length === 0 && <p className="empty-small">{t('design.emptyAssets')}</p>}
          <AssetTabs
            assets={data.assets}
            picked={picked}
            onPick={setPicked}
            snapshotAt={data.holdersSnapshot?.fetchedAt}
            hidden={hidden}
            mask={mask}
          />
          {detailed && <p className="muted small wallet-session">{t('onchain.sessionHint')}</p>}
        </>
      )}
    </section>
  );
}

function AssetTabs({
  assets,
  picked,
  onPick,
  snapshotAt,
  hidden,
  mask,
}: {
  assets: HoldingAsset[];
  picked: (typeof groups)[number] | null;
  onPick: (kind: (typeof groups)[number]) => void;
  snapshotAt?: string;
  hidden: boolean;
  mask: (value: string) => string;
}) {
  const { t } = useTranslation();
  const available = groups.filter((kind) => byKind(assets, kind).length > 0);
  const kind = picked && available.includes(picked) ? picked : available[0];
  if (!kind) return null;
  const rows = byKind(assets, kind);
  return (
    <section className="asset-group" aria-label={t(`design.${groupKey(kind)}`)}>
      <div className="agent-tabs" role="tablist" aria-label={t('design.holdings')}>
        {available.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={item === kind}
            className={item === kind ? 'selected' : ''}
            onClick={() => onPick(item)}
          >
            {t(`design.${groupKey(item)}`)} {byKind(assets, item).length}
          </button>
        ))}
      </div>
      {kind === 'NFT' && snapshotAt && (
        <p className="data-caption">
          {t('design.holderSnapshot')} ·{' '}
          <time dateTime={snapshotAt}>{new Date(snapshotAt).toLocaleString()}</time>
        </p>
      )}
      <ul className="item-grid">
        {rows.map((asset) => (
          <AssetLine
            key={`${asset.kind}:${asset.contractAddress || asset.symbol}`}
            asset={asset}
            hidden={hidden}
            mask={mask}
          />
        ))}
      </ul>
    </section>
  );
}

function groupKey(kind: (typeof groups)[number]) {
  if (kind === 'NATIVE') return 'nativeGroup';
  if (kind === 'TOKEN') return 'tokenGroup';
  return 'nftGroup';
}

function AssetLine({
  asset,
  hidden,
  mask,
}: {
  asset: HoldingAsset;
  hidden: boolean;
  mask: (value: string) => string;
}) {
  const { t } = useTranslation();
  const title = [asset.name, asset.contractAddress].filter(Boolean).join(' ');
  const holders =
    asset.holders == null
      ? ''
      : t(asset.holdersConfidence === 'lower_bound' ? 'design.holdersLower' : 'design.holders', {
          count: asset.holders,
        });
  return (
    <li className={`asset-row kind-${asset.kind.toLowerCase()}`} title={title}>
      <span className="asset-mark" aria-hidden="true">
        {(asset.symbol || asset.name || '?').slice(0, 1).toUpperCase()}
      </span>
      <div className="asset-copy">
        <strong>{asset.symbol || asset.name}</strong>
        <small>
          {asset.contractAddress
            ? `${asset.name} · ${shortAddress(asset.contractAddress)}`
            : 'BNB Chain'}
        </small>
        {holders && <small className="asset-holders">{holders}</small>}
      </div>
      <div className="asset-figures">
        <strong>
          {hidden ? (
            '••••'
          ) : asset.kind === 'NFT' ? (
            asset.balance
          ) : (
            <PreciseAmount value={asset.balance} />
          )}
        </strong>
        <small>{mask(asset.valueUsd ? usd(asset.valueUsd) : '—')}</small>
      </div>
    </li>
  );
}
