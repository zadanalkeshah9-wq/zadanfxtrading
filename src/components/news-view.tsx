import type { CalEvent } from "@/lib/market-types";

function whenLabel(time: number, now: number): string {
  const diff = time - now;
  const mins = Math.round(diff / 60000);
  if (mins > 0 && mins < 180) return `بعد ${mins} د`;
  if (mins < 0 && mins > -180) return `منذ ${Math.abs(mins)} د`;
  return new Intl.DateTimeFormat("ar-SY", {
    timeZone: "Asia/Damascus",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

export function NewsView({
  events,
  now,
  alertsOn,
  onToggleAlerts,
  onEnablePush,
}: {
  events: CalEvent[];
  now: number;
  alertsOn: boolean;
  onToggleAlerts: () => void;
  onEnablePush: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <section className="rounded-lg border border-line bg-surface px-4 py-4">
        <h2 className="text-lg font-bold">رادار الأخبار</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          يراقب الأخبار عالية التأثير على الدولار والذهب، ويقدّر الميل التاريخي قبل صدورها. التنبيه يطلع والتطبيق مفتوح أو مثبّت والإشعارات مفعّلة.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={onToggleAlerts} className="rounded-lg bg-gold px-3 py-3 text-sm font-semibold text-bg">
            {alertsOn ? "التنبيهات شغالة" : "تشغيل التنبيهات"}
          </button>
          <button type="button" onClick={onEnablePush} className="rounded-lg border border-line px-3 py-3 text-sm font-semibold">
            إشعار الهاتف
          </button>
        </div>
      </section>

      {events.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">التقويم غير متاح حالياً. أعد المحاولة بعد لحظات.</p>
      ) : (
        <ol className="relative border-s border-line ps-4">
          {events.map((event) => {
            const soon = event.time - now < 30 * 60 * 1000 && event.time > now;
            return (
              <li key={event.id} className="mb-4">
                <span className={`absolute -start-1.5 mt-1.5 size-3 rounded-full ${event.impact === "High" ? "bg-gold" : "bg-line"}`} />
                <p className="text-xs text-muted">
                  {whenLabel(event.time, now)} · {event.countryAr} · {event.impact === "High" ? "تأثير عالي" : "تأثير متوسط"}
                  {soon ? " · قريب" : ""}
                </p>
                <h3 className="mt-1 font-semibold">{event.titleAr}</h3>
                {event.titleAr !== event.title ? <p className="text-xs text-muted">{event.title}</p> : null}
                <p className="mt-1 text-sm tabular-nums text-muted">
                  السابق {event.previous} · المتوقع {event.forecast}
                </p>
                <p className="mt-2 text-sm leading-6">{event.goldNote}</p>
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-xs leading-5 text-muted">الميل التاريخي ليس توقعاً مضموناً. الخبر يفاجئ، والخطة تكون حدّين: ردة فوق الرقم وردة تحته.</p>
    </div>
  );
}
