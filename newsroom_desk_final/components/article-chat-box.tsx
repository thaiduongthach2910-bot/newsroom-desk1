"use client";

import { FormEvent, useMemo, useState } from "react";
import { LoaderCircle, SendHorizonal } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  text: string;
}

const quickPrompts = [
  "Giải thích dễ hơn",
  "Bài này thiên lệch ở đâu?",
  "Chỗ nào là fact, chỗ nào là opinion?",
  "Tác động tới Việt Nam là gì?",
];

export function ArticleChatBox({
  slug,
  articleTitle,
}: {
  slug: string;
  articleTitle: string;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: `Bạn có thể hỏi lại riêng về bài "${articleTitle}". Tôi sẽ chỉ giải thích dựa trên bài này để tránh lan man.`,
    },
  ]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit = useMemo(() => question.trim().length > 0 && !isLoading, [question, isLoading]);

  async function handleSubmit(event?: FormEvent<HTMLFormElement>, preset?: string) {
    event?.preventDefault();
    const finalQuestion = (preset ?? question).trim();
    if (!finalQuestion) return;

    setMessages((prev) => [...prev, { role: "user", text: finalQuestion }]);
    setQuestion("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug,
          question: finalQuestion,
        }),
      });

      const data = await response.json();
      setMessages((prev) => [...prev, { role: "assistant", text: data.answer || "Tôi chưa trả lời được." }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Đã có lỗi khi gọi ô chat. Hãy thử lại sau." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="paper-card rounded-[2rem] p-5 sm:p-6">
      <div className="space-y-2">
        <span className="kicker">Ask this article</span>
        <h3 className="headline-serif text-2xl font-bold">Ô chat hỏi lại bài đang mở</h3>
        <p className="text-sm leading-7 text-[var(--ink-soft)]">
          Hỏi đúng chỗ bạn chưa hiểu: bài này thực chất muốn nói gì, điểm nào cần dè chừng, hoặc tác động tới Việt Nam là gì.
        </p>
      </div>

      <div className="chat-scroll mt-5 max-h-[420px] space-y-4 overflow-y-auto rounded-[1.5rem] border border-black/10 bg-white/70 p-4">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`max-w-[92%] rounded-[1.25rem] px-4 py-3 text-sm leading-7 ${
              message.role === "assistant"
                ? "bg-[rgba(16,35,61,0.06)] text-[var(--ink-soft)]"
                : "ml-auto bg-[var(--accent-navy)] text-white"
            }`}
          >
            {message.text}
          </div>
        ))}
        {isLoading ? (
          <div className="inline-flex items-center gap-2 rounded-[1.25rem] bg-[rgba(16,35,61,0.06)] px-4 py-3 text-sm text-[var(--ink-soft)]">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Đang soạn câu trả lời...
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => handleSubmit(undefined, prompt)}
            className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-medium text-[var(--accent-navy)] transition hover:-translate-y-0.5"
          >
            {prompt}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={3}
          placeholder="Ví dụ: giải thích ý này bằng ngôn ngữ dễ hơn..."
          className="min-h-[96px] flex-1 rounded-[1.35rem] border border-black/10 bg-white/85 px-4 py-3 text-sm outline-none ring-0 placeholder:text-[var(--ink-soft)]"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center justify-center gap-2 rounded-[1.35rem] bg-[var(--accent-red)] px-5 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SendHorizonal className="h-4 w-4" />
          Hỏi ngay
        </button>
      </form>
    </section>
  );
}
