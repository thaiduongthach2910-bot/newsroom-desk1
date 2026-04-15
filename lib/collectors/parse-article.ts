import * as cheerio from "cheerio";
import { detectArticleType, isPromotionalArticle, scoreImportance } from "@/lib/content-rules";
import { ArticleRecord, SourceKey } from "@/lib/types";
import { generateSummary } from "@/lib/openai";

function slugFromUrl(url: string) {
  const pathname = new URL(url).pathname;
  const last = pathname.split("/").filter(Boolean).pop() || "article";
  return last.replace(/\.htm$/, "").replace(/[^a-zA-Z0-9\-À-ỹ]+/g, "-").toLowerCase();
}

function extractText($: cheerio.CheerioAPI) {
  const selectors = [
    "article p",
    ".entry-content p",
    ".detail__content p",
    ".detail-content p",
    ".article-content p",
    "main p",
  ];

  for (const selector of selectors) {
    const texts = $(selector)
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean);

    if (texts.length >= 3) {
      return texts.join("\n\n");
    }
  }

  const fallback = $("p")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((text) => text.length > 50);

  return fallback.slice(0, 16).join("\n\n");
}

function extractTitle($: cheerio.CheerioAPI) {
  return (
    $('meta[property="og:title"]').attr("content") ||
    $("h1").first().text().trim() ||
    $("title").text().trim()
  );
}

function extractExcerpt($: cheerio.CheerioAPI) {
  return (
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    $("p").first().text().trim()
  );
}

function extractImage($: cheerio.CheerioAPI) {
  return (
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    undefined
  );
}

function extractPublishedAt($: cheerio.CheerioAPI) {
  return (
    $('meta[property="article:published_time"]').attr("content") ||
    $("time").first().attr("datetime") ||
    new Date().toISOString()
  );
}

export async function parseArticle(url: string, source: SourceKey): Promise<ArticleRecord | null> {
  const sourceLabel = source === "vneconomy" ? "VnEconomy" : "Nghiên cứu Quốc tế";

  const html = await fetch(url, {
    headers: {
      "user-agent": "news-dashboard-v1/1.0",
    },
    next: { revalidate: 1800 },
  }).then((res) => res.text());

  const $ = cheerio.load(html);

  const title = extractTitle($);
  const excerpt = extractExcerpt($);
  const content = extractText($);
  const imageUrl = extractImage($);
  const publishedAt = extractPublishedAt($);

  if (!title || !content || content.length < 280) {
    return null;
  }

  const articleType = detectArticleType(source, title, content);
  const promotional = isPromotionalArticle(title, excerpt, content);
  const { score, level } = scoreImportance(title, excerpt, content);

  const summary = await generateSummary({
    title,
    excerpt,
    content,
    sourceLabel,
    articleType,
  });

  return {
    id: slugFromUrl(url),
    slug: slugFromUrl(url),
    source,
    sourceLabel,
    url,
    title,
    excerpt,
    content,
    imageUrl,
    publishedAt,
    articleType,
    importanceLevel: level,
    importanceScore: score,
    keepArticle: !promotional,
    isPromotional: promotional,
    summary,
  };
}
