import * as cheerio from "cheerio";
import { XMLParser } from "fast-xml-parser";
import { SourceKey } from "@/lib/types";

const SOURCE_URLS: Record<SourceKey, string[]> = {
  vneconomy: ["https://vneconomy.vn/rss.html", "https://vneconomy.vn/"],
  nghiencuuquocte: ["https://nghiencuuquocte.org/"],
};

const BLOCKED_VNECONOMY_PREFIXES = [
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
  "rss",
  "rss.html",
];

const BLOCKED_ANCHOR_TEXT = [
  "thị trường vốn",
  "diễn đàn",
  "diễn đàn kinh tế xanh",
  "bảo hiểm",
  "ngân hàng",
  "tài chính",
  "khung pháp lý",
  "pháp lý",
  "tiêu dùng",
  "infographics",
  "podcast",
  "emagazine",
  "e-magazine",
  "kinh tế xanh",
  "thương vụ anh",
  "đọc tiếp",
  "xem thêm",
  "chi tiết",
  "tại đây",
];

const RELEVANT_NGHIENCUU_KEYWORDS = [
  "asean",
  "trung quốc",
  "mỹ",
  "nga",
  "ukraine",
  "eu",
  "nato",
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

function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
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

function isBlockedAnchorText(text: string) {
  const cleaned = cleanText(text);
  if (!cleaned) return false;
  if (BLOCKED_ANCHOR_TEXT.some((item) => cleaned === item || cleaned.startsWith(item + " "))) return true;
  if (cleaned.length < 12) return true;
  return false;
}

function isLikelyVnEconomyArticle(url: string, anchorText = "") {
  if (!url.startsWith("https://vneconomy.vn/")) return false;
  if (!url.endsWith(".htm")) return false;

  const slug = slugFromUrl(url);
  const hyphenCount = (slug.match(/-/g) || []).length;

  if (!slug || slug.length < 16 || hyphenCount < 3) return false;
  if (BLOCKED_VNECONOMY_PREFIXES.some((prefix) => slug === prefix || slug.startsWith(prefix + "-"))) return false;
  if (anchorText && isBlockedAnchorText(anchorText)) return false;

  return true;
}

function isLikelyNghienCuuQuocTeArticle(url: string, anchorText = "") {
  if (!url.startsWith("https://nghiencuuquocte.org/")) return false;
  if (!/\/(\d{4})\/(\d{2})\/(\d{2})\//.test(url)) return false;
  if (!isFreshDateFromUrl(url, 4)) return false;

  const cleaned = cleanText(anchorText);
  if (cleaned.includes("thế giới hôm nay")) return false;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}\s*:/.test(cleaned)) return false;
  if (cleaned && !RELEVANT_NGHIENCUU_KEYWORDS.some((kw) => cleaned.includes(kw))) return false;

  return true;
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

function parseRssItems(xml: string, source: SourceKey) {
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);
  const channels = parsed?.rss?.channel;
  const channelArray = Array.isArray(channels) ? channels : [channels].filter(Boolean);
  const collected = new Set<string>();

  for (const channel of channelArray) {
    const items = Array.isArray(channel?.item) ? channel.item : [channel?.item].filter(Boolean);
    for (const item of items) {
      const link = typeof item?.link === "string" ? item.link.trim() : "";
      const title = typeof item?.title === "string" ? item.title.trim() : "";
      if (link && isLikelyArticleUrl(source, link, title)) collected.add(link);
    }
  }

  return Array.from(collected);
}

async function parseHtmlLinks(url: string, source: SourceKey) {
  const html = await fetchText(url);
  const $ = cheerio.load(html);
  const collected = new Set<string>();
  const feedUrls = new Set<string>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;

    const normalized = normalizeUrl(href, url);
    if (!normalized) return;

    const anchorText = $(element).text().replace(/\s+/g, " ").trim();
    if (isLikelyArticleUrl(source, normalized, anchorText)) {
      collected.add(normalized);
      return;
    }

    if (
      source === "vneconomy" &&
      normalized.startsWith("https://vneconomy.vn/") &&
      (/\.rss$/i.test(normalized) || /\/rss/i.test(new URL(normalized).pathname))
    ) {
      feedUrls.add(normalized);
    }
  });

  if (source === "vneconomy" && feedUrls.size > 0) {
    for (const feedUrl of Array.from(feedUrls).slice(0, 10)) {
      try {
        const feedXml = await fetchText(feedUrl);
        for (const link of parseRssItems(feedXml, "vneconomy")) collected.add(link);
      } catch {
        // ignore one feed failure
      }
    }
  }

  return Array.from(collected);
}

async function parseVnEconomyEndpoint(url: string) {
  const text = await fetchText(url);
  if (/^\s*<\?xml/i.test(text) || /<rss[\s>]/i.test(text)) {
    return parseRssItems(text, "vneconomy");
  }

  const $ = cheerio.load(text);
  const collected = new Set<string>();
  const feedUrls = new Set<string>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    const normalized = normalizeUrl(href, url);
    if (!normalized) return;
    const anchorText = $(element).text().replace(/\s+/g, " ").trim();

    if (isLikelyVnEconomyArticle(normalized, anchorText)) {
      collected.add(normalized);
      return;
    }

    if (/\.rss$/i.test(normalized) || /\/rss/i.test(new URL(normalized).pathname)) {
      feedUrls.add(normalized);
    }
  });

  for (const feedUrl of Array.from(feedUrls).slice(0, 10)) {
    try {
      const feedXml = await fetchText(feedUrl);
      for (const link of parseRssItems(feedXml, "vneconomy")) collected.add(link);
    } catch {
      // ignore one feed failure
    }
  }

  return Array.from(collected);
}

export async function discoverArticleLinks(source: SourceKey): Promise<string[]> {
  const collected = new Set<string>();

  for (const url of SOURCE_URLS[source]) {
    try {
      const links = source === "vneconomy" ? await parseVnEconomyEndpoint(url) : await parseHtmlLinks(url, source);
      for (const link of links) collected.add(link);
    } catch {
      // ignore one source endpoint failing
    }
  }

  return Array.from(collected).slice(0, source === "vneconomy" ? 20 : 12);
}
