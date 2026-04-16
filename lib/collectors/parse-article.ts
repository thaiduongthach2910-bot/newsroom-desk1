import * as cheerio from "cheerio";
import { detectArticleType, isPromotionalArticle, scoreImportance } from "@/lib/content-rules";
import { ArticleRecord, SourceKey } from "@/lib/types";
import { generateSummary } from "@/lib/openai";

function slugFromUrl(url: string) {
  const pathname = new URL(url).pathname;
  const last = pathname.split("/").filter(Boolean).pop() || "article";
  return last.replace(/\.htm$/, "").replace(/[^a-zA-Z0-9\-À-ỹ]+/g, "-").toLowerCase();
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function extractParagraphs($: cheerio.CheerioAPI) {
  const selectors = [
    "article p",
    ".entry-content p",
    ".detail__content p",
    ".detail-content p",
    ".article-content p",
    ".entry-content-main p",
    ".post-content p",
    "main p",
  ];

  for (const selector of selectors) {
    const texts = $(selector)
      .map((_, el) => normalizeText($(el).text()))
      .get()
      .filter(Boolean)
      .filter((text) => text.length > 45)
      .filter((text) => !/^bản quyền thuộc/i.test(text.toLowerCase()));

    if (texts.length >= 4) return texts;
  }

  return $("p")
    .map((_, el) => normalizeText($(el).text()))
    .get()
    .filter((text) => text.length > 60)
    .filter((text) => !/^bản quyền thuộc/i.test(text.toLowerCase()))
    .slice(0, 20);
}

function extractText($: cheerio.CheerioAPI) {
  return extractParagraphs($).join("\n\n");
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
    extractParagraphs($)[0] ||
    ""
  );
}

function extractImage($: cheerio.CheerioAPI, url: string) {
  const raw =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    $("article img").first().attr("src") ||
    undefined;

  if (!raw) return undefined;
  try {
    return new URL(raw, url).toString();
  } catch {
    return undefined;
  }
}

function extractPublishedAt($: cheerio.CheerioAPI) {
  return (
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[name="pubdate"]').attr("content") ||
    $("time").first().attr("datetime") ||
    new Date().toISOString()
  );
}

function isRecentEnough(source: SourceKey, publishedAt: string) {
  const published = new Date(publishedAt);
  if (Number.isNaN(published.getTime())) return false;

  const now = new Date();
  const diffDays = (now.getTime() - published.getTime()) / (1000 * 60 * 60 * 24);

  if (source === "nghiencuuquocte") {
    return diffDays <= 7;
  }

  return diffDays <= 3;
}

function shouldRejectPage(params: {
  url: string;
  title: string;
  excerpt: string;
  content: string;
  source: SourceKey;
}) {
  const { url, title, excerpt, content, source } = params;
  const filename = url.split("/").pop()?.replace(/\.htm$/i, "").toLowerCase() || "";
  const combined = `${title}\n${excerpt}\n${content}`.toLowerCase();
  const paragraphCount = content.split(/\n\n+/).filter(Boolean).length;

  if (!title || title.length < 20) return true;
  if (!content || content.length < 600) return true;
  if (paragraphCount < 4) return true;

  if (source === "vneconomy") {
    if (filename.split("-").length < 4) return true;
    if (combined.includes("bản quyền thuộc tạp chí kinh tế việt nam") && content.length < 1200) return true;
    if (/^podcast|^chung-khoan|^infographics|^emagazine|^tieu-dung|^thuong-vu-anh$/i.test(filename)) {
      return true;
    }
  }

  if (source === "nghiencuuquocte") {
    if (!/\d{4}\/\d{2}\/\d{2}/.test(url)) return true;
    if (combined.includes("thế giới hôm nay") || combined.includes("the world today")) return true;
  }

  return false;
}

export async function parseArticle(url: string, source: SourceKey): Promise<ArticleRecord | null> {
  const sourceLabel = source === "vneconomy" ? "VnEconomy" : "Nghiên cứu Quốc tế";

  const html = await fetch(url, {
    headers: { "user-agent": "news-dashboard-v3/1.0" },
    next: { revalidate: 1800 },
  }).then((res) => res.text());

  const $ = cheerio.load(html);

  const title = normalizeText(extractTitle($));
  const excerpt = normalizeText(extractExcerpt($));
  const content = extractText($);
  const imageUrl = extractImage($, url);
  const publishedAt = extractPublishedAt($);

  if (shouldRejectPage({ url, title, excerpt, content, source })) {
    return null;
  }

  if (!isRecentEnough(source, publishedAt)) {
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
