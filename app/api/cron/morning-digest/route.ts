import { NextResponse } from "next/server";
import { getArticles, storeDigest } from "@/lib/supabase";
import { DailyDigest } from "@/lib/types";

function authorized(request: Request) {
  const header = request.headers.get("x-cron-secret");
  const secret = process.env.CRON_SECRET;
  return !!secret && header === secret;
}

function buildFallbackDigest(articles: Awaited<ReturnType<typeof getArticles>>): DailyDigest {
  const picked = [...articles]
    .sort((a, b) => (b.importanceScore || 0) - (a.importanceScore || 0))
    .slice(0, 3);

  const today = new Date().toISOString().slice(0, 10);
  return {
    date: today,
    title: "Morning Edition | Những điểm nên đọc đầu ngày",
    intro:
      "Bản tin sáng chọn các bài đáng đọc nhất từ vòng quét gần nhất. Mục tiêu là giúp bạn vào việc nhanh, không phải lướt mọi thứ theo kiểu dòng thời gian.",
    articleSlugs: picked.map((article) => article.slug),
    items: picked.map((article) => ({
      slug: article.slug,
      title: article.title,
      sourceLabel: article.sourceLabel,
    })),
  };
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const articles = await getArticles();
    const digest = buildFallbackDigest(articles);
    const saved = await storeDigest(digest);

    return NextResponse.json({
      ok: true,
      mode: saved.mode,
      digest,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
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
