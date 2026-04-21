import { NextResponse } from "next/server";
import { getArticles, storeDigest } from "@/lib/supabase";
import { ArticleRecord, DailyDigest } from "@/lib/types";

export const maxDuration = 30;

function authorized(request: Request) {
  const header = request.headers.get("x-cron-secret");
  const secret = process.env.CRON_SECRET;
  return !!secret && header === secret;
}

// Quy đổi giờ UTC → giờ ICT (Việt Nam) để phân loại "buổi"
function getIctParts(now = new Date()) {
  // ICT = UTC+7
  const ictMs = now.getTime() + 7 * 60 * 60 * 1000;
  const ictDate = new Date(ictMs);
  return {
    hour: ictDate.getUTCHours(),
    dateString: ictDate.toISOString().slice(0, 10),
  };
}

function pickEditionLabel(hour: number) {
  if (hour < 11) return { slot: "morning", label: "Morning Edition", emoji: "🌅" };
  if (hour < 16) return { slot: "noon", label: "Midday Edition", emoji: "☀️" };
  return { slot: "evening", label: "Evening Edition", emoji: "🌆" };
}

function formatDateVi(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTimeVi(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function pickForDigest(articles: ArticleRecord[]): ArticleRecord[] {
  const now = Date.now();
  // Cửa sổ thời gian phụ thuộc edition: morning lấy 30h gần nhất (bắt cả tin đêm),
  // noon/evening chỉ lấy 18h gần nhất để đảm bảo digest "tươi".
  const ictHour = getIctParts().hour;
  const horizonHours = ictHour < 11 ? 30 : 18;
  const horizon = horizonHours * 60 * 60 * 1000;

  const recent = articles.filter(
    (a) => now - new Date(a.publishedAt).getTime() <= horizon
  );

  const pool = recent.length > 0 ? recent : articles;

  // Score = importanceScore + freshness bonus (bài 6h gần nhất được nhân 1.3)
  const scored = pool.map((a) => {
    const ageHours = Math.max(
      0,
      (now - new Date(a.publishedAt).getTime()) / (1000 * 60 * 60)
    );
    const freshness = ageHours < 6 ? 8 : ageHours < 12 ? 4 : 0;
    return { article: a, rank: (a.importanceScore || 0) + freshness };
  });

  const sorted = [...scored]
    .sort((a, b) => b.rank - a.rank)
    .map((x) => x.article);

  const picked: ArticleRecord[] = [];
  const seenSources = new Set<string>();

  // Bước 1: cân bằng nguồn — lấy bài top từ mỗi nguồn trước
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
  const now = new Date();
  const { hour, dateString } = getIctParts(now);
  const edition = pickEditionLabel(hour);
  const picked = pickForDigest(articles);

  const sourceLabels = Array.from(new Set(picked.map((a) => a.sourceLabel))).join(
    " · "
  );

  return {
    date: dateString,
    title: `${edition.label} · ${formatTimeVi(hour)} · ${formatDateVi(now)}`,
    intro: picked.length
      ? `Bản tin ${edition.label.toLowerCase()} chọn ${picked.length} bài đáng đọc nhất từ ${sourceLabels} tính tới thời điểm hiện tại. Mỗi edition trong ngày sẽ tự cập nhật khi có bài mới quan trọng.`
      : "Hiện chưa có bài mới đủ điểm để vào edition này. Quay lại sau khi cron collect chạy thêm vài lượt.",
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
    console.error("digest endpoint failed", {
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
