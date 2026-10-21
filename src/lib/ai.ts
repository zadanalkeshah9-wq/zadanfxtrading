import { createServerFn } from "@tanstack/react-start";
import { analyze, nextHighImpact } from "@/lib/analyze";
import { loadBoard, loadCalendar, loadSeries } from "@/lib/market";
import type { Signal } from "@/lib/market-types";
import { detectSymbol, fmtPct, fmtPrice, WATCH_BY_ID } from "@/lib/symbols";

type HistoryTurn = { role: "user" | "assistant"; content: string };

const SYSTEM = `أنت محلل غرفة ZADAN FOREX TRADING. تتكلم العربية الفصيحة البسيطة فقط، بأسلوب متداول محترف لا معلّق عام.
تتقن وتدمج عند كل إجابة لازمة: التحليل الفني، التحليل الموجي (موجات إليوت بشكل مبسط وصادق)، التحليل الكمي، التحليل الزمني للجلسات، والتحليل الأساسي للأخبار.
قواعد صارمة:
- استخدم فقط الأرقام الموجودة في لقطة السوق المرفقة. لا تخترع سعراً ولا خبراً.
- إذا طُلبت صفقة: اذكر الاتجاه (شراء أو بيع أو انتظار)، منطقة الدخول، وقف الخسارة، جني الأرباح الأول والثاني، ونقطة الإلغاء، ثم الشرح من المدارس الخمس باختصار مفيد.
- إذا كان قرار المحرك «انتظار» لا تجبر صفقة. أعطِ خطة مشروطة: ماذا يجب أن يحدث ليصبح الشراء صالحاً وماذا للبيع.
- ممنوع أن تضمن الربح أو تقول إن الصفقة بلا خسارة. التداول فيه خسارة محتملة دائماً. اذكر ذلك بجملة واحدة في إجابات الصفقات.
- إذا البيانات ناقصة قل ذلك بوضوح.
- كن سريعاً ومباشراً. بلا مقدمات مجاملة طويلة وبلا حشو.`;

let aiPaused = false;

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function buildSnapshot(input: {
  focus: string;
  boardLines: string;
  signal: Signal | null;
  candlesNote: string;
  events: string;
  journal: string;
}): string {
  const signal = input.signal;
  const plan = signal
    ? [
        `الرمز ${signal.symbol}`,
        `القرار ${signal.side === "buy" ? "شراء" : signal.side === "sell" ? "بيع" : "انتظار"}`,
        `الميل ${signal.lean}`,
        `التوافق ${signal.score}/${signal.maxScore} والحد المطلوب ${signal.minScore}`,
        `الدخول ${signal.entryLow.toFixed(3)} - ${signal.entryHigh.toFixed(3)}`,
        `وقف الخسارة ${signal.sl.toFixed(3)}`,
        `الهدف ١ ${signal.tp1.toFixed(3)}`,
        `الهدف ٢ ${signal.tp2.toFixed(3)}`,
        `ATR ${signal.atr.toFixed(4)} RSI ${signal.rsi.toFixed(1)} Z ${signal.z.toFixed(2)}`,
        `الجلسة ${signal.session}`,
        `البنية ${signal.structure}`,
        `دعم ${signal.support ?? "—"} مقاومة ${signal.resistance ?? "—"}`,
        `الأسباب: ${signal.reasons.join(" | ") || "—"}`,
        `الموانع: ${signal.blockers.join(" | ") || "—"}`,
        ...signal.schools.map((school) => `${school.name}: ${school.note}`),
      ].join("\n")
    : "لا توجد قراءة شموع كافية.";
  return [
    `الرمز المطلوب: ${input.focus} (${WATCH_BY_ID[input.focus]?.nameAr ?? input.focus})`,
    "الأسعار الفورية:",
    input.boardLines,
    input.candlesNote,
    "قراءة المحرك:",
    plan,
    "الأخبار:",
    input.events || "لا أحداث قريبة في التقويم.",
    "دفتر الصفقات على هذا الجهاز:",
    input.journal || "لا صفقات مسجّلة بعد.",
  ].join("\n");
}

async function completeWithGrok(messages: { role: string; content: string }[]): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  if (aiPaused) {
    return { ok: false, error: "الشرح الموسّع متوقف حالياً لأن رصيد الذكاء خلص. القراءة فوق من الشارت الحي وتبقى شغالة." };
  }
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "الشرح الموسّع غير متاح في هذه البيئة. القراءة فوق من الشارت الحي." };
  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.2,
        max_tokens: 900,
        messages,
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      if (response.status === 403 || detail.includes("spending-limit") || detail.includes("credits")) {
        aiPaused = true;
        return {
          ok: false,
          error: "الشرح الموسّع متوقف حالياً لأن رصيد الذكاء خلص. الأرقام والقرار فوق من الشارت الحي، بدون ما يتوقف التحديث.",
        };
      }
      return { ok: false, error: "تعذر إكمال الشرح الموسّع الآن. الأرقام فوق من السعر الحي." };
    }
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false, error: "وصل رد فارغ. اعتمد القراءة الرقمية فوق." };
    return { ok: true, text };
  } catch {
    return { ok: false, error: "انقطع الاتصال أثناء الشرح الموسّع. القراءة الرقمية فوق قائمة." };
  }
}

export const askAnalyst = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = input as { question?: unknown; history?: unknown; journal?: unknown; minScore?: unknown };
    if (!body || typeof body.question !== "string" || body.question.trim().length < 1) {
      throw new Error("اكتب سؤالاً");
    }
    const history: HistoryTurn[] = [];
    if (Array.isArray(body.history)) {
      for (const turn of body.history.slice(-8)) {
        const row = turn as { role?: unknown; content?: unknown };
        if ((row.role === "user" || row.role === "assistant") && typeof row.content === "string") {
          history.push({ role: row.role, content: clip(row.content, 1200) });
        }
      }
    }
    const journal = typeof body.journal === "string" ? clip(body.journal, 800) : "";
    const minScore = body.minScore === 6 ? 6 : 5;
    return { question: clip(body.question, 2000), history, journal, minScore };
  })
  .handler(async ({ data }) => {
    const focus = detectSymbol(data.question);
    const [board, calendar] = await Promise.all([loadBoard(), loadCalendar()]);
    let seriesNote = "الشموع غير متاحة.";
    let signal: Signal | null = null;
    const quote = board.quotes.find((item) => item.id === focus) ?? null;
    try {
      const series = await loadSeries(focus);
      seriesNote = `${series.note} عدد الشموع ${series.candles.length}.`;
      if (quote && series.candles.length >= 20) {
        signal = analyze({
          quote,
          candles: series.candles,
          nextHigh: nextHighImpact(calendar.events),
          minScore: data.minScore,
        });
      }
    } catch {
      seriesNote = "تعذر قراءة الشموع هذه اللحظة.";
    }
    const boardLines = board.quotes
      .map((item) => `${item.nameAr} ${item.id} شراء ${fmtPrice(item.bid, item.digits)} بيع ${fmtPrice(item.ask, item.digits)} اليوم ${fmtPct(item.changePct)}`)
      .join("\n");
    const events = calendar.events
      .slice(0, 8)
      .map((event) => {
        const when = new Intl.DateTimeFormat("ar-SY", {
          timeZone: "Asia/Damascus",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(event.time);
        return `${when} | ${event.countryAr} | ${event.impact === "High" ? "عالي" : "متوسط"} | ${event.titleAr} | السابق ${event.previous} المتوقع ${event.forecast}`;
      })
      .join("\n");
    const snapshot = buildSnapshot({
      focus,
      boardLines,
      signal,
      candlesNote: seriesNote,
      events,
      journal: data.journal,
    });
    const completion = await completeWithGrok([
      { role: "system", content: SYSTEM },
      { role: "system", content: snapshot },
      ...data.history.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: "user", content: data.question },
    ]);
    if (!completion.ok) return { ok: false as const, error: completion.error, focus, signal };
    return { ok: true as const, text: completion.text, focus, signal };
  });
