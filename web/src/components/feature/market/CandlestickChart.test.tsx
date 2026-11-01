import { render, cleanup } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@/i18n';
import { CandlestickChart } from './CandlestickChart';
const mocks = vi.hoisted(() => {
  const range = vi.fn(),
    resize = vi.fn(),
    remove = vi.fn();
  const series = { priceScale: () => ({ applyOptions: vi.fn() }), setData: vi.fn() };
  const chart = {
    addSeries: vi.fn(() => series),
    timeScale: () => ({ setVisibleLogicalRange: range, fitContent: vi.fn() }),
    panes: () => [{ setStretchFactor: vi.fn() }, { setStretchFactor: vi.fn() }],
    subscribeCrosshairMove: vi.fn(),
    resize,
    remove,
  };
  return { range, resize, remove, chart };
});
vi.mock('lightweight-charts', () => ({
  createChart: () => mocks.chart,
  CandlestickSeries: {},
  HistogramSeries: {},
  ColorType: { Solid: 'solid' },
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('keeps a wide default time range for five candles and resizes to its container', () => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(420);
  const disconnect = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      disconnect = disconnect;
    },
  );
  const candles = Array.from({ length: 5 }, (_, i) => ({
    time: 1700000000 + i * 900,
    open: 1,
    high: 2,
    low: 0.5,
    close: 1.5,
    volumeUsd: 10,
  }));
  const view = render(
    <I18nextProvider i18n={i18n}>
      <CandlestickChart candles={candles} />
    </I18nextProvider>,
  );
  expect(mocks.range).toHaveBeenCalledWith({ from: -75, to: 10 });
  expect(mocks.resize).toHaveBeenCalledWith(640, 420);
  view.unmount();
  expect(disconnect).toHaveBeenCalled();
  expect(mocks.remove).toHaveBeenCalled();
});
