import * as cheerio from "cheerio";
import { SourceKey } from "@/lib/types";

const SOURCE_URLS: Record<SourceKey, string[]> = {
  vneconomy: ["https://vneconomy.vn/"],
  nghiencuuquocte: ["https://nghiencuuquocte.org/"],
};

const BLOCKED_VNECONOMY_SLUGS = new Set([
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
]);

function normalizeUrl(href: string, base: string) {
  try {
    const url = new URL(href, base);
    url.hash = "";
    if (url.searchParams.toString()) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function getSlug(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").filter(Boolean).pop() || "";
    return last.replace(/\.htm$/i, "").toLowerCase();
  } catch {
    return "";
  }
}

function isFreshDateFromUrl(url: string, maxDays = 7) {
  const match = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  if (!match) return false;

  const [_, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= maxDays;
}

function isLikelyArticleUrl(source: SourceKey, url: string) {
  if (source === "vneconomy") {
    if (!url.startsWith("https://vneconomy.vn/")) return false;
    if (!url.endsWith(".htm")) return false;
    if (url.includes("/rss") || url.includes("javascript:")) return false;

    const slug = getSlug(url);
    const hyphenCount = (slug.match(/-/g) || []).length;
    if (!slug || slug.length < 20 || hyphenCount < 4) return false;
    if (BLOCKED_VNECONOMY_SLUGS.has(slug)) return false;
    if ([...BLOCKED_VNECONOMY_SLUGS].some((item) => slug.startsWith(item + "-"))) return false;
    return true;
  }

  return (
    url.startsWith("https://nghiencuuquocte.org/") &&
    /\/\d{4}\/\d{2}\/\d{2}\//.test(url) &&
    isFreshDateFromUrl(url, 7)
  );
}

async function fetchText(url: string) {
  const res = await fetch(url, {
    headers: { "user-agent": "news-dashboard-v4/1.0" },
    next: { revalidate: 1800 },
  });

  if (!res.ok) {
    throw new Error(`Fetch failed for ${url}: ${res.status}`);
  }

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
    if (!isLikelyArticleUrl(source, normalized)) return;

    collected.add(normalized);
  });

  return Array.from(collected);
}

export async function discoverArticleLinks(source: SourceKey): Promise<string[]> {
  const collected = new Set<string>();

  for (const url of SOURCE_URLS[source]) {
    try {
      for (const link of await parseHtmlLinks(url, source)) collected.add(link);
    } catch {
      // ignore individual discovery source failures
    }
  }

  return Array.from(collected).slice(0, 20);
}
