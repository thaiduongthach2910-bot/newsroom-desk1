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
  "san-pham-thi-truong",
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
  /^sản phẩm\s*-\s*thị trường$/i,
];

const BAD_TEXT_SNIPPETS = [
  "Với phương châm Đoàn kết - Dân chủ",
  "Tạp chí Kinh tế Việt Nam",
  "Editorial illustration for the dashboard mockup",
  "Đăng nhập để bình luận",
  "Bạn đọc có thể gửi",
  "Bản quyền thuộc về Tạp chí Kinh tế Việt Nam",
];

const BAD_NCQT_TITLE_PATTERNS = [
  /^thế giới hôm nay/i,
  /^\d{1,2}\/\d{1,2}\/\d{4}\s*:/i,
  /ngày này năm/i,
  /lịch sử/i,
  /tự sát/i,
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
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean)
      .filter((text) => text.length > 60)
      .filter((text) => !BAD_TEXT_SNIPPETS.some((snippet) => text.includes(snippet)));

    if (texts.length >= 5) return texts;
  }

  return $("p")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((text) => text.length > 80)
    .filter((text) => !BAD_TEXT_SNIPPETS.some((snippet) => text.includes(snippet)))
    .slice(0, 12);
}

function extractText($: cheerio.CheerioAPI, source: SourceKey) {
  return extractParagraphs($, source).join("\n\n");
}

function extractTitle($: cheerio.CheerioAPI) {
  return $("meta[property='og:title']").attr("content") || $("h1").first().text().trim() || $("title").text().trim();
}

function extractExcerpt($: cheerio.CheerioAPI) {
  return (
    $("meta[property='og:description']").attr("content") ||
    $("meta[name='description']").attr("content") ||
    ""
  );
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

  return new Date().toISOString();
}

function isRecentEnough(source: SourceKey, publishedAt: string) {
  if (source !== "nghiencuuquocte") return true;
  const date = new Date(publishedAt);
  const diffDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 4;
}

function isGenericCategoryTitle(title: string) {
  const normalized = title.replace(/\s+/g, " ").trim();
  const wordCount = normalized.split(/\s+/).length;
  return /^[\p{L}\d\s]+\s-\s[\p{L}\d\s]+$/u.test(normalized) && wordCount <= 6;
}

function shouldRejectPage(params: {
  url: string;
  title: string;
  excerpt: string;
  content: string;
  source: SourceKey;
}) {
  const { url, title, content, source } = params;
  const slug = slugFromUrl(url);
  const paragraphCount = content.split(/\n\n+/).filter(Boolean).length;

  if (!title || title.length < 20) return true;
  if (!content || content.length < 600) return true;
  if (paragraphCount < 4) return true;

  if (source === "vneconomy") {
    if (!url.endsWith(".htm")) return true;
    if (BAD_VNECONOMY_PREFIXES.some((prefix) => slug === prefix || slug.startsWith(prefix + "-"))) return true;
    if (BAD_VNECONOMY_TITLE_PATTERNS.some((pattern) => pattern.test(title))) return true;
    if (isGenericCategoryTitle(title)) return true;
  }

  if (source === "nghiencuuquocte") {
    if (!/\/\d{4}\/\d{2}\/\d{2}\//.test(url)) return true;
    if (BAD_NCQT_TITLE_PATTERNS.some((pattern) => pattern.test(title))) return true;
  }

  return false;
}

export async function parseArticle(url: string, source: SourceKey): Promise<ArticleRecord | null> {
  const sourceLabel = source === "vneconomy" ? "VnEconomy" : "Nghiên cứu Quốc tế";

  const html = await fetch(url, {
    headers: { "user-agent": "news-dashboard-final/1.0" },
    next: { revalidate: 1800 },
  }).then((res) => res.text());

  const $ = cheerio.load(html);

  const title = cleanTitle(extractTitle($), source);
  const excerpt = extractExcerpt($).replace(/\s+/g, " ").trim();
  const content = extractText($, source);
  const imageUrl = extractImage($, url);
  const publishedAt = extractPublishedAt($, url, source);

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
