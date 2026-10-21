import type { JournalTrade } from "@/lib/desk";
import type { Quote, Signal } from "@/lib/market-types";
import { fmtPrice, WATCH_BY_ID } from "@/lib/symbols";

export function SignalView({
  quote,
  signal,
  journal,
  onExplain,
  onTrack,
}: {
  quote: Quote | null;
  signal: Signal | null;
  journal: JournalTrade[];
  onExplain: () => void;
  onTrack: () => void;
}) {
  if (!quote || !signal) {
    return <p className="px-5 py-16 text-center text-muted">تُبنى القراءة بعد وصول الشموع…</p>;
  }
  const px = (value: number) => fmtPrice(value, quote.digits);
  const closed = journal.filter((trade) => trade.result !== "open");
  const wins = closed.filter((trade) => trade.result === "win" || trade.result === "partial").length;
  const rate = closed.length ? Math.round((wins / closed.length) * 100) : null;
  const tone = signal.side === "buy" ? "text-up" : signal.side === "sell" ? "text-down" : "text-gold";
  const title = signal.side === "buy" ? "شراء" : signal.side === "sell" ? "بيع" : "انتظار";

  return (
    <div className="flex flex-col gap-5 px-4 pt-4">
      <section className="rounded-lg border border-line bg-surface px-4 py-4">
        <p className="text-sm text-muted">{WATCH_BY_ID[quote.id]?.nameAr ?? quote.id}</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <h2 className={`text-4xl font-extrabold ${tone}`}>{title}</h2>
          <p className="text-end text-sm text-muted">
            توافق {signal.score}/{signal.maxScore}
            <span className="mt-1 block">الحد الحالي {signal.minScore}</span>
          </p>
        </div>
        <div className="mt-3 flex gap-1">
          {Array.from({ length: signal.maxScore }, (_, index) => (
            <span key={index} className={`h-1.5 flex-1 rounded-full ${index < signal.score ? "bg-gold" : "bg-line"}`} />
          ))}
        </div>
        <p className="mt-3 text-sm leading-6 text-muted">{signal.structure}</p>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <Level label="منطقة الدخول" value={`${px(signal.entryLow)} – ${px(signal.entryHigh)}`} />
        <Level label="وقف الخسارة" value={px(signal.sl)} />
        <Level label="الهدف الأول" value={px(signal.tp1)} />
        <Level label="الهدف الثاني" value={px(signal.tp2)} />
      </section>
      {signal.side === "wait" ? (
        <p className="text-sm leading-6 text-muted">
          الخطة أعلاه مشروطة وليست أمراً بالدخول. المحرك يرفض الصفقة الضعيفة حتى تبقى الاحتمالات لصالحك، بدون أي ضمان.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onExplain} className="rounded-lg bg-gold px-3 py-3 font-semibold text-bg">
          اشرح الصفقة
        </button>
        <button type="button" onClick={onTrack} className="rounded-lg border border-gold px-3 py-3 font-semibold text-gold">
          راقبها في الدفتر
        </button>
      </div>

      <section>
        <h3 className="mb-2 font-semibold">المدارس</h3>
        <ul className="flex flex-col gap-2">
          {signal.schools.map((school) => (
            <li key={school.name} className="rounded-lg border border-line px-3 py-3">
              <p className="text-sm font-semibold text-gold">{school.name}</p>
              <p className="mt-1 text-sm leading-6 text-fg/90">{school.note}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg bg-surface-2 px-3 py-3 text-sm leading-6">
        <p className="font-semibold">دفتر التعلم على جهازك</p>
        <p className="mt-1 text-muted">
          {closed.length
            ? `${wins} من ${closed.length} انتهت ربحاً أو جزئياً (${rate}%). إذا ضعفت النتائج يرفع المحرك حد الدخول تلقائياً.`
            : "لما تنراقب صفقة ويوصل السعر للهدف أو الوقف، يتعلم المحرك من النتيجة ويصير أكثر انتقاءً."}
        </p>
        <ul className="mt-3 divide-y divide-line">
          {journal.slice(0, 6).map((trade) => (
            <li key={trade.id} className="flex items-center justify-between py-2 tabular-nums">
              <span>
                {trade.nameAr} · {trade.side === "buy" ? "شراء" : "بيع"}
              </span>
              <span className={trade.result === "loss" ? "text-down" : trade.result === "open" ? "text-gold" : "text-up"}>
                {trade.result === "win" ? "ربح" : trade.result === "loss" ? "خسارة" : trade.result === "partial" ? "جزئي" : "مفتوحة"}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-xs leading-5 text-muted">
        تحليل تعليمي من قراءة الشارت والأخبار. لا أحد يستطيع ضمان صفقة بلا خسارة، والتطبيق يقول «انتظار» عندما تكون الجودة ضعيفة.
      </p>
    </div>
  );
}

function Level({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line px-3 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  );
}
