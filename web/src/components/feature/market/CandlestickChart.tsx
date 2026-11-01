import { useEffect, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  type UTCTimestamp,
  type IChartApi,
} from 'lightweight-charts';
import { Maximize2 } from 'lucide-react';
import { adaptiveDecimal } from '@/utils/format';
import type { MarketCandle } from '@snk/contracts';
import { useTranslation } from 'react-i18next';
function axisStep(values: number[]) {
  let min = Infinity;
  for (const value of values) {
    const abs = Math.abs(value);
    if (abs > 0 && abs < min) min = abs;
  }
  if (!Number.isFinite(min)) return 0.000001;
  return 10 ** Math.max(Math.floor(Math.log10(min)) - 4, -18);
}
export function CandlestickChart({ candles }: { candles: MarketCandle[] }) {
  const host = useRef<HTMLDivElement>(null),
    legend = useRef<HTMLDivElement>(null),
    api = useRef<IChartApi | null>(null);
  const { t } = useTranslation();
  useEffect(() => {
    if (!host.current) return;
    const el = host.current,
      css = getComputedStyle(el);
    const color = (key: string, fallback: string) => css.getPropertyValue(key).trim() || fallback;
    const up = color('--chart-up', '#71d5b1'),
      down = color('--chart-down', '#f08c8b');
    const chart = createChart(el, {
      width: Math.max(1, el.clientWidth),
      height: Math.max(1, el.clientHeight),
      layout: {
        background: { type: ColorType.Solid, color: color('--color-card', '#11121b') },
        textColor: color('--color-muted-foreground', '#a0a4b6'),
        attributionLogo: true,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: color('--color-border', '#292b38') },
        horzLines: { color: color('--color-border', '#292b38') },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderVisible: false,
        rightOffset: 5,
        barSpacing: 6,
        minBarSpacing: 2,
      },
      localization: { priceFormatter: adaptiveDecimal },
    });
    api.current = chart;
    const priceMove = axisStep(candles.flatMap((c) => [c.open, c.high, c.low, c.close]));
    const price = chart.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      borderVisible: false,
      wickUpColor: up,
      wickDownColor: down,
      priceFormat: { type: 'custom', formatter: adaptiveDecimal, minMove: priceMove },
    });
    price.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0.08 } });
    price.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    // Separate volume pane keeps its scale from obscuring the price chart.
    const volume = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: {
          type: 'custom',
          formatter: adaptiveDecimal,
          minMove: axisStep(candles.flatMap((c) => (c.volumeUsd == null ? [] : [c.volumeUsd]))),
        },
        lastValueVisible: false,
        priceLineVisible: false,
      },
      1,
    );
    volume.setData(
      candles
        .filter((c) => c.volumeUsd !== null)
        .map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.volumeUsd!,
          color: c.close >= c.open ? up : down,
        })),
    );
    chart.panes()[0].setStretchFactor(4);
    chart.panes()[1].setStretchFactor(1);
    const showRecent = () =>
      chart
        .timeScale()
        .setVisibleLogicalRange({ from: candles.length - 80, to: candles.length + 5 });
    const resize = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) chart.resize(el.clientWidth, el.clientHeight);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    showRecent();
    const byTime = new Map(candles.map((c) => [c.time, c]));
    const update = (c: MarketCandle | undefined) => {
      if (legend.current) {
        legend.current.textContent = c
          ? `O ${adaptiveDecimal(c.open)}  H ${adaptiveDecimal(c.high)}  L ${adaptiveDecimal(c.low)}  C ${adaptiveDecimal(c.close)}`
          : '';
        legend.current.title = c
          ? `${new Date(c.time * 1000).toLocaleString()} · ${t('market.volumeUsd')} ${adaptiveDecimal(c.volumeUsd)} · ${c.open}/${c.high}/${c.low}/${c.close}`
          : '';
      }
    };
    update(candles[candles.length - 1]);
    chart.subscribeCrosshairMove((p) =>
      update(typeof p.time === 'number' ? byTime.get(p.time) : candles[candles.length - 1]),
    );
    return () => {
      observer.disconnect();
      api.current = null;
      chart.remove();
    };
  }, [candles, t]);
  return (
    <>
      <div className="candle-legend mono" ref={legend} />
      <div className="candle-stage">
        <div
          ref={host}
          className="candlestick-canvas"
          role="img"
          aria-label={t('market.chartDescription')}
        />
      </div>
      <div className="chart-footer">
        <a
          className="quiet-link small"
          href="https://www.tradingview.com/"
          target="_blank"
          rel="noreferrer"
        >
          TradingView
        </a>
        <button
          className="icon-button"
          aria-label={t('market.fitChart')}
          title={t('market.fitChart')}
          onClick={() =>
            api.current
              ?.timeScale()
              .setVisibleLogicalRange({ from: candles.length - 80, to: candles.length + 5 })
          }
        >
          <Maximize2 size={14} />
        </button>
      </div>
    </>
  );
}
