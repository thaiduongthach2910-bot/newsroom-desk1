"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Sparkles, X, Brain, Loader2 } from "lucide-react";

type AskMode = "explain" | "context" | "related_thinking";

interface Props {
  slug: string;
  children: ReactNode;
}

interface PopupState {
  visible: boolean;
  x: number;
  y: number;
  selection: string;
}

interface AnswerState {
  mode: AskMode;
  selection: string;
  loading: boolean;
  answer: string;
  error: string;
}

const MODE_LABELS: Record<AskMode, string> = {
  explain: "Giải thích đoạn này",
  context: "Bối cảnh",
  related_thinking: "Phân tích sâu",
};

const MODE_ICONS = {
  explain: BookOpen,
  context: Sparkles,
  related_thinking: Brain,
};

export function AiSelectionWrapper({ slug, children }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [popup, setPopup] = useState<PopupState>({
    visible: false,
    x: 0,
    y: 0,
    selection: "",
  });
  const [answer, setAnswer] = useState<AnswerState | null>(null);

  // Lắng selection thay đổi trong wrapper
  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setPopup((p) => ({ ...p, visible: false }));
      return;
    }

    const text = sel.toString().trim();
    if (text.length < 10 || text.length > 2000) {
      setPopup((p) => ({ ...p, visible: false }));
      return;
    }

    // Check selection nằm trong wrapper
    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer;
    if (!wrapperRef.current) return;
    const node = container.nodeType === 1 ? (container as Element) : container.parentElement;
    if (!node || !wrapperRef.current.contains(node)) {
      setPopup((p) => ({ ...p, visible: false }));
      return;
    }

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    // Vị trí popup: ngay phía trên giữa đoạn chọn
    const x = rect.left + rect.width / 2 + window.scrollX;
    const y = rect.top + window.scrollY - 8;

    setPopup({ visible: true, x, y, selection: text });
  }, []);

  useEffect(() => {
    const handler = () => {
      // Delay nhỏ để selection được finalize (đặc biệt trên mobile)
      setTimeout(handleSelectionChange, 50);
    };

    document.addEventListener("mouseup", handler);
    document.addEventListener("touchend", handler);
    document.addEventListener("selectionchange", handler);

    return () => {
      document.removeEventListener("mouseup", handler);
      document.removeEventListener("touchend", handler);
      document.removeEventListener("selectionchange", handler);
    };
  }, [handleSelectionChange]);

  const askAi = async (mode: AskMode) => {
    const selection = popup.selection;
    setPopup((p) => ({ ...p, visible: false }));
    setAnswer({ mode, selection, loading: true, answer: "", error: "" });

    try {
      const res = await fetch("/api/ai-ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, selection, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi từ AI");
      setAnswer({ mode, selection, loading: false, answer: data.answer || "", error: "" });
    } catch (err) {
      setAnswer({
        mode,
        selection,
        loading: false,
        answer: "",
        error: err instanceof Error ? err.message : "Có lỗi xảy ra",
      });
    }
  };

  return (
    <>
      <div ref={wrapperRef}>{children}</div>

      {popup.visible ? (
        <div
          className="pointer-events-auto fixed z-50 flex gap-1 rounded-full border border-black/20 bg-white/95 p-1 shadow-lg backdrop-blur"
          style={{
            left: `${popup.x}px`,
            top: `${popup.y}px`,
            transform: "translate(-50%, -100%)",
          }}
          // Ngăn click vào popup khiến mất selection
          onMouseDown={(e) => e.preventDefault()}
        >
          {(Object.keys(MODE_LABELS) as AskMode[]).map((mode) => {
            const Icon = MODE_ICONS[mode];
            return (
              <button
                key={mode}
                onClick={() => askAi(mode)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--ink)] transition hover:bg-[var(--accent-navy)] hover:text-white"
              >
                <Icon className="h-3.5 w-3.5" />
                {MODE_LABELS[mode]}
              </button>
            );
          })}
        </div>
      ) : null}

      {answer ? (
        <div
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-[1.5rem] border border-black/10 bg-white/95 p-5 shadow-2xl backdrop-blur sm:inset-x-auto sm:right-6 sm:left-auto sm:w-[480px]"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-red)]">
                AI · {MODE_LABELS[answer.mode]}
              </p>
              <p className="mt-2 line-clamp-2 text-xs italic text-[var(--ink-soft)]">
                "{answer.selection.slice(0, 140)}
                {answer.selection.length > 140 ? "…" : ""}"
              </p>
            </div>
            <button
              onClick={() => setAnswer(null)}
              className="rounded-full p-1 text-[var(--ink-soft)] hover:bg-black/5"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 max-h-[50vh] overflow-y-auto border-t border-black/10 pt-3">
            {answer.loading ? (
              <div className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang hỏi AI…
              </div>
            ) : answer.error ? (
              <p className="text-sm text-red-600">{answer.error}</p>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--ink)]">
                {answer.answer}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
