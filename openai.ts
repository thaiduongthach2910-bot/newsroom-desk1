import * as cheerio from "cheerio";
import { XMLParser } from "fast-xml-parser";
import { SourceKey } from "@/lib/types";

const SOURCE_URLS: Record<SourceKey, string[]> = {
  vneconomy: [
    "https://vneconomy.vn/",
    "https://vneconomy.vn/the-gioi.htm",
    "https://vneconomy.vn/thi-truong.htm",
    "https://vneconomy.vn/doanh-nghiep.htm",
    "https://vneconomy.vn/tai-chinh.htm",
  ],
  nghiencuuquocte: ["https://nghiencuuquocte.org/"],
};

const VNE_RSS_INDEX = "https://vneconomy.vn/rss.html";

const BLOCKED_VNE_SLUGS = [
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
  "doanh-nghiep-niem-yet",
  "podcast",
  "infographics",
  "emagazine",
  "e-magazine",
  "tiieu-dung",
];

const BLOCKED_VNE_PREFIXES = [
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
  "doanh-nghiep-niem-yet",
  "podcast",
  "infographics",
  "emagazine",
  "e-magazine",
  "tieu-dung",
  "thuong-vu-anh",
  "data-talk",
  "the-gioi-hom-nay",
];

const BLOCKED_VNE_TITLE_EXACT = [
  "tạp chí kinh tế việt nam",
  "sản phẩm - thị trường",
  "thị trường vốn",
  "diễn đàn",
  "bảo hiểm",
  "ngân hàng",
  "khung pháp lý",
  "pháp lý",
  "tài chính",
  "kinh tế xanh",
  "infographics",
  "podcast",
];

const WANTED_VNE_FEEDS = [
  "tin mới",
  "tiêu điểm",
  "tài chính",
  "thị trường",
  "thế giới",
  "doanh nghiệp",
  "đầu tư",
  "hạ tầng",
  "bất động sản",
  "kinh tế số",
  "dân sinh",
  "xuất nhập khẩu",
  "chính sách",
  "kinh tế",
  "kinh doanh",
  "chuyển động 24h",
  "chuyển động",
  "đối thoại",
  "kết nối",
  "quốc tế",
  "đầu tư",
  "thuế",
  "công nghiệp",
  "nông sản",
];

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
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

function isFreshDateFromUrl(url: string, maxDays = 4) {
  const match = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  if (!match) return false;

  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;

  const diffDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= maxDays;
}

function isBlockedVnTitle(anchorText: string) {
  const cleaned = normalizeSpaces(anchorText).toLowerCase();
  return BLOCKED_VNE_TITLE_EXACT.some((item) => cleaned === item || cleaned.startsWith(item + " - "));
}

function isLikelyVnEconomyArticle(url: string, anchorText: string) {
  if (!url.startsWith("https://vneconomy.vn/")) return false;
  if (!url.endsWith(".htm")) return false;

  const slug = slugFromUrl(url);
  if (!slug) return false;
  if (BLOCKED_VNE_SLUGS.includes(slug)) return false;
  if (BLOCKED_VNE_PREFIXES.some((prefix) => slug === prefix || slug.startsWith(prefix + "-"))) return false;
  if (isBlockedVnTitle(anchorText)) return false;

  const hyphenCount = (slug.match(/-/g) || []).length;
  if (slug.length < 24 || hyphenCount < 3) return false;

  return true;
}

function isLikelyNghienCuuQuocTeArticle(url: string, anchorText: string) {
  if (!url.startsWith("https://nghiencuuquocte.org/")) return false;
  if (!/\/\d{4}\/\d{2}\/\d{2}\//.test(url)) return false;
  if (/the-gioi-hom-nay/i.test(url)) return false;

  const title = normalizeSpaces(anchorText).toLowerCase();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}\s*:/i.test(title)) return false;
  if (/(tự sát|ám sát|sinh ra|qua đời|sinh nhật)/i.test(title)) return false;

  return isFreshDateFromUrl(url, 4);
}

function isLikelyArticleUrl(source: SourceKey, url: string, anchorText = "") {
  return source === "vneconomy"
    ? isLikelyVnEconomyArticle(url, anchorText)
    : isLikelyNghienCuuQuocTeArticle(url, anchorText);
}

async function fetchText(url: string) {
  const res = await fetch(url, {
    headers: { "user-agent": "newsroom-desk-final/1.0" },
    next: { revalidate: 1800 },
  });

  if (!res.ok) throw new Error(`Fetch failed for ${url}: ${res.status}`);
  return res.text();
}

async function fetchVnEconomyRssLinks() {
  const html = await fetchText(VNE_RSS_INDEX);
  const $ = cheerio.load(html);
  const feedUrls = new Set<string>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;

    const text = normalizeSpaces($(element).text()).toLowerCase();
    if (!text) return;
    if (!WANTED_VNE_FEEDS.includes(text)) return;

    const normalized = normalizeUrl(href, VNE_RSS_INDEX);
    if (!normalized) return;
    if (!/rss\.html$/i.test(normalized)) return;

    feedUrls.add(normalized);
  });

  const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });
  const articleLinks = new Set<string>();

  for (const feedUrl of Array.from(feedUrls).slice(0, 12)) {
    try {
      const xml = await fetchText(feedUrl);
      const parsed = parser.parse(xml);
      const items = parsed?.rss?.channel?.item;
      const itemList = Array.isArray(items) ? items : items ? [items] : [];

      for (const item of itemList) {
        const link = typeof item?.link === "string" ? item.link.trim() : "";
        const title = typeof item?.title === "string" ? item.title.trim() : "";
        if (link && isLikelyVnEconomyArticle(link, title)) {
          articleLinks.add(link);
        }
      }
    } catch {
      // ignore one feed failing
    }
  }

  return Array.from(articleLinks);
}

async function parseHtmlLinks(url: string, source: SourceKey) {
  const html = await fetchText(url);
  const $ = cheerio.load(html);
  const collected = new Set<string>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;

    const normalized = normalizeUrl(href, url);
    if (!normalized) return;

    const anchorText = normalizeSpaces($(element).text());
    if (!isLikelyArticleUrl(source, normalized, anchorText)) return;

    collected.add(normalized);
  });

  return Array.from(collected);
}

export async function discoverArticleLinks(source: SourceKey): Promise<string[]> {
  const collected = new Set<string>();

  if (source === "vneconomy") {
    try {
      const rssLinks = await fetchVnEconomyRssLinks();
      for (const link of rssLinks) collected.add(link);
    } catch {
      // fallback to html parsing below
    }
  }

  for (const url of SOURCE_URLS[source]) {
    try {
      const links = await parseHtmlLinks(url, source);
      for (const link of links) collected.add(link);
    } catch {
      // ignore one source endpoint failing
    }
  }

  return Array.from(collected).slice(0, 16);
}
