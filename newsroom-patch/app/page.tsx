import { DigestStrip } from "@/components/digest-strip";
import { Footer } from "@/components/footer";
import { HeroArticleCard, LatestListItem, StoryCard } from "@/components/article-card";
import { SectionHeading } from "@/components/section-heading";
import { TopNav } from "@/components/top-nav";
import { getHomepageData } from "@/lib/supabase";

// Trang chủ revalidate mỗi 5 phút để cron collect (chạy 30 phút/lần) kịp đẩy bài mới lên.
export const revalidate = 300;

export default async function HomePage() {
  const data = await getHomepageData();

  return (
    <main>
      <TopNav />

      <div className="page-shell space-y-10 py-8 sm:space-y-12 sm:py-10">
        {data.featured ? <HeroArticleCard article={data.featured} /> : null}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <SectionHeading
              eyebrow="Top stories"
              title="Những bài đáng đọc trước"
              description="Ưu tiên những bài có tác động rộng, cần giải thích nhiều, hoặc có ý nghĩa với dòng tiền, chính sách và địa chính trị."
            />
            <div className="grid gap-6 md:grid-cols-2">
              {data.topStories.map((article) => (
                <StoryCard key={article.id} article={article} />
              ))}
            </div>
          </div>

          <aside className="space-y-5">
            <SectionHeading
              eyebrow="Reading desk"
              title="Cách dùng dashboard"
            />
            <div className="paper-card rounded-[2rem] p-6">
              <div className="space-y-5 text-sm leading-7 text-[var(--ink-soft)]">
                <div>
                  <p className="headline-serif text-lg font-bold text-[var(--ink)]">1. Đọc theo nhịp</p>
                  <p>Đầu tiên đọc hero story, sau đó qua digest sáng, rồi mới kéo xuống dòng bài mới.</p>
                </div>
                <div>
                  <p className="headline-serif text-lg font-bold text-[var(--ink)]">2. Mở bài cần đào sâu</p>
                  <p>Trang chi tiết mới là nơi có đủ “tóm tắt + giải thích + kết luận + chat box”.</p>
                </div>
                <div>
                  <p className="headline-serif text-lg font-bold text-[var(--ink)]">3. Không bị quá tải</p>
                  <p>Hệ thống vẫn thu tất cả, nhưng giao diện chỉ ưu tiên phần cần xem trước.</p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <DigestStrip digest={data.digest} />

        <section className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <SectionHeading
              eyebrow="Latest"
              title="Dòng chảy tin mới"
              description="Bài mới lên liên tục trong ngày; bài có mức quan trọng cao sẽ tự nổi lên trước."
            />
            <div className="paper-card rounded-[2rem] px-5 sm:px-7">
              {data.latest.map((article) => (
                <LatestListItem key={article.id} article={article} />
              ))}
            </div>
          </div>

          <aside className="space-y-5">
            <SectionHeading
              eyebrow="About"
              title="Về Newsroom Desk"
            />
            <div className="paper-card rounded-[2rem] p-6">
              <div className="space-y-4 text-sm leading-7 text-[var(--ink-soft)]">
                <p>
                  Bản tin cá nhân tự động tổng hợp và phân tích tin từ{" "}
                  <strong className="text-[var(--ink)]">VnEconomy</strong> và{" "}
                  <strong className="text-[var(--ink)]">Nghiên cứu Quốc tế</strong>.
                </p>
                <p>
                  Collector chạy 30 phút/lần trong ngày. Morning Edition 06:00 sáng mỗi ngày.
                </p>
                <p>
                  Mỗi bài đều có block tóm tắt sâu + chat hỏi lại, thay vì chỉ lướt headline.
                </p>
              </div>
            </div>
          </aside>
        </section>
      </div>

      <Footer />
    </main>
  );
}
