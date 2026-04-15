import { DigestStrip } from "@/components/digest-strip";
import { Footer } from "@/components/footer";
import { HeroArticleCard, LatestListItem, StoryCard } from "@/components/article-card";
import { SectionHeading } from "@/components/section-heading";
import { TopNav } from "@/components/top-nav";
import { getHomepageData } from "@/lib/supabase";

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
              description="Trang chủ vẫn lưu đủ bài, nhưng dàn trang ưu tiên những bài có tác động rộng, cần giải thích nhiều, hoặc có ý nghĩa với dòng tiền, chính sách và địa chính trị."
            />
            <div className="grid gap-6 md:grid-cols-2">
              {data.topStories.map((article) => (
                <StoryCard key={article.id} article={article} />
              ))}
            </div>
          </div>

          <aside className="space-y-5">
            <SectionHeading
              eyebrow="Editorial note"
              title="Bản đọc tin kiểu newsroom"
              description="Cảm hứng thị giác lấy từ các trang báo lớn: headline serif mạnh, nhịp dàn trang bất đối xứng, ảnh bìa lớn và khối digest riêng cho bản tin sáng."
            />
            <div className="paper-card rounded-[2rem] p-6">
              <div className="grid-ink rounded-[1.4rem] border border-black/10 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent-red)]">Why this layout works</p>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--ink-soft)]">
                  <li>• Có hero story lớn để định nhịp đọc ngay từ đầu.</li>
                  <li>• Có digest sáng riêng thay vì trộn lẫn mọi bài mới.</li>
                  <li>• Có nhiều ảnh bìa và nhãn nguồn để nhìn giống một newsroom thật.</li>
                  <li>• Mỗi bài có trang riêng và ô chat, nên chiều sâu nằm ở trong bài chứ không đè nặng trang chủ.</li>
                </ul>
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
                  <p>Hệ thống vẫn thu tất cả, nhưng giao diện chỉ ưu tiên phần cần xem trước. Đây là cách chống “nhiễu thông tin”.</p>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>

      <Footer />
    </main>
  );
}
