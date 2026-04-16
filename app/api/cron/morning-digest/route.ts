import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getArticles, storeDigest } from "@/lib/supabase";
import { DailyDigest } from "@/lib/types";

function authorized(request: Request) {
  const header = request.headers.get("x-cron-secret");
  const secret = process.env.CRON_SECRET;
  return !!secret && header === secret;
}

async function buildDigest(): Promise<DailyDigest> {
  const articles = (await getArticles()).slice(0, 6);
  const today = new Date().toISOString().slice(0, 10);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      date: today,
      title: "Morning Edition | Những điểm đáng đọc đầu ngày",
      intro:
        "Đây là bản digest fallback khi chưa cấu hình OpenAI API key. Hệ thống đã gom các bài quan trọng nhất của vòng quét gần nhất để bạn có điểm bắt đầu rõ ràng lúc 6h sáng.",
      articleSlugs: articles.slice(0, 3).map((article) => article.slug),
      items: articles.slice(0, 3).map((article) => ({ slug: article.slug, title: article.title, sourceLabel: article.sourceLabel })),
    };
  }

  const client = new OpenAI({ apiKey });
  const prompt = `
Hãy tạo phần mở đầu cho bản tin sáng bằng tiếng Việt. Giọng điệu: gọn, sắc, có trọng lượng.
Trả về JSON thuần với đúng các khóa:
{
  "title": "...",
  "intro": "...",
  "articleSlugs": ["...", "...", "..."]
}

Dữ liệu đầu vào:
${articles
  .map(
    (article, index) => `
[${index + 1}]
slug: ${article.slug}
source: ${article.sourceLabel}
title: ${article.title}
summary: ${article.summary.summaryShort}
importance: ${article.importanceLevel}
what_it_really_says: ${article.summary.whatItReallySays}
`
  )
  .join("\n")}
`;

  const response = await client.responses.create({
    model: process.env.OPENAI_SUMMARY_MODEL || "gpt-5.4-mini",
    input: prompt,
    store: false,
    text: { verbosity: "medium" },
  });

  try {
    const parsed = JSON.parse(response.output_text);
    return {
      date: today,
      title: parsed.title,
      intro: parsed.intro,
      articleSlugs: parsed.articleSlugs,
      items: parsed.articleSlugs.map((slug: string) => {
        const article = articles.find((item) => item.slug === slug);
        return { slug, title: article?.title, sourceLabel: article?.sourceLabel };
      }),
    };
  } catch {
    return {
      date: today,
      title: "Morning Edition | Điểm tin đầu ngày",
      intro:
        "Bản tin sáng gom những bài quan trọng nhất trong vòng quét gần nhất để bạn bắt đầu ngày đọc tin có thứ tự.",
      articleSlugs: articles.slice(0, 3).map((article) => article.slug),
      items: articles.slice(0, 3).map((article) => ({ slug: article.slug, title: article.title, sourceLabel: article.sourceLabel })),
    };
  }
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const digest = await buildDigest();
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

export async function POST(request: Request) {
  return GET(request);
}
