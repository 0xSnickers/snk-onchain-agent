import type { WalletHoldings } from '@snk/contracts';
import { useTranslation } from 'react-i18next';
import { PreciseAmount } from '../PreciseAmount';
import { usd } from '@/utils/format';

export function HoldingsSummary({
  data,
  hidden,
  showAddress = false,
}: {
  data: WalletHoldings;
  hidden: boolean;
  showAddress?: boolean;
}) {
  const { t } = useTranslation();
  const native = data.assets.find((asset) => asset.kind === 'NATIVE');
  const mask = (value: string) => (hidden ? '••••' : value);
  const tokens = data.assets.filter((asset) => asset.kind === 'TOKEN').length;
  const nfts = data.assets.filter((asset) => asset.kind === 'NFT').length;
  return (
    <div className="wallet-summary">
      <div className="wallet-total">
        <span className="eyebrow">{t('design.priced')}</span>
        <strong className="balance-total">
          {mask(native?.valueUsd ? usd(native.valueUsd) : '—')}
        </strong>
        <p className="wallet-native">
          BNB {hidden ? '••••' : <PreciseAmount value={native?.balance} />}
        </p>
        {showAddress && <code className="full-address">{data.address}</code>}
        <p className="muted small">{t('onchain.assetsNote')}</p>
      </div>
      <p className="desk-metric">
        <span>{t('design.tokenGroup')}</span>
        <strong>{tokens}</strong>
      </p>
      <p className="desk-metric">
        <span>{t('design.nftGroup')}</span>
        <strong>{nfts}</strong>
      </p>
      <p className="desk-metric">
        <span>{t('design.unread')}</span>
        <strong>{data.failures.length}</strong>
      </p>
    </div>
  );
}
