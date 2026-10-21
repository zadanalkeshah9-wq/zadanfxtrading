import type { Candle } from "@/lib/market-types";

export function CandleChart({ candles }: { candles: Candle[] }) {
  const view = candles.slice(-56);
  if (view.length < 2) {
    return <p className="py-10 text-center text-sm text-muted">بانتظار الشموع من السوق…</p>;
  }
  const high = Math.max(...view.map((candle) => candle.h));
  const low = Math.min(...view.map((candle) => candle.l));
  const pad = (high - low) * 0.08 || high * 0.001;
  const top = high + pad;
  const bottom = low - pad;
  const width = 100;
  const height = 46;
  const slot = width / view.length;
  const y = (price: number) => ((top - price) / (top - bottom)) * height;
  const last = view[view.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full" role="img" aria-label="مخطط الشموع">
      <line x1="0" x2={width} y1={y(last.c)} y2={y(last.c)} stroke="var(--color-gold)" strokeWidth="0.15" strokeDasharray="0.8 0.6" />
      {view.map((candle, index) => {
        const up = candle.c >= candle.o;
        const color = up ? "var(--color-up)" : "var(--color-down)";
        const x = index * slot + slot / 2;
        const bodyTop = y(Math.max(candle.o, candle.c));
        const bodyBot = y(Math.min(candle.o, candle.c));
        return (
          <g key={candle.t}>
            <line x1={x} x2={x} y1={y(candle.h)} y2={y(candle.l)} stroke={color} strokeWidth="0.28" />
            <rect x={x - slot * 0.26} y={bodyTop} width={Math.max(slot * 0.52, 0.35)} height={Math.max(bodyBot - bodyTop, 0.35)} fill={color} />
          </g>
        );
      })}
    </svg>
  );
}
