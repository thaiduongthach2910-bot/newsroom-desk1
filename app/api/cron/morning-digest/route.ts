import { NextResponse } from "next/server";
import { getArticles, storeDigest } from "@/lib/supabase";
import { ArticleRecord, DailyDigest } from "@/lib/types";

export const maxDuration = 30;

function authorized(request: Request) {
  const header = request.headers.get("x-cron-secret");
  const secret = process.env.CRON_SECRET;
  return !!secret && header === secret;
}

function formatDateVi(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function pickForDigest(articles: ArticleRecord[]): ArticleRecord[] {
  const now = Date.now();
  const horizon = 30 * 60 * 60 * 1000; // 30 giờ — đủ rộng để bắt cả bài đêm qua

  // Ưu tiên: bài trong 30h, score cao, mỗi nguồn ít nhất 1 bài
  const recent = articles.filter(
    (a) => now - new Date(a.publishedAt).getTime() <= horizon
  );

  const pool = recent.length > 0 ? recent : articles;
  const sorted = [...pool].sort(
    (a, b) => (b.importanceScore || 0) - (a.importanceScore || 0)
  );

  const picked: ArticleRecord[] = [];
  const seenSources = new Set<string>();

  // Bước 1: lấy bài top từ mỗi nguồn (đảm bảo cân bằng)
  for (const article of sorted) {
    if (seenSources.has(article.source)) continue;
    picked.push(article);
    seenSources.add(article.source);
    if (picked.length >= 2) break;
  }

  // Bước 2: lấp tới 4 bài tổng từ pool còn lại
  for (const article of sorted) {
    if (picked.find((p) => p.slug === article.slug)) continue;
    picked.push(article);
    if (picked.length >= 4) break;
  }

  return picked;
}

function buildDigest(articles: ArticleRecord[]): DailyDigest {
  const today = new Date();
  const dateString = today.toISOString().slice(0, 10);
  const picked = pickForDigest(articles);

  const sourceLabels = Array.from(new Set(picked.map((a) => a.sourceLabel))).join(
    " · "
  );

  return {
    date: dateString,
    title: `Morning Edition · ${formatDateVi(today)}`,
    intro: picked.length
      ? `Bản tin sáng chọn ${picked.length} bài đáng đọc nhất từ ${sourceLabels}. Mục tiêu là vào việc nhanh, không lướt theo dòng thời gian.`
      : "Hôm nay chưa có bài mới đủ điểm để vào digest. Quay lại sau khi cron collect chạy thêm vài lượt.",
    articleSlugs: picked.map((a) => a.slug),
    items: picked.map((a) => ({
      slug: a.slug,
      title: a.title,
      sourceLabel: a.sourceLabel,
    })),
  };
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const articles = await getArticles();
    const digest = buildDigest(articles);

    if (digest.articleSlugs.length === 0) {
      return NextResponse.json({
        ok: true,
        mode: "skipped",
        reason: "no articles available",
        elapsedMs: Date.now() - startedAt,
      });
    }

    const saved = await storeDigest(digest);

    return NextResponse.json({
      ok: true,
      mode: saved.mode,
      digest: {
        date: digest.date,
        title: digest.title,
        articleCount: digest.articleSlugs.length,
      },
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    // Log lỗi gốc đầy đủ — trước đây bị nuốt thành "Unknown error"
    console.error("morning-digest failed", {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error,
    });

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        elapsedMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
