export function ChainIcon({ chain, size = 16 }: { chain: 'bsc' | 'solana'; size?: number }) {
  return (
    <img
      className="chain-icon"
      src={chain === 'solana' ? '/solana.png' : '/binance.png'}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
    />
  );
}
