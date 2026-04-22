import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import { Footer } from "@/components/footer";
import { TopNav } from "@/components/top-nav";
import { searchArticles } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const hits = query ? await searchArticles(query, 30) : [];

  return (
    <main>
      <TopNav />
      <div className="page-shell space-y-8 py-8">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-red)]">Search</p>
          <h1 className="headline-display mt-2 text-4xl sm:text-5xl">
            {query ? `Kết quả cho "${query}"` : "Tìm trong archive"}
          </h1>
          <p className="mt-3 text-sm text-[var(--ink-soft)]">
            {query
              ? hits.length > 0
                ? `Tìm thấy ${hits.length} bài liên quan`
                : "Không có bài nào khớp từ khóa này"
              : "Gõ từ khóa vào ô search ở đầu trang"}
          </p>
        </div>

        {hits.length > 0 ? (
          <div className="space-y-4">
            {hits.map((hit) => (
              <Link
                key={hit.article.id}
                href={`/article/${hit.article.slug}`}
                className="paper-card block rounded-[1.5rem] p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                  <span className="text-[var(--accent-red)]">{hit.article.sourceLabel}</span>
                  <span>·</span>
                  <span>
                    {new Date(hit.article.publishedAt).toLocaleDateString("vi-VN")}
                  </span>
                  <span>·</span>
                  <span>
                    {hit.article.importanceLevel === "high"
                      ? "Cao"
                      : hit.article.importanceLevel === "medium"
                        ? "Trung bình"
                        : "Thấp"}
                  </span>
                  <span>·</span>
                  <span className="rounded-full bg-[var(--paper)] px-2 py-0.5">
                    khớp ở {hit.matchSource === "title" ? "tiêu đề" : hit.matchSource === "summary" ? "tóm tắt" : "nội dung"}
                  </span>
                </div>
                <h2 className="headline-serif mt-2 text-xl font-bold text-[var(--ink)]">
                  {hit.article.title}
                </h2>
                {hit.snippet ? (
                  <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                    {hit.snippet}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        ) : query ? (
          <div className="paper-card rounded-[1.5rem] p-8 text-center">
            <SearchIcon className="mx-auto h-10 w-10 text-[var(--ink-soft)]" />
            <p className="mt-4 text-[var(--ink-soft)]">
              Không tìm thấy bài nào khớp "<strong>{query}</strong>".
            </p>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              Thử từ khóa khác, hoặc{" "}
              <Link href="/archive" className="text-[var(--accent-navy)] underline">
                xem toàn bộ archive
              </Link>
              .
            </p>
          </div>
        ) : null}
      </div>
      <Footer />
    </main>
  );
}
