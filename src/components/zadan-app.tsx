import { useEffect, useMemo, useRef, useState } from "react";
import { ChartCandlestick, Crosshair, MessageSquareText, Newspaper, Phone, Share2 } from "lucide-react";
import { CallOverlay } from "@/components/call-overlay";
import { ChatView } from "@/components/chat-view";
import { MarketView } from "@/components/market-view";
import { NewsView } from "@/components/news-view";
import { SignalView } from "@/components/signal-view";
import { askAnalyst } from "@/lib/ai";
import { analyze, minScoreFromJournal, nextHighImpact } from "@/lib/analyze";
import { useDesk } from "@/lib/desk";
import { getBoard, getCalendar, getSeries } from "@/lib/market";
import type { Board, CalEvent, Quote, Series, Signal } from "@/lib/market-types";
import { formatPriceReply, formatSignalReply, isPriceQuestion, journalSummary } from "@/lib/reply";
import { APP_VERSION, BRAND, detectSymbol, PHONE_DISPLAY, PHONE_TEL, WATCH_BY_ID } from "@/lib/symbols";

type Tab = "market" | "signal" | "chat" | "news";
type BeforeInstall = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };

function uid(): string {
  return crypto.randomUUID();
}

function speakArabic(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text.replace(/[*#]/g, " ").slice(0, 650));
    utter.lang = "ar-SA";
    utter.rate = 1;
    const voice = window.speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith("ar"));
    if (voice) utter.voice = voice;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    window.speechSynthesis.speak(utter);
  });
}

function buildSignal(quote: Quote | undefined, series: Series | undefined, events: CalEvent[], minScore: number): Signal | null {
  if (!quote || !series || series.candles.length < 20) return null;
  return analyze({ quote, candles: series.candles, nextHigh: nextHighImpact(events), minScore });
}

export function ZadanApp() {
  const [entered, setEntered] = useState(false);
  const [tab, setTab] = useState<Tab>("market");
  const [selected, setSelected] = useState("XAUUSD");
  const [board, setBoard] = useState<Board | null>(null);
  const [seriesMap, setSeriesMap] = useState<Record<string, Series>>({});
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [offline, setOffline] = useState(false);
  const [clock, setClock] = useState("");
  const [now, setNow] = useState(0);
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [toast, setToast] = useState("");
  const [sheet, setSheet] = useState<"install" | null>(null);
  const [callOpen, setCallOpen] = useState(false);
  const [callStatus, setCallStatus] = useState("يستمع");
  const [callText, setCallText] = useState("");
  const [callError, setCallError] = useState("");
  const [installEvent, setInstallEvent] = useState<BeforeInstall | null>(null);
  const desk = useDesk();
  const callAlive = useRef(false);
  const busy = useRef(false);
  const boardRef = useRef<Board | null>(null);
  const seriesRef = useRef<Record<string, Series>>({});
  const eventsRef = useRef<CalEvent[]>([]);
  boardRef.current = board;
  seriesRef.current = seriesMap;
  eventsRef.current = events;

  useEffect(() => {
    void useDesk.persist.rehydrate();
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstall);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const clockId = window.setInterval(() => {
      const current = new Date();
      setNow(current.getTime());
      setClock(
        new Intl.DateTimeFormat("ar-SY", {
          timeZone: "Asia/Damascus",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(current),
      );
    }, 1000);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.clearInterval(clockId);
    };
  }, []);

  useEffect(() => {
    let stop = false;
    async function pullBoard() {
      try {
        const next = await getBoard();
        if (stop) return;
        setBoard(next);
        setOffline(!next.online);
        if (next.quotes.length) useDesk.getState().review(next.quotes);
      } catch {
        if (!stop) setOffline(true);
      }
    }
    async function pullCalendar() {
      try {
        const next = await getCalendar();
        if (!stop) setEvents(next.events);
      } catch {
        /* calendar is optional */
      }
    }
    void pullBoard();
    void pullCalendar();
    const boardId = window.setInterval(() => void pullBoard(), 10000);
    const calendarId = window.setInterval(() => void pullCalendar(), 300000);
    return () => {
      stop = true;
      window.clearInterval(boardId);
      window.clearInterval(calendarId);
    };
  }, []);

  useEffect(() => {
    const ids = Array.from(new Set(["XAUUSD", selected]));
    let stop = false;
    async function pull(id: string) {
      try {
        const next = await getSeries({ data: { id } });
        if (!stop && next.candles.length) setSeriesMap((current) => ({ ...current, [id]: next }));
      } catch {
        /* keep the last candles */
      }
    }
    for (const id of ids) void pull(id);
    const timer = window.setInterval(() => {
      for (const id of ids) void pull(id);
    }, 45000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [selected]);

  const minScore = minScoreFromJournal(desk.journal.map((trade) => trade.result));
  const quote = board?.quotes.find((item) => item.id === selected);
  const signal = useMemo(
    () => buildSignal(quote, seriesMap[selected], events, minScore),
    [quote, seriesMap, selected, events, minScore],
  );
  const goldQuote = board?.quotes.find((item) => item.id === "XAUUSD");
  const goldSignal = useMemo(
    () => buildSignal(goldQuote, seriesMap.XAUUSD, events, minScore),
    [goldQuote, seriesMap, events, minScore],
  );

  useEffect(() => {
    const state = useDesk.getState();
    if (!state.alertsOn || !goldSignal || goldSignal.side === "wait") return;
    if (state.seenAlerts.includes(goldSignal.stamp)) return;
    state.markAlert(goldSignal.stamp);
    const text = goldSignal.side === "buy" ? "فرصة شراء على الذهب. افتح تبويب الصفقة." : "فرصة بيع على الذهب. افتح تبويب الصفقة.";
    setToast(text);
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(BRAND, { body: text, icon: "/zadan-logo.jpg" });
    }
    if (goldQuote && (goldSignal.side === "buy" || goldSignal.side === "sell")) {
      state.trackTrade({
        id: goldSignal.stamp,
        symbol: "XAUUSD",
        nameAr: "الذهب",
        side: goldSignal.side,
        entryLow: goldSignal.entryLow,
        entryHigh: goldSignal.entryHigh,
        sl: goldSignal.sl,
        tp1: goldSignal.tp1,
        tp2: goldSignal.tp2,
        openedAt: Date.now(),
        tp1Hit: false,
        result: "open",
      });
    }
  }, [goldQuote, goldSignal]);

  useEffect(() => {
    const state = useDesk.getState();
    if (!state.alertsOn) return;
    const soon = events.find((event) => event.impact === "High" && event.time > Date.now() && event.time - Date.now() < 20 * 60 * 1000);
    if (!soon || state.seenAlerts.includes(soon.id)) return;
    state.markAlert(soon.id);
    const text = `خبر قريب قد يحرّك الذهب: ${soon.titleAr}`;
    setToast(text);
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(BRAND, { body: text, icon: "/zadan-logo.jpg" });
    }
  }, [events]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function answerQuestion(question: string, voice: boolean): Promise<string> {
    const clean = question.trim();
    if (!clean) return "";
    const userId = uid();
    desk.addMessage({ id: userId, role: "user", content: clean });
    const focus = detectSymbol(clean);
    const liveBoard = boardRef.current;
    const liveQuote = liveBoard?.quotes.find((item) => item.id === focus);
    const liveSeries = seriesRef.current[focus];
    const liveEvents = eventsRef.current;
    const liveMin = minScoreFromJournal(useDesk.getState().journal.map((trade) => trade.result));
    const liveSignal = buildSignal(liveQuote, liveSeries, liveEvents, liveMin);
    let local = "أقرأ السعر والشارت الآن.";
    if (liveQuote && isPriceQuestion(clean)) local = formatPriceReply(liveQuote);
    else if (liveQuote && liveSignal) local = formatSignalReply(liveQuote, liveSignal, liveEvents);
    else if (liveQuote) local = `${formatPriceReply(liveQuote)}\nالشموع لم تكتمل بعد، والسعر نفسه محدّث.`;
    const botId = uid();
    const priceOnly = Boolean(liveQuote && isPriceQuestion(clean));
    desk.addMessage({ id: botId, role: "assistant", content: local, pending: !priceOnly });
    if (priceOnly) {
      if (voice || useDesk.getState().speakOn) void speakArabic(local);
      return local;
    }
    const history = useDesk
      .getState()
      .messages.filter((message) => message.id !== botId && message.id !== userId)
      .slice(-8)
      .map((message) => ({ role: message.role, content: message.content }));
    try {
      const result = await askAnalyst({
        data: {
          question: clean,
          history,
          journal: journalSummary(useDesk.getState().journal),
          minScore: liveMin,
        },
      });
      const finalText = result.ok ? `${local}\n\n${result.text}` : `${local}\n\n${result.error}`;
      desk.patchMessage(botId, { content: finalText, pending: false });
      if (voice || useDesk.getState().speakOn) void speakArabic(result.ok ? result.text : local);
      return result.ok ? result.text : local;
    } catch {
      const finalText = `${local}\n\nتعذر إكمال الشرح الموسّع. الأرقام أعلاه من السعر الحي.`;
      desk.patchMessage(botId, { content: finalText, pending: false });
      return local;
    }
  }

  function sendDraft() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void answerQuestion(text, false);
  }

  function listenOnce() {
    const Rec = recognitionCtor();
    if (!Rec) {
      setToast("الرسائل الصوتية تحتاج كروم على أندرويد.");
      return;
    }
    const rec = new Rec();
    rec.lang = "ar-SA";
    rec.interimResults = false;
    rec.continuous = false;
    setListening(true);
    rec.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript ?? "";
      if (text) setDraft(text);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  }

  function startCall() {
    const Rec = recognitionCtor();
    setCallOpen(true);
    setCallError("");
    setCallText("");
    if (!Rec) {
      setCallError("المكالمة الصوتية تعمل من كروم على أندرويد. تقدر تحكي كتابة من المحادثة.");
      setCallStatus("الصوت غير مدعوم هنا");
      return;
    }
    const rec = new Rec();
    rec.lang = "ar-SA";
    rec.continuous = true;
    rec.interimResults = true;
    callAlive.current = true;
    busy.current = false;
    setCallStatus("يستمع");
    rec.onresult = (event) => {
      let interim = "";
      let finalText = "";
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const piece = event.results[index]?.[0]?.transcript ?? "";
        if (event.results[index]?.isFinal) finalText += piece;
        else interim += piece;
      }
      if (interim) setCallText(interim);
      if (finalText.trim() && !busy.current) {
        busy.current = true;
        try {
          rec.stop();
        } catch {
          /* already stopped */
        }
        setCallStatus("يحلّل السوق");
        setCallText(finalText.trim());
        void answerQuestion(finalText.trim(), true).then(async (spoken) => {
          if (!callAlive.current) return;
          setCallStatus("يتكلم");
          await speakArabic(spoken);
          busy.current = false;
          if (!callAlive.current) return;
          setCallStatus("يستمع");
          try {
            rec.start();
          } catch {
            /* restart can throw if already started */
          }
        });
      }
    };
    rec.onerror = () => {
      if (callAlive.current && !busy.current) setCallStatus("يستمع");
    };
    rec.onend = () => {
      if (callAlive.current && !busy.current) {
        try {
          rec.start();
        } catch {
          /* ignore */
        }
      }
    };
    rec.start();
  }

  function hangup() {
    callAlive.current = false;
    busy.current = false;
    window.speechSynthesis?.cancel();
    setCallOpen(false);
  }

  async function shareApp() {
    const payload = { title: BRAND, text: "تطبيق زادن للذهب والفوركس", url: window.location.href };
    try {
      if (navigator.share) await navigator.share(payload);
      else {
        await navigator.clipboard.writeText(window.location.href);
        setToast("تم نسخ الرابط. أرسله لأي موبايل ويفتح من كروم.");
      }
    } catch {
      /* user cancelled share */
    }
  }

  async function enablePush() {
    if (typeof Notification === "undefined") {
      setToast("هذا المتصفح لا يدعم إشعار النظام. التنبيه الداخلي يبقى شغال.");
      return;
    }
    const permission = await Notification.requestPermission();
    setToast(permission === "granted" ? "إشعارات الهاتف صارت شغالة." : "ما انعطت صلاحية الإشعار. رح يضل التنبيه داخل التطبيق.");
  }

  function trackCurrent() {
    if (!signal || !quote || signal.side === "wait") {
      setToast(signal?.side === "wait" ? "ما في صفقة تستاهل المراقبة الآن." : "القراءة لسا ما جهزت.");
      return;
    }
    desk.trackTrade({
      id: `${signal.stamp}-manual`,
      symbol: quote.id,
      nameAr: quote.nameAr,
      side: signal.side,
      entryLow: signal.entryLow,
      entryHigh: signal.entryHigh,
      sl: signal.sl,
      tp1: signal.tp1,
      tp2: signal.tp2,
      openedAt: Date.now(),
      tp1Hit: false,
      result: "open",
    });
    setToast("انحطت الصفقة بالدفتر ورح تنقفل لحاله عند الهدف أو الوقف.");
  }

  if (!entered) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 py-10 text-center">
        <img src="/zadan-logo.jpg" alt="شعار زادن للفوركس" className="w-full max-w-sm" />
        <h1 className="mt-1 text-2xl font-extrabold tracking-wide text-gold-2">{BRAND}</h1>
        <a href={`tel:${PHONE_TEL}`} className="mt-3 text-lg font-semibold tabular-nums text-gold">
          {PHONE_DISPLAY}
        </a>
        <button type="button" onClick={() => setEntered(true)} className="mt-8 w-full max-w-xs rounded-full bg-gold px-6 py-3 text-base font-bold text-bg">
          دخول غرفة التداول
        </button>
        <button type="button" onClick={() => void shareApp()} className="mt-3 inline-flex items-center gap-2 text-sm text-gold">
          <Share2 className="size-4" />
          إرسال التطبيق لموبايل ثاني
        </button>
        <button type="button" onClick={() => setSheet("install")} className="mt-2 text-sm text-muted">
          تثبيت على أندرويد ١٠ وما فوق
        </button>
        <p className="mt-6 max-w-sm text-xs leading-5 text-muted">الإصدار {APP_VERSION}. يتحدّث وحده عند نشر نسخة جديدة، ويشتغل طالما الجهاز على الإنترنت.</p>
        {sheet === "install" ? <InstallSheet installEvent={installEvent} onClose={() => setSheet(null)} onShare={() => void shareApp()} /> : null}
      </main>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof Crosshair }[] = [
    { id: "market", label: "السوق", icon: ChartCandlestick },
    { id: "signal", label: "الصفقة", icon: Crosshair },
    { id: "chat", label: "دردشة", icon: MessageSquareText },
    { id: "news", label: "أخبار", icon: Newspaper },
  ];

  return (
    <main className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-bg/95 px-3 py-2 backdrop-blur">
        <button type="button" onClick={() => setSheet("install")} className="shrink-0" aria-label="التثبيت والمشاركة">
          <img src="/zadan-logo.jpg" alt="" className="size-12 object-contain" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold tracking-wide text-gold-2">{BRAND}</p>
          <a href={`tel:${PHONE_TEL}`} className="text-xs font-semibold tabular-nums text-gold">
            {PHONE_DISPLAY}
          </a>
        </div>
        <div className="text-end">
          <p className="flex items-center justify-end gap-1 text-xs text-muted">
            <span className={`size-2 rounded-full ${offline ? "bg-down" : "bg-up"}`} />
            {offline ? "منقطع" : "مباشر"}
          </p>
          <p className="tabular-nums text-xs text-muted">{clock || "دمشق"}</p>
        </div>
      </header>

      {!desk.bannerDismissed ? (
        <button type="button" onClick={() => void enablePush().then(() => desk.dismissBanner())} className="block w-full bg-surface px-4 py-2 text-start text-xs text-gold">
          فعّل إشعار الفرص على الذهب والأخبار العالية. اضغط هنا.
        </button>
      ) : null}

      {tab === "market" ? (
        <div className="pad-nav">
          <MarketView quotes={board?.quotes ?? []} selected={selected} series={seriesMap[selected] ?? null} onSelect={setSelected} />
        </div>
      ) : null}
      {tab === "signal" ? (
        <div className="pad-nav">
          <div className="flex gap-2 overflow-x-auto px-4 pt-3">
            {(board?.quotes ?? []).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${item.id === selected ? "border-gold text-gold" : "border-line text-muted"}`}
              >
                {item.nameAr}
              </button>
            ))}
          </div>
          <SignalView
            quote={quote ?? null}
            signal={signal}
            journal={desk.journal}
            onExplain={() => {
              const name = WATCH_BY_ID[selected]?.nameAr ?? "الذهب";
              setTab("chat");
              void answerQuestion(`اشرح لي صفقة ${name} بالتفصيل: الدخول ووقف الخسارة وجني الأرباح والمدارس الخمسة.`, false);
            }}
            onTrack={trackCurrent}
          />
        </div>
      ) : null}
      {tab === "chat" ? (
        <ChatView
          messages={desk.messages}
          draft={draft}
          listening={listening}
          onDraft={setDraft}
          onSend={sendDraft}
          onMic={listenOnce}
          onSpeak={(text) => void speakArabic(text)}
          onClear={desk.clearChat}
          onPrompt={(text) => void answerQuestion(text, false)}
          speakOn={desk.speakOn}
          onToggleSpeak={() => desk.setSpeak(!desk.speakOn)}
        />
      ) : null}
      {tab === "news" ? (
        <div className="pad-nav">
          <NewsView
            events={events}
            now={now || Date.now()}
            alertsOn={desk.alertsOn}
            onToggleAlerts={() => desk.setAlerts(!desk.alertsOn)}
            onEnablePush={() => void enablePush()}
          />
        </div>
      ) : null}

      {toast ? (
        <div className="fixed inset-x-4 bottom-24 z-30 rounded-lg border border-gold bg-surface px-4 py-3 text-sm shadow-lg">{toast}</div>
      ) : null}

      <nav className="nav-bar fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-bg">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex flex-col items-center gap-1 py-2 text-xs ${active ? "text-gold" : "text-muted"}`}>
              <Icon className="size-5" />
              {item.label}
            </button>
          );
        })}
        <button type="button" onClick={startCall} className="flex flex-col items-center gap-1 py-2 text-xs text-muted">
          <Phone className="size-5" />
          اتصال
        </button>
      </nav>

      {callOpen ? <CallOverlay status={callStatus} transcript={callText} error={callError} onHangup={hangup} /> : null}
      {sheet === "install" ? <InstallSheet installEvent={installEvent} onClose={() => setSheet(null)} onShare={() => void shareApp()} /> : null}
    </main>
  );
}

function recognitionCtor(): (new () => SpeechHandle) | null {
  if (typeof window === "undefined") return null;
  const root = window as Window & { SpeechRecognition?: new () => SpeechHandle; webkitSpeechRecognition?: new () => SpeechHandle };
  return root.SpeechRecognition ?? root.webkitSpeechRecognition ?? null;
}

type SpeechHandle = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0?: { transcript: string } }>;
};

function InstallSheet({
  installEvent,
  onClose,
  onShare,
}: {
  installEvent: BeforeInstall | null;
  onClose: () => void;
  onShare: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-bg/70" onClick={onClose}>
      <div className="w-full rounded-t-lg border border-line bg-surface px-5 py-5" onClick={(event) => event.stopPropagation()}>
        <h2 className="text-lg font-bold">التثبيت على الموبايل</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          أندرويد ما بيثبّت ملف exe. التطبيق يتنصّب من كروم على أندرويد ١٠ وآخر إصدار: القائمة، ثم «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». بعدين بيفتح متل أي برنامج، وبنفس الرابط بتبعتو لأي موبايل ثاني.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {installEvent ? (
            <button
              type="button"
              className="rounded-lg bg-gold py-3 font-semibold text-bg"
              onClick={() => void installEvent.prompt()}
            >
              تثبيت الآن
            </button>
          ) : (
            <button type="button" className="rounded-lg bg-gold py-3 font-semibold text-bg" onClick={onShare}>
              نسخ رابط الإرسال
            </button>
          )}
          <button type="button" className="rounded-lg border border-line py-3" onClick={onClose}>
            إغلاق
          </button>
        </div>
        <p className="mt-3 text-xs text-muted">الإصدار {APP_VERSION}. أي تحديث بينزل لما تنشر النسخة الجديدة وتعيد فتح التطبيق.</p>
      </div>
    </div>
  );
}
