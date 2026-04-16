import Link from "next/link";
import { Footer } from "@/components/footer";
import { SectionHeading } from "@/components/section-heading";
import { TopNav } from "@/components/top-nav";
import { getArticles } from "@/lib/supabase";

function groupByDate<T extends { publishedAt: string }>(items: T[]) {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = new Date(item.publishedAt).toLocaleDateString("vi-VN");
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
}

export default async function ArchivePage() {
  const articles = await getArticles();
  const grouped = groupByDate(articles);

  return (
    <main>
      <TopNav />
      <div className="page-shell space-y-8 py-8">
        <SectionHeading
          eyebrow="Archive"
          title="Lưu trữ theo ngày"
          description="Phần này giúp bạn đọc lại tin theo từng ngày thay vì chỉ theo dòng mới nhất."
        />

        <div className="space-y-8">
          {Object.entries(grouped).map(([date, items]) => (
            <section key={date} className="paper-card rounded-[2rem] p-6 sm:p-8">
              <h2 className="headline-serif text-2xl font-bold">{date}</h2>
              <div className="mt-5 grid gap-4">
                {items.map((article) => (
                  <Link
                    key={article.id}
                    href={`/article/${article.slug}`}
                    className="rounded-[1.25rem] border border-black/10 bg-white/75 px-4 py-4 transition hover:-translate-y-0.5"
                  >
                    <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.16em] text-[var(--ink-soft)]">
                      <span>{article.sourceLabel}</span>
                      <span>{new Date(article.publishedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="mt-2 headline-serif text-xl font-bold">{article.title}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <Footer />
    </main>
  );
}
