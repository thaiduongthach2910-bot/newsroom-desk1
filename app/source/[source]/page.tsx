import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { StoryCard } from "@/components/article-card";
import { SectionHeading } from "@/components/section-heading";
import { TopNav } from "@/components/top-nav";
import { getArticles } from "@/lib/supabase";
import { SourceKey } from "@/lib/types";

const sourceMeta: Record<SourceKey, { title: string; description: string }> = {
  vneconomy: {
    title: "VnEconomy",
    description: "Nhóm bài kinh tế, thị trường, chính sách và doanh nghiệp được gom lại để đọc theo logic tác động thực tế.",
  },
  nghiencuuquocte: {
    title: "Nghiên cứu Quốc tế",
    description: "Nhóm bài bình luận, biên dịch và phân tích chiến lược được trình bày theo cách nhấn mạnh lập luận và điểm cần dè chừng.",
  },
};

export default async function SourcePage({
  params,
}: {
  params: { source: string };
}) {
  const { source } = params;

  if (source !== "vneconomy" && source !== "nghiencuuquocte") {
    notFound();
  }

  const sourceKey = source as SourceKey;
  const articles = await getArticles(sourceKey);

  return (
    <main>
      <TopNav />
      <div className="page-shell space-y-8 py-8">
        <SectionHeading
          eyebrow="Source view"
          title={sourceMeta[sourceKey].title}
          description={sourceMeta[sourceKey].description}
        />

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {articles.map((article) => (
            <StoryCard key={article.id} article={article} compact />
          ))}
        </div>
      </div>
      <Footer />
    </main>
  );
}
