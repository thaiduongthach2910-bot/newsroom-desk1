import * as cheerio from "cheerio";
import { XMLParser } from "fast-xml-parser";
import { SourceKey } from "@/lib/types";

const USER_AGENT = "newsroom-desk/1.0";
const REQUEST_TIMEOUT_MS = 12000;
const MAX_LINKS_PER_SOURCE = 4;

const VNECONOMY_RSS_URLS = [
  "https://vneconomy.vn/rss.html",
];

const SOURCE_URLS: Record<SourceKey, string[]> = {
  vneconomy: ["https://vneconomy.vn/"],
  nghiencuuquocte: ["https://nghiencuuquocte.org/"],
};

const BLOCKED_VNECONOMY_SLUGS = new Set([
  "tap-chi-kinh-te-viet-nam",
  "san-pham-thi-truong",
  "thi-truong-von",
  "dien-dan",
  "dien-dan-kinh-te-xanh",
  "bao-hiem",
  "ngan-hang",
  "tai-chinh",
  "khung-phap-ly",
  "phap-ly",
  "kinh-te-xanh",
  "tieu-dung",
  "podcast",
  "infographics",
  "emagazine",
  "e-magazine",
]);

const BLOCKED_TITLE_PATTERNS = [
  /^tạp chí kinh tế việt nam$/i,
  /^sản phẩm\s*-\s*thị trường$/i,
  /^thị trường vốn/i,
  /^diễn đàn/i,
  /^bảo hiểm/i,
  /^ngân hàng/i,
  /^tài chính/i,
  /^khung pháp lý/i,
  /^pháp lý/i,
  /^kinh tế xanh/i,
  /^podcast/i,
  /^infographics/i,
  /^thị trường$/i,
];

function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  return fetch(url, {
    headers: { "user-agent": USER_AGENT },
    next: { revalidate: 1800 },
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
}

function normalizeUrl(href: string, base: string) {
  try {
    const url = new URL(href, base);
    url.hash = "";
    if (url.search) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function slugFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").filter(Boolean).pop() || "";
    return last.replace(/\.htm$/i, "").toLowerCase();
  } catch {
    return "";
  }
}

function isRecentDateFromUrl(url: string, maxDays = 4) {
  const match = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  if (!match) return false;

  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;

  const diffDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= maxDays;
}

function isBlockedTitle(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return true;
  return BLOCKED_TITLE_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function isLikelyVnEconomyArticle(url: string, title = "") {
  if (!url.startsWith("https://vneconomy.vn/")) return false;
  if (!url.endsWith(".htm")) return false;

  const slug = slugFromUrl(url);
  const hyphenCount = (slug.match(/-/g) || []).length;

  if (!slug || slug.length < 28 || hyphenCount < 4) return false;
  if (BLOCKED_VNECONOMY_SLUGS.has(slug)) return false;
  if ([...BLOCKED_VNECONOMY_SLUGS].some((prefix) => slug.startsWith(prefix + "-"))) return false;
  if (title && isBlockedTitle(title)) return false;

  return true;
}

function isLikelyNghienCuuQuocTeArticle(url: string, title = "") {
  if (!url.startsWith("https://nghiencuuquocte.org/")) return false;
  if (!/\/\d{4}\/\d{2}\/\d{2}\//.test(url)) return false;
  if (!isRecentDateFromUrl(url, 4)) return false;
  if (/thế giới hôm nay/i.test(title)) return false;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(title)) return false;
  if (/vào ngày này năm/i.test(title)) return false;
  if (/tự sát/i.test(title)) return false;
  return true;
}

async function readText(url: string) {
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Fetch failed ${response.status} for ${url}`);
  return response.text();
}

async function parseVnEconomyRss() {
  const collected = new Set<string>();
  const parser = new XMLParser({ ignoreAttributes: false });

  for (const rssUrl of VNECONOMY_RSS_URLS) {
    try {
      const xml = await readText(rssUrl);
      const parsed = parser.parse(xml);
      const items = parsed?.rss?.channel?.item;
      const list = Array.isArray(items) ? items : items ? [items] : [];

      for (const item of list) {
        const link = typeof item?.link === "string" ? item.link.trim() : "";
        const title = typeof item?.title === "string" ? item.title.trim() : "";
        if (!link) continue;
        if (!isLikelyVnEconomyArticle(link, title)) continue;
        collected.add(link);
        if (collected.size >= MAX_LINKS_PER_SOURCE) break;
      }
    } catch {
      // fallback to html discovery below
    }

    if (collected.size >= MAX_LINKS_PER_SOURCE) break;
  }

  return Array.from(collected);
}

async function parseHtmlLinks(url: string, source: SourceKey) {
  const html = await readText(url);
  const $ = cheerio.load(html);
  const collected = new Set<string>();

  $("a[href]").each((_, element) => {
    if (collected.size >= MAX_LINKS_PER_SOURCE) return;

    const href = $(element).attr("href");
    if (!href) return;

    const normalized = normalizeUrl(href, url);
    if (!normalized) return;

    const anchorText = $(element).text().replace(/\s+/g, " ").trim();

    const ok =
      source === "vneconomy"
        ? isLikelyVnEconomyArticle(normalized, anchorText)
        : isLikelyNghienCuuQuocTeArticle(normalized, anchorText);

    if (!ok) return;
    collected.add(normalized);
  });

  return Array.from(collected);
}

export async function discoverArticleLinks(source: SourceKey): Promise<string[]> {
  const collected = new Set<string>();

  if (source === "vneconomy") {
    const rssLinks = await parseVnEconomyRss();
    for (const link of rssLinks) collected.add(link);
  }

  if (collected.size < MAX_LINKS_PER_SOURCE) {
    for (const url of SOURCE_URLS[source]) {
      try {
        const links = await parseHtmlLinks(url, source);
        for (const link of links) {
          collected.add(link);
          if (collected.size >= MAX_LINKS_PER_SOURCE) break;
        }
      } catch {
        // ignore one endpoint failing
      }

      if (collected.size >= MAX_LINKS_PER_SOURCE) break;
    }
  }

  return Array.from(collected).slice(0, MAX_LINKS_PER_SOURCE);
}
