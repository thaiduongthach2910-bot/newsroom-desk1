import * as cheerio from "cheerio";
import { SourceKey } from "@/lib/types";

const SOURCE_URLS: Record<SourceKey, string[]> = {
  vneconomy: ["https://vneconomy.vn/"],
  nghiencuuquocte: ["https://nghiencuuquocte.org/"],
};

const BLOCKED_VNECONOMY_EXACT_SLUGS = new Set([
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
]);

const BLOCKED_VNECONOMY_ANCHOR_TEXT = [
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
  "xem thêm",
  "đọc tiếp",
  "xem chi tiết",
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

function isFreshDateFromUrl(url: string, maxDays = 5) {
  const match = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  if (!match) return false;

  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;

  const diffDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= maxDays;
}

function normalizeAnchorText(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function isBlockedAnchorText(text: string) {
  const cleaned = normalizeAnchorText(text);
  if (!cleaned) return true;
  if (cleaned.length < 28) return true;
  return BLOCKED_VNECONOMY_ANCHOR_TEXT.some((item) => cleaned === item || cleaned.startsWith(item + " "));
}

function isLikelyVnEconomyArticle(url: string, anchorText: string) {
  if (!url.startsWith("https://vneconomy.vn/")) return false;
  if (!url.endsWith(".htm")) return false;

  const slug = slugFromUrl(url);
  const hyphenCount = (slug.match(/-/g) || []).length;

  if (!slug) return false;
  if (BLOCKED_VNECONOMY_EXACT_SLUGS.has(slug)) return false;
  if (slug.length < 34 || hyphenCount < 6) return false;
  if (/^(video|podcast|infographics?)-/i.test(slug)) return false;
  if (isBlockedAnchorText(anchorText)) return false;

  return true;
}

function isLikelyNghienCuuQuocTeArticle(url: string, anchorText: string) {
  if (!url.startsWith("https://nghiencuuquocte.org/")) return false;
  if (!/\/(\d{4})\/(\d{2})\/(\d{2})\//.test(url)) return false;
  if (/the-gioi-hom-nay/i.test(url)) return false;

  const cleaned = normalizeAnchorText(anchorText);
  if (cleaned.length < 16) return false;

  return isFreshDateFromUrl(url, 5);
}

function isLikelyArticleUrl(source: SourceKey, url: string, anchorText = "") {
  return source === "vneconomy"
    ? isLikelyVnEconomyArticle(url, anchorText)
    : isLikelyNghienCuuQuocTeArticle(url, anchorText);
}

async function fetchText(url: string) {
  const res = await fetch(url, {
    headers: { "user-agent": "newsroom-desk/1.0" },
    next: { revalidate: 1800 },
  });

  if (!res.ok) throw new Error(`Fetch failed for ${url}: ${res.status}`);
  return res.text();
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

    const anchorText = $(element).text().replace(/\s+/g, " ").trim();
    if (!isLikelyArticleUrl(source, normalized, anchorText)) return;

    collected.add(normalized);
  });

  return Array.from(collected);
}

export async function discoverArticleLinks(source: SourceKey): Promise<string[]> {
  const collected = new Set<string>();

  for (const url of SOURCE_URLS[source]) {
    try {
      const links = await parseHtmlLinks(url, source);
      for (const link of links) collected.add(link);
    } catch {
      // ignore one source endpoint failing
    }
  }

  return Array.from(collected).slice(0, 10);
}
