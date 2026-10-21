import type { CalEvent, Candle, Lean, Quote, Signal, Side } from "@/lib/market-types";

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function ema(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(Number.NaN);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = avg(values.slice(0, period));
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function rsi(values: number[], period = 14): number {
  if (values.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    if (delta >= 0) gains += delta;
    else losses -= delta;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function atr(candles: Candle[], period = 14): number {
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const prev = candles[i - 1];
    trs.push(Math.max(current.h - current.l, Math.abs(current.h - prev.c), Math.abs(current.l - prev.c)));
  }
  const slice = trs.slice(-period);
  return avg(slice) || (candles.at(-1)?.c ?? 1) * 0.002;
}

type Swing = { index: number; price: number; kind: "high" | "low" };

function swings(candles: Candle[], threshold: number): Swing[] {
  const points: Swing[] = [];
  if (candles.length < 5) return points;
  let extreme = candles[0].c;
  let extremeIndex = 0;
  let dir: "up" | "down" | null = null;
  for (let i = 1; i < candles.length; i++) {
    const price = candles[i].c;
    if (dir !== "down" && extreme - price >= threshold) {
      points.push({ index: extremeIndex, price: extreme, kind: "high" });
      dir = "down";
      extreme = price;
      extremeIndex = i;
    } else if (dir !== "up" && price - extreme >= threshold) {
      points.push({ index: extremeIndex, price: extreme, kind: "low" });
      dir = "up";
      extreme = price;
      extremeIndex = i;
    } else if (dir === "down" && price < extreme) {
      extreme = price;
      extremeIndex = i;
    } else if ((dir === "up" || dir === null) && price > extreme) {
      extreme = price;
      extremeIndex = i;
    } else if (dir === null && price < extreme) {
      extreme = price;
      extremeIndex = i;
    }
  }
  return points.slice(-6);
}

export function damascusHour(now = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Damascus",
    hour: "numeric",
    hourCycle: "h23",
  }).format(now);
  return Number(hour);
}

export function sessionNow(now = new Date()): { name: string; quality: "high" | "mid" | "low" } {
  const hour = damascusHour(now);
  if (hour >= 16 && hour < 19) return { name: "تداخل لندن ونيويورك", quality: "high" };
  if (hour >= 10 && hour < 16) return { name: "جلسة لندن", quality: "high" };
  if (hour >= 19 || hour < 1) return { name: "جلسة نيويورك", quality: "mid" };
  return { name: "جلسة آسيا", quality: "low" };
}

function roundStep(symbol: string): number {
  if (symbol === "XAUUSD") return 10;
  if (symbol === "XAGUSD") return 0.5;
  if (symbol === "OILUSD") return 1;
  if (symbol === "USDJPY" || symbol === "USDTRY") return 0.5;
  return 0.005;
}

function distToRound(price: number, step: number): number {
  const rounded = Math.round(price / step) * step;
  return Math.abs(price - rounded);
}

export function minScoreFromJournal(results: Array<"win" | "loss" | "partial" | "open">): number {
  const done = results.filter((item) => item === "win" || item === "loss" || item === "partial");
  if (done.length < 5) return 5;
  const wins = done.filter((item) => item === "win" || item === "partial").length;
  const rate = wins / done.length;
  if (rate < 0.45) return 6;
  return 5;
}

export function analyze(input: {
  quote: Quote;
  candles: Candle[];
  nextHigh: CalEvent | null;
  minScore?: number;
  now?: number;
}): Signal {
  const { quote, candles } = input;
  const minScore = input.minScore ?? 5;
  const maxScore = 7;
  const now = input.now ?? Date.now();
  const session = sessionNow(new Date(now));
  const closes = candles.map((candle) => candle.c);
  const last = quote.mid;
  const ema20 = ema(closes, 20).at(-1);
  const ema50 = ema(closes, 50).at(-1);
  const rsiValue = rsi(closes);
  const atrValue = atr(candles);
  const swing = swings(candles, atrValue * 0.85);
  const highs = swing.filter((point) => point.kind === "high").slice(-2);
  const lows = swing.filter((point) => point.kind === "low").slice(-2);
  let structure = "البنية العرضية غالبة، ما في موجة واضحة.";
  let structureLean: Lean = "flat";
  if (highs.length >= 2 && lows.length >= 2) {
    const hh = highs[1].price > highs[0].price;
    const hl = lows[1].price > lows[0].price;
    const lh = highs[1].price < highs[0].price;
    const ll = lows[1].price < lows[0].price;
    if (hh && hl) {
      structure = "قمم وقيعان صاعدة: موجة دافعة صاعدة محتملة.";
      structureLean = "buy";
    } else if (lh && ll) {
      structure = "قمم وقيعان هابطة: موجة دافعة هابطة محتملة.";
      structureLean = "sell";
    } else if (hh && ll) {
      structure = "اتساع بالنطاق، الموجة التصحيحية أرجح من الدفع.";
    } else {
      structure = "تداخل قمم وقيعان، السوق تصحيحي أو عرضي.";
    }
  }
  const support = lows.at(-1)?.price ?? null;
  const resistance = highs.at(-1)?.price ?? null;

  const returns: number[] = [];
  for (let i = Math.max(1, closes.length - 30); i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const mean = avg(returns);
  const variance = avg(returns.map((value) => (value - mean) ** 2));
  const sd = Math.sqrt(variance);
  const z = sd ? (returns.at(-1)! - mean) / sd : 0;

  let lean: Lean = "flat";
  if (ema20 != null && ema50 != null && Number.isFinite(ema20) && Number.isFinite(ema50)) {
    if (last > ema20 && ema20 >= ema50) lean = "buy";
    else if (last < ema20 && ema20 <= ema50) lean = "sell";
  }
  if (lean === "flat") lean = structureLean;

  const imminent = input.nextHigh != null && input.nextHigh.time - now < 20 * 60 * 1000 && input.nextHigh.time > now;
  const trendOk =
    lean !== "flat" &&
    ema20 != null &&
    ema50 != null &&
    ((lean === "buy" && last >= ema50) || (lean === "sell" && last <= ema50));
  const distEma = ema20 != null && Number.isFinite(ema20) ? Math.abs(last - ema20) : atrValue;
  const chasing = distEma > atrValue * 1.15 || Math.abs(z) > 2;
  const pullback = distEma <= atrValue * 0.75 && !chasing;
  const rsiOk = lean === "buy" ? rsiValue >= 40 && rsiValue <= 64 : lean === "sell" ? rsiValue >= 36 && rsiValue <= 60 : false;
  const structureOk = structureLean === lean && lean !== "flat";
  const sessionOk = session.quality !== "low";
  const newsOk = !imminent;
  const quantOk = Math.abs(z) < 1.8;

  const flags = [
    { ok: trendOk, good: "الاتجاه القصير متوافق مع المتوسطات", bad: "المتوسطات غير متوافقة مع اتجاه واضح" },
    { ok: pullback, good: "السعر قرب المتوسط، ليست مطاردة", bad: chasing ? "السعر ممتد ومطاردة الدخول ضعيفة" : "السعر بعيد عن منطقة الدخول الهادئة" },
    { ok: rsiOk, good: `القوة النسبية ${rsiValue.toFixed(0)} داخل نطاق صالح`, bad: `القوة النسبية ${rsiValue.toFixed(0)} خارج النطاق المفضل` },
    { ok: structureOk, good: "بنية القمم والقيعان تؤيد الاتجاه", bad: "بنية الموجة لا تؤكد الاتجاه" },
    { ok: sessionOk, good: `${session.name} فيها سيولة أفضل`, bad: `${session.name} هادئة والحركة أقل مصداقية` },
    { ok: newsOk, good: "لا خبر عالي خلال الدقائق القادمة", bad: "خبر عالي التأثير قريب، الدخول قبل الخبر مقامرة" },
    { ok: quantOk, good: "الامتداد الكمي طبيعي", bad: "الامتداد الإحصائي مرتفع" },
  ];
  const score = flags.filter((flag) => flag.ok).length;
  const reasons = flags.filter((flag) => flag.ok).map((flag) => flag.good);
  const blockers = flags.filter((flag) => !flag.ok).map((flag) => flag.bad);
  if (candles.length < 40) blockers.unshift("عدد الشموع غير كافٍ لقراءة موثوقة");
  if (imminent && input.nextHigh) {
    blockers.unshift(`خبر قريب: ${input.nextHigh.titleAr}`);
  }

  const side: Side = candles.length >= 40 && lean !== "flat" && score >= minScore && !imminent && !chasing ? lean : "wait";

  const swingLow = support ?? last - atrValue;
  const swingHigh = resistance ?? last + atrValue;
  const entryPad = atrValue * 0.18;
  let entryLow = last - entryPad;
  let entryHigh = last + entryPad * 0.4;
  let sl = swingLow - atrValue * 0.35;
  let tp1 = last + (last - sl) * 1.6;
  let tp2 = last + (last - sl) * 2.5;
  if (lean === "sell") {
    entryLow = last - entryPad * 0.4;
    entryHigh = last + entryPad;
    sl = swingHigh + atrValue * 0.35;
    const risk = sl - last;
    tp1 = last - risk * 1.6;
    tp2 = last - risk * 2.5;
  }
  const risk = Math.abs((lean === "sell" ? entryHigh : entryLow) - sl);
  if (risk > atrValue * 2.4) {
    if (lean === "sell") sl = last + atrValue * 1.35;
    else sl = last - atrValue * 1.35;
    const tight = Math.abs(last - sl);
    if (lean === "sell") {
      tp1 = last - tight * 1.6;
      tp2 = last - tight * 2.5;
    } else {
      tp1 = last + tight * 1.6;
      tp2 = last + tight * 2.5;
    }
  }

  const nearRound = distToRound(last, roundStep(quote.id));
  const timeNote =
    nearRound < atrValue * 0.2
      ? `${session.name}. السعر ملاصق لرقم مدوّر، وهي منطقة ردة فعل زمنية شائعة.`
      : `${session.name} بتوقيت دمشق. ${
          session.quality === "high"
            ? "هذه النافذة عادة أنشط للذهب والعملات."
            : session.quality === "mid"
              ? "السيولة مقبولة، لكن الزخم أهدأ من تداخل الجلسات."
              : "جلسة آسيا أهدأ. الصفقات القوية تُفضَّل مع لندن أو نيويورك."
        }`;

  const eventNote = input.nextHigh
    ? `أقرب خبر عالي: ${input.nextHigh.titleAr} (${input.nextHigh.countryAr}). ${input.nextHigh.goldNote}`
    : "لا خبر عالي التأثير ضمن الساعات القريبة. الوزن الأساسي أخف من الفني الآن.";

  const waveNote =
    structureLean === "buy"
      ? "عدّ موجي مبسط: دفع صاعد محتمل. التأكيد يكسر آخر قمة، والإلغاء يكسر آخر قاع."
      : structureLean === "sell"
        ? "عدّ موجي مبسط: دفع هابط محتمل. التأكيد يكسر آخر قاع، والإلغاء يعود فوق آخر قمة."
        : "العد الموجي غير ناضج. التعامل معها كتصحيح أفضل من فرض موجة دافعة.";

  const schools = [
    {
      name: "التحليل الفني",
      note: `المتوسط ٢٠ ${ema20 != null && Number.isFinite(ema20) ? ema20.toFixed(quote.digits) : "—"} والمتوسط ٥٠ ${
        ema50 != null && Number.isFinite(ema50) ? ema50.toFixed(quote.digits) : "—"
      }. القوة النسبية ${rsiValue.toFixed(0)}. الدعم القريب ${support?.toFixed(quote.digits) ?? "—"} والمقاومة ${
        resistance?.toFixed(quote.digits) ?? "—"
      }.`,
    },
    { name: "التحليل الموجي", note: `${structure} ${waveNote}` },
    {
      name: "التحليل الكمي",
      note: `درجة الامتداد Z = ${z.toFixed(2)}. مدى متوسط حقيقي ${atrValue.toFixed(quote.digits)}. ${
        Math.abs(z) > 1.8 ? "الحركة ممتدة إحصائياً، انتظار عودة أفضل من اللحاق." : "التذبذب ضمن نطاق قابل للقياس."
      }`,
    },
    { name: "التحليل الزمني", note: timeNote },
    { name: "التحليل الأساسي", note: eventNote },
  ];

  const bucket = new Date(now);
  bucket.setMinutes(0, 0, 0);
  const stamp = `${quote.id}-${side}-${bucket.getTime()}`;

  return {
    symbol: quote.id,
    side,
    lean,
    score,
    maxScore,
    minScore,
    entryLow: Math.min(entryLow, entryHigh),
    entryHigh: Math.max(entryLow, entryHigh),
    sl,
    tp1,
    tp2,
    atr: atrValue,
    rsi: rsiValue,
    z,
    session: session.name,
    sessionQuality: session.quality,
    structure,
    reasons,
    blockers,
    schools,
    support,
    resistance,
    stamp,
  };
}

export function nextHighImpact(events: CalEvent[], now = Date.now()): CalEvent | null {
  return events.find((event) => event.impact === "High" && event.time > now - 5 * 60 * 1000) ?? null;
}
