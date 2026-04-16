import Link from "next/link";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { ArticleRecord } from "@/lib/types";

const importanceTone = {
  high: "bg-[rgba(203,47,47,0.09)] text-[var(--accent-red)] border-[rgba(203,47,47,0.24)]",
  medium: "bg-[rgba(207,161,90,0.15)] text-[#8a5a18] border-[rgba(207,161,90,0.25)]",
  low: "bg-[rgba(16,35,61,0.06)] text-[var(--accent-navy)] border-[rgba(16,35,61,0.14)]",
};

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(dateString));
}

export function HeroArticleCard({ article }: { article: ArticleRecord }) {
  return (
    <Link
      href={`/article/${article.slug}`}
      className="group paper-card grid overflow-hidden rounded-[2rem] lg:grid-cols-[1.2fr_0.8fr]"
    >
      <div className="relative min-h-[360px] overflow-hidden">
        <img
          src={article.imageUrl || "/editorial-hero-1.svg"}
          alt={article.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        <div className="hero-overlay absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 space-y-4 p-6 text-white sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
              {article.sourceLabel}
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${importanceTone[article.importanceLevel]}`}>
              {article.importanceLevel === "high" ? "Đáng chú ý" : article.importanceLevel === "medium" ? "Nên đọc" : "Đọc thêm"}
            </span>
          </div>
          <h2 className="headline-display max-w-3xl text-4xl sm:text-5xl">{article.title}</h2>
          <p className="max-w-2xl text-sm leading-7 text-white/88 sm:text-base">{article.summary.summaryShort}</p>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-6 p-6 sm:p-8">
        <div className="space-y-4">
          <span className="kicker">Lead story</span>
          <p className="headline-serif text-xl font-bold">{article.summary.whatItReallySays}</p>
          <p className="line-clamp-4 text-sm leading-7 text-[var(--ink-soft)]">{article.summary.easyExplanation}</p>
        </div>

        <div className="space-y-5">
          <div className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
            <Clock3 className="h-4 w-4" />
            <span>{formatDate(article.publishedAt)}</span>
          </div>
          <div className="rounded-[1.5rem] border border-black/10 bg-[var(--paper)] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-red)]">Điểm cần nhớ</p>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">{article.summary.keyTakeaway}</p>
          </div>
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-navy)]">
            Mở bài phân tích
            <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        </div>
      </div>
    </Link>
  );
}

export function StoryCard({ article, compact = false }: { article: ArticleRecord; compact?: boolean }) {
  return (
    <Link
      href={`/article/${article.slug}`}
      className="group paper-card flex h-full flex-col overflow-hidden rounded-[1.6rem] transition hover:-translate-y-1"
    >
      <div className={compact ? "relative h-44 overflow-hidden" : "relative h-56 overflow-hidden"}>
        <img
          src={article.imageUrl || "/editorial-secondary-1.svg"}
          alt={article.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.15em] text-[var(--ink-soft)]">
          <span>{article.sourceLabel}</span>
          <span>{formatDate(article.publishedAt)}</span>
        </div>
        <h3 className={`headline-serif font-bold ${compact ? "text-xl" : "text-2xl"}`}>{article.title}</h3>
        <p className="line-clamp-3 text-sm leading-7 text-[var(--ink-soft)]">{article.summary.summaryShort}</p>
        <div className="mt-auto flex items-center justify-between border-t border-black/10 pt-4 text-sm">
          <span className={`rounded-full border px-3 py-1 font-semibold ${importanceTone[article.importanceLevel]}`}>
            {article.importanceLevel === "high" ? "Cao" : article.importanceLevel === "medium" ? "Trung bình" : "Thấp"}
          </span>
          <span className="font-medium text-[var(--accent-navy)]">Đọc tiếp</span>
        </div>
      </div>
    </Link>
  );
}

export function LatestListItem({ article }: { article: ArticleRecord }) {
  return (
    <Link
      href={`/article/${article.slug}`}
      className="group grid gap-4 border-b border-black/10 py-5 sm:grid-cols-[160px_1fr] lg:grid-cols-[190px_1fr]"
    >
      <div className="relative h-28 overflow-hidden rounded-[1.2rem]">
        <img
          src={article.imageUrl || "/editorial-secondary-2.svg"}
          alt={article.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.15em] text-[var(--ink-soft)]">
          <span>{article.sourceLabel}</span>
          <span>{formatDate(article.publishedAt)}</span>
        </div>
        <h3 className="headline-serif text-2xl font-bold">{article.title}</h3>
        <p className="line-clamp-2 text-sm leading-7 text-[var(--ink-soft)]">{article.summary.whatItReallySays}</p>
      </div>
    </Link>
  );
}
