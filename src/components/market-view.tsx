import { CandleChart } from "@/components/candle-chart";
import type { Quote, Series } from "@/lib/market-types";
import { fmtPct, fmtPrice } from "@/lib/symbols";

export function MarketView({
  quotes,
  selected,
  series,
  onSelect,
}: {
  quotes: Quote[];
  selected: string;
  series: Series | null;
  onSelect: (id: string) => void;
}) {
  const focus = quotes.find((quote) => quote.id === selected) ?? quotes[0];
  if (!focus) {
    return <p className="px-5 py-16 text-center text-muted">يتم الاتصال بالسوق…</p>;
  }
  const up = (focus.changePct ?? 0) >= 0;

  return (
    <div className="flex flex-col gap-5 px-4 pt-4">
      <section className="border-b border-line pb-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted">{focus.nameAr}</p>
            <h2 className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-gold-2">{fmtPrice(focus.mid, focus.digits)}</h2>
            <p className="mt-1 text-sm text-muted">{focus.unit || focus.id}</p>
          </div>
          <p className={`text-lg font-semibold tabular-nums ${up ? "text-up" : "text-down"}`}>{fmtPct(focus.changePct)}</p>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="شراء" value={fmtPrice(focus.bid, focus.digits)} />
          <Stat label="بيع" value={fmtPrice(focus.ask, focus.digits)} />
          <Stat label="السبريد" value={fmtPrice(focus.spread, focus.digits)} />
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-base font-semibold">الشارت</h3>
          <p className="text-xs text-muted">{series?.note ?? "تُحدَّث الشموع كل دقيقة"}</p>
        </div>
        <CandleChart candles={series?.candles ?? []} />
      </section>

      <section>
        <h3 className="mb-2 text-base font-semibold">الشريط</h3>
        <ul className="divide-y divide-line border-y border-line">
          {quotes.map((quote) => {
            const positive = (quote.changePct ?? 0) >= 0;
            const active = quote.id === focus.id;
            return (
              <li key={quote.id}>
                <button
                  type="button"
                  onClick={() => onSelect(quote.id)}
                  className={`flex w-full items-center gap-3 py-3 text-start ${active ? "text-gold-2" : ""}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{quote.nameAr}</span>
                    <span className="text-xs text-muted">{quote.id}</span>
                  </span>
                  <span className="tabular-nums font-semibold">{fmtPrice(quote.mid, quote.digits)}</span>
                  <span className={`w-16 text-end text-sm tabular-nums ${positive ? "text-up" : "text-down"}`}>
                    {fmtPct(quote.changePct)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface px-2 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
