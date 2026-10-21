import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/desk";

function RichText({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-1.5 text-sm leading-6">
      {text.split("\n").map((line, index) => {
        if (!line.trim()) return <span key={index} className="h-1" />;
        return <p key={index}>{inline(line)}</p>;
      })}
    </div>
  );
}

function inline(line: string) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-gold-2">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

export function ChatView({
  messages,
  draft,
  listening,
  onDraft,
  onSend,
  onMic,
  onSpeak,
  onClear,
  onPrompt,
  speakOn,
  onToggleSpeak,
}: {
  messages: ChatMessage[];
  draft: string;
  listening: boolean;
  onDraft: (value: string) => void;
  onSend: () => void;
  onMic: () => void;
  onSpeak: (text: string) => void;
  onClear: () => void;
  onPrompt: (text: string) => void;
  speakOn: boolean;
  onToggleSpeak: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const prompts = ["أعطني صفقة على الذهب", "وين دعم ومقاومة الذهب؟", "حلّل اليورو دولار", "شو أخبار اليوم بتأثر عالذهب؟"];

  return (
    <div className="room flex flex-col">
      <div className="chat-watermark flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-4">
        <div className="flex items-center justify-between">
          <button type="button" onClick={onToggleSpeak} className="text-xs text-gold">
            {speakOn ? "الرد الصوتي شغّال" : "تشغيل الرد الصوتي"}
          </button>
          {messages.length > 0 ? (
            <button type="button" onClick={onClear} className="text-xs text-muted">
              مسح
            </button>
          ) : null}
        </div>
        {messages.length === 0 ? (
          <div className="mt-6 rounded-lg border border-line bg-bg/80 px-4 py-4">
            <p className="font-semibold">اسأل عن الذهب أو أي زوج.</p>
            <p className="mt-1 text-sm leading-6 text-muted">صفقة، دعم ومقاومة، خبر، أو مقارنة بين المدارس. الجواب يقرأ السعر الحالي قبل ما يكتب.</p>
            <div className="mt-3 flex flex-col gap-2">
              {prompts.map((prompt) => (
                <button key={prompt} type="button" onClick={() => onPrompt(prompt)} className="rounded-lg border border-line bg-surface px-3 py-2 text-start text-sm">
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={`max-w-[92%] rounded-lg px-3 py-2 ${
                message.role === "user" ? "self-start bg-gold text-bg" : "self-end border border-line bg-bg/85"
              }`}
            >
              <RichText text={message.content} />
              {message.pending ? <p className="mt-2 text-xs text-gold">يكمل الشرح من الشارت…</p> : null}
              {message.role === "assistant" && !message.pending ? (
                <button type="button" onClick={() => onSpeak(message.content)} className="mt-2 text-xs font-semibold text-gold">
                  اسمع الجواب
                </button>
              ) : null}
            </article>
          ))
        )}
        <div ref={endRef} />
      </div>
      <form
        className="flex items-end gap-2 border-t border-line bg-bg px-3 py-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <button type="button" onClick={onMic} className={`grid size-11 shrink-0 place-items-center rounded-full border ${listening ? "border-gold bg-gold text-bg" : "border-line"}`} aria-label="رسالة صوتية">
          <MicIcon />
        </button>
        <textarea
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          rows={1}
          placeholder="اكتب سؤالك عن السوق"
          className="max-h-28 min-h-11 flex-1 resize-none rounded-lg border border-line bg-surface px-3 py-2 outline-none"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
        />
        <button type="submit" className="grid size-11 shrink-0 place-items-center rounded-full bg-gold text-bg" aria-label="إرسال">
          <SendIcon />
        </button>
      </form>
    </div>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
