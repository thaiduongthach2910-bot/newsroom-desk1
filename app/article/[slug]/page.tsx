import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ArticleChatBox } from "@/components/article-chat-box";
import { Footer } from "@/components/footer";
import { StoryCard } from "@/components/article-card";
import { TopNav } from "@/components/top-nav";
import { getArticleBySlug, getArticles } from "@/lib/supabase";

function renderParagraphs(text: string) {
  return text.split("\n").filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>);
}

export default async function ArticlePage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;
  const article = await getArticleBySlug(slug);

  if (!article) notFound();

  const related = (await getArticles())
    .filter((item) => item.slug !== article.slug)
    .slice(0, 3);

  return (
    <main>
      <TopNav />
      <div className="page-shell space-y-8 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent-navy)]">
          <ArrowLeft className="h-4 w-4" />
          Quay lại trang chủ
        </Link>

        <article className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-8">
            <section className="paper-card overflow-hidden rounded-[2rem]">
              <div className="relative h-[320px] sm:h-[420px]">
                <img
                  src={article.imageUrl || "/editorial-hero-2.svg"}
                  alt={article.title}
                  className="h-full w-full object-cover"
                />
                <div className="hero-overlay absolute inset-0" />
                <div className="absolute inset-x-0 bottom-0 space-y-4 p-6 text-white sm:p-8">
                  <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
                    {article.sourceLabel}
                  </span>
                  <h1 className="headline-display max-w-4xl text-4xl sm:text-5xl lg:text-6xl">
                    {article.title}
                  </h1>
                </div>
              </div>

              <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-5 news-grid-line pr-0 lg:pr-8">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-red)]">Tóm tắt ngắn</p>
                    <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{article.summary.summaryShort}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-red)]">Bài thực chất muốn nói gì</p>
                    <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{article.summary.whatItReallySays}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-red)]">Vì sao quan trọng</p>
                    <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{article.summary.whyItMatters}</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-red)]">Giải thích dễ hiểu</p>
                    <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{article.summary.easyExplanation}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[1.35rem] border border-black/10 bg-[var(--paper)] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-red)]">Điểm cần nhớ</p>
                      <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">{article.summary.keyTakeaway}</p>
                    </div>
                    <div className="rounded-[1.35rem] border border-black/10 bg-[var(--paper)] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-red)]">Điểm cần dè chừng</p>
                      <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">{article.summary.cautionNote}</p>
                    </div>
                  </div>
                  <div className="rounded-[1.35rem] border border-black/10 bg-white/75 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-red)]">Kết luận</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">{article.summary.conclusionText}</p>
                  </div>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-navy)]"
                  >
                    Xem bài gốc
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </section>

            <section className="paper-card rounded-[2rem] p-6 sm:p-8">
              <span className="kicker">Full context</span>
              <div className="article-prose mt-6 max-w-none">
                <h3>Nội dung nền đã lấy về</h3>
                {renderParagraphs(article.content)}
              </div>
            </section>

            <ArticleChatBox slug={article.slug} articleTitle={article.title} />
          </div>

          <aside className="space-y-6">
            <div className="paper-card rounded-[2rem] p-6">
              <span className="kicker">Article memo</span>
              <div className="mt-4 space-y-4 text-sm leading-7 text-[var(--ink-soft)]">
                <p>
                  <strong className="text-[var(--ink)]">Nguồn:</strong> {article.sourceLabel}
                </p>
                <p>
                  <strong className="text-[var(--ink)]">Loại bài:</strong>{" "}
                  {article.articleType === "opinion_translation" ? "Bình luận / biên dịch" : "Tin / phân tích"}
                </p>
                <p>
                  <strong className="text-[var(--ink)]">Mức độ quan trọng:</strong>{" "}
                  {article.importanceLevel === "high"
                    ? "Cao"
                    : article.importanceLevel === "medium"
                      ? "Trung bình"
                      : "Thấp"}
                </p>
                <p>
                  <strong className="text-[var(--ink)]">Giờ đăng:</strong>{" "}
                  {new Date(article.publishedAt).toLocaleString("vi-VN")}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <span className="kicker">Đọc tiếp</span>
              {related.map((item) => (
                <StoryCard key={item.id} article={item} compact />
              ))}
            </div>
          </aside>
        </article>
      </div>
      <Footer />
    </main>
  );
}
