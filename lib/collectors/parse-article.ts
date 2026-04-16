import * as cheerio from "cheerio";
import { detectArticleType, isPromotionalArticle, scoreImportance } from "@/lib/content-rules";
import { ArticleRecord, SourceKey } from "@/lib/types";
import { generateSummary } from "@/lib/openai";

const BAD_VNECONOMY_SLUGS = new Set([
  "podcast",
  "chung-khoan",
  "dien-dan",
  "dien-dan-kinh-te-xanh",
  "thi-truong-von",
  "phap-ly-kinh-te-xanh",
  "tai-chinh-ngan-hang",
  "bao-hiem-tai-chinh",
  "doanh-nghiep-niem-yet",
  "e-magazine",
  "emagazine",
  "tieu-dung",
  "thuong-vu-anh",
  "infographics",
  "ngan-hang",
  "tai-chinh",
  "kinh-te-xanh",
  "data-talk",
  "the-gioi-hom-nay",
]);

const BAD_VNECONOMY_TITLE_PATTERNS = [
  /^thị trường vốn/i,
  /^diễn đàn/i,
  /^bảo hiểm/i,
  /^ngân hàng/i,
  /^tài chính/i,
  /^khung pháp lý/i,
  /^pháp lý/i,
  /^tiêu dùng/i,
  /^kinh tế xanh/i,
  /^doanh nghiệp niêm yết/i,
  /^podcast/i,
  /^infographics/i,
];

const BAD_TEXT_SNIPPETS = [
  "Với phương châm Đoàn kết - Dân chủ",
  "Tạp chí Kinh tế Việt Nam",
  "Editorial illustration for the dashboard mockup",
  "Đăng nhập để bình luận",
  "Bạn đọc có thể gửi",
];

function slugFromUrl(url: string) {
  const pathname = new URL(url).pathname;
  const last = pathname.split("/").filter(Boolean).pop() || "article";
  return last.replace(/\.htm$/i, "").replace(/[^a-zA-Z0-9\-À-ỹ]+/g, "-").toLowerCase();
}

function cleanTitle(title: string, source: SourceKey) {
  const trimmed = title.replace(/\s+/g, " ").trim();
  if (source === "vneconomy") {
    return trimmed.replace(/\s*-\s*VnEconomy$/i, "").trim();
  }
  return trimmed;
}

function extractParagraphs($: cheerio.CheerioAPI, source: SourceKey) {
  const selectors = source === "vneconomy"
    ? [
        "article p",
        ".detail__content p",
        ".detail-content p",
        ".article__body p",
        ".article-content p",
        "main article p",
      ]
    : [
        "article p",
        ".entry-content p",
        ".post-content p",
        ".td-post-content p",
        "main article p",
        "main p",
      ];

  for (const selector of selectors) {
    const texts = $(selector)
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean)
      .filter((text) => text.length > 55)
      .filter((text) => !BAD_TEXT_SNIPPETS.some((snippet) => text.includes(snippet)));

    if (texts.length >= 4) return texts;
  }

  return $("p")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((text) => text.length > 70)
    .filter((text) => !BAD_TEXT_SNIPPETS.some((snippet) => text.includes(snippet)))
    .slice(0, 12);
}

function extractText($: cheerio.CheerioAPI, source: SourceKey) {
  return extractParagraphs($, source).join("\n\n");
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

function extractPublishedAtRaw($: cheerio.CheerioAPI) {
  return (
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[name="pubdate"]').attr("content") ||
    $('meta[name="publish-date"]').attr("content") ||
    $("time").first().attr("datetime") ||
    undefined
  );
}

function extractPublishedAt($: cheerio.CheerioAPI, url: string, source: SourceKey) {
  const metaDate = extractPublishedAtRaw($);
  if (metaDate) return metaDate;

  if (source === "nghiencuuquocte") {
    const match = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
    if (match) {
      const [, year, month, day] = match;
      return `${year}-${month}-${day}T00:00:00.000Z`;
    }
  }

  return undefined;
}

function isFreshIsoDate(value: string | undefined, maxDays = 5) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const diffDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= maxDays;
}

function looksLikeCategoryPage(source: SourceKey, url: string, title: string, content: string, publishedAt?: string) {
  const slug = slugFromUrl(url);
  const cleanedTitle = cleanTitle(title, source);

  if (source === "vneconomy") {
    if (BAD_VNECONOMY_SLUGS.has(slug)) return true;
    if ([...BAD_VNECONOMY_SLUGS].some((item) => slug.startsWith(item + "-"))) return true;
    if (!publishedAt) return true;
    if (content.length < 900) return true;
    if (BAD_VNECONOMY_TITLE_PATTERNS.some((pattern) => pattern.test(cleanedTitle))) return true;
    if (cleanedTitle.split(/\s+/).length <= 4) return true;
  }

  if (source === "nghiencuuquocte") {
    if (!isFreshIsoDate(publishedAt, 5)) return true;
    if (content.length < 900) return true;
  }

  return BAD_TEXT_SNIPPETS.some((snippet) => content.includes(snippet));
}

export async function parseArticle(url: string, source: SourceKey): Promise<ArticleRecord | null> {
  const sourceLabel = source === "vneconomy" ? "VnEconomy" : "Nghiên cứu Quốc tế";

  const res = await fetch(url, {
    headers: { "user-agent": "news-dashboard-v5/1.0" },
    next: { revalidate: 1800 },
  });

  if (!res.ok) return null;

  const html = await res.text();
  const $ = cheerio.load(html);

  const title = cleanTitle(extractTitle($), source);
  const excerpt = extractExcerpt($).replace(/\s+/g, " ").trim();
  const content = extractText($, source);
  const imageUrl = extractImage($, url);
  const publishedAt = extractPublishedAt($, url, source);

  if (!title || !content || content.length < 900) {
    return null;
  }

  if (looksLikeCategoryPage(source, url, title, content, publishedAt)) {
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
    publishedAt: publishedAt || new Date().toISOString(),
    articleType,
    importanceLevel: level,
    importanceScore: score,
    keepArticle: !promotional,
    isPromotional: promotional,
    summary,
  };
}
