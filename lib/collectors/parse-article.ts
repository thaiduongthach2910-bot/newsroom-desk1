import * as cheerio from "cheerio";
import { detectArticleType, isPromotionalArticle, scoreImportance } from "@/lib/content-rules";
import { ArticleRecord, SourceKey } from "@/lib/types";
import { generateSummary } from "@/lib/openai";

const BAD_VNECONOMY_PREFIXES = [
  "podcast",
  "chung-khoan",
  "dien-dan",
  "dien-dan-kinh-te-xanh",
  "thi-truong-von",
  "phap-ly-kinh-te-xanh",
  "tai-chinh-ngan-hang",
  "bao-hiem-tai-chinh",
  "bao-hiem",
  "ngan-hang",
  "tai-chinh",
  "doanh-nghiep-niem-yet",
  "e-magazine",
  "emagazine",
  "tieu-dung",
  "thuong-vu-anh",
  "infographics",
  "kinh-te-xanh",
  "data-talk",
  "the-gioi-hom-nay",
  "thi-truong",
  "phap-ly",
  "khung-phap-ly",
];

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
  /^thị trường$/i,
];

const BAD_TEXT_SNIPPETS = [
  "Với phương châm Đoàn kết - Dân chủ",
  "Tạp chí Kinh tế Việt Nam",
  "Editorial illustration for the dashboard mockup",
  "Đăng nhập để bình luận",
  "Bạn đọc có thể gửi",
  "Bản quyền thuộc về Tạp chí Kinh tế Việt Nam",
];

const NGHIENCUU_RELEVANT_KEYWORDS = [
  "asean",
  "trung quốc",
  "mỹ",
  "nga",
  "ukraine",
  "nato",
  "eu",
  "iran",
  "israel",
  "myanmar",
  "trump",
  "chiến tranh",
  "hòa bình",
  "địa chính trị",
  "thương mại",
  "kinh tế",
  "an ninh",
  "biển đông",
  "năng lượng",
  "thuế",
  "chuỗi cung ứng",
  "logistics",
  "fed",
  "lạm phát",
  "tiền tệ",
  "ngân hàng",
  "khu vực",
  "đông nam á",
];

function slugFromUrl(url: string) {
  const pathname = new URL(url).pathname;
  const last = pathname.split("/").filter(Boolean).pop() || "article";
  return last.replace(/\.htm$/i, "").replace(/[^a-zA-Z0-9\-À-ỹ]+/g, "-").toLowerCase();
}

function normalizeSpace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function cleanTitle(title: string, source: SourceKey) {
  const trimmed = normalizeSpace(title);
  if (source === "vneconomy") return trimmed.replace(/\s*-\s*VnEconomy$/i, "").trim();
  if (source === "nghiencuuquocte") return trimmed.replace(/\s*[|｜]\s*Nghiên cứu Quốc tế$/i, "").trim();
  return trimmed;
}

function isNoiseParagraph(text: string, source: SourceKey) {
  const cleaned = normalizeSpace(text);
  if (!cleaned) return true;
  if (cleaned.length < 60) return true;
  if (BAD_TEXT_SNIPPETS.some((snippet) => cleaned.includes(snippet))) return true;
  if (/^(xem thêm|bài liên quan|đọc thêm)\s*:/i.test(cleaned)) return true;
  if (source === "nghiencuuquocte" && /^nguồn\s*:/i.test(cleaned) && cleaned.length < 260) return true;
  return false;
}

function extractParagraphs($: cheerio.CheerioAPI, source: SourceKey) {
  const selectors =
    source === "vneconomy"
      ? [
          "article p",
          ".detail__content p",
          ".detail-content p",
          ".article__body p",
          ".article-content p",
          "main article p",
        ]
      : ["article p", ".entry-content p", ".post-content p", ".td-post-content p", "main article p", "main p"];

  for (const selector of selectors) {
    const texts = $(selector)
      .map((_, el) => normalizeSpace($(el).text()))
      .get()
      .filter(Boolean)
      .filter((text) => !isNoiseParagraph(text, source));

    if (texts.length >= 5) return texts;
  }

  return $("p")
    .map((_, el) => normalizeSpace($(el).text()))
    .get()
    .filter(Boolean)
    .filter((text) => !isNoiseParagraph(text, source))
    .slice(0, 14);
}

function extractText($: cheerio.CheerioAPI, source: SourceKey) {
  return extractParagraphs($, source).join("\n\n");
}

function extractTitle($: cheerio.CheerioAPI) {
  return $("meta[property='og:title']").attr("content") || $("h1").first().text().trim() || $("title").text().trim();
}

function extractExcerpt($: cheerio.CheerioAPI) {
  return $("meta[property='og:description']").attr("content") || $("meta[name='description']").attr("content") || "";
}

function cleanExcerpt(rawExcerpt: string, content: string, source: SourceKey) {
  const excerpt = normalizeSpace(rawExcerpt);
  if (!excerpt) {
    return normalizeSpace(content.split(/\n\n+/).find(Boolean) || "").slice(0, 260);
  }

  if (source === "nghiencuuquocte" && /^nguồn\s*:/i.test(excerpt)) {
    return normalizeSpace(content.split(/\n\n+/).find(Boolean) || "").slice(0, 260);
  }

  return excerpt;
}

function extractImage($: cheerio.CheerioAPI, url: string) {
  const raw =
    $("meta[property='og:image']").attr("content") ||
    $("meta[name='twitter:image']").attr("content") ||
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
    $("meta[property='article:published_time']").attr("content") ||
    $("meta[name='pubdate']").attr("content") ||
    $("meta[name='publish-date']").attr("content") ||
    $("time").first().attr("datetime") ||
    undefined
  );
}

function extractPublishedAt($: cheerio.CheerioAPI, url: string, source: SourceKey) {
  const meta = extractPublishedAtRaw($);
  if (meta) {
    const date = new Date(meta);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  if (source === "nghiencuuquocte") {
    const match = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
    if (match) {
      const [, year, month, day] = match;
      return new Date(`${year}-${month}-${day}T00:00:00Z`).toISOString();
    }
  }

  return undefined;
}

function isFreshIsoDate(value: string | undefined, maxDays = 4) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const diffDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= maxDays;
}

function isRelevantNghienCuuArticle(title: string, content: string) {
  const text = `${title} ${content}`.toLowerCase();
  return NGHIENCUU_RELEVANT_KEYWORDS.some((keyword) => text.includes(keyword));
}

function isHistoricalFeature(title: string, content: string) {
  const lowerTitle = title.toLowerCase();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}\s*:/.test(lowerTitle)) return true;
  if (lowerTitle.startsWith("ngày này năm")) return true;
  if (content.toLowerCase().includes("vào ngày này năm") && !isRelevantNghienCuuArticle(title, content)) return true;
  return false;
}

function shouldRejectPage(params: {
  url: string;
  title: string;
  excerpt: string;
  content: string;
  source: SourceKey;
  publishedAt?: string;
}) {
  const { url, title, excerpt, content, source, publishedAt } = params;
  const slug = slugFromUrl(url);
  const cleanedTitle = cleanTitle(title, source);
  const paragraphCount = content.split(/\n\n+/).filter(Boolean).length;
  const wordCount = cleanedTitle.split(/\s+/).filter(Boolean).length;

  if (!cleanedTitle || cleanedTitle.length < 18) return true;
  if (!content || content.length < 850) return true;
  if (paragraphCount < 4) return true;

  if (source === "vneconomy") {
    if (BAD_VNECONOMY_PREFIXES.some((prefix) => slug === prefix || slug.startsWith(prefix + "-"))) return true;
    if (BAD_VNECONOMY_TITLE_PATTERNS.some((pattern) => pattern.test(cleanedTitle))) return true;
    if (wordCount <= 4) return true;
    if (excerpt.trim().length < 24 && paragraphCount < 6) return true;
  }

  if (source === "nghiencuuquocte") {
    if (!isFreshIsoDate(publishedAt, 4)) return true;
    if (!isRelevantNghienCuuArticle(cleanedTitle, content)) return true;
    if (isHistoricalFeature(cleanedTitle, content)) return true;
  }

  return false;
}

export async function parseArticle(url: string, source: SourceKey): Promise<ArticleRecord | null> {
  const sourceLabel = source === "vneconomy" ? "VnEconomy" : "Nghiên cứu Quốc tế";

  const res = await fetch(url, {
    headers: { "user-agent": "newsroom-desk-final/1.0" },
    next: { revalidate: 1800 },
  });

  if (!res.ok) return null;

  const html = await res.text();
  const $ = cheerio.load(html);

  const title = cleanTitle(extractTitle($), source);
  const content = extractText($, source);
  const excerpt = cleanExcerpt(extractExcerpt($), content, source);
  const imageUrl = extractImage($, url);
  const publishedAt = extractPublishedAt($, url, source);

  if (shouldRejectPage({ url, title, excerpt, content, source, publishedAt })) return null;

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
