export function CallOverlay({
  status,
  transcript,
  error,
  onHangup,
}: {
  status: string;
  transcript: string;
  error: string;
  onHangup: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg px-6 pb-8 pt-10">
      <p className="text-center text-sm tracking-widest text-gold">مكالمة غرفة التداول</p>
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="relative grid size-52 place-items-center">
          <span className="absolute inset-0 rounded-full border border-gold/40" />
          <span className="absolute inset-4 rounded-full border border-gold/70" />
          <img src="/zadan-logo.jpg" alt="" className="size-36 object-contain" />
        </div>
        <h2 className="mt-6 text-2xl font-bold">ZADAN FOREX TRADING</h2>
        <p className="mt-2 text-gold">{status}</p>
        <p className="mt-4 max-h-36 overflow-auto text-center text-sm leading-6 text-muted">{error || transcript || "احكِ عن الذهب أو عن الزوج يلي بدك يا. مثلاً: أعطيني صفقة عالذهب."}</p>
      </div>
      <button type="button" onClick={onHangup} className="mx-auto rounded-full bg-down px-8 py-3 font-semibold text-fg">
        إنهاء المكالمة
      </button>
    </div>
  );
}
