import * as cheerio from "cheerio";
import { XMLParser } from "fast-xml-parser";
import { SourceKey } from "@/lib/types";

const SOURCE_URLS: Record<SourceKey, string[]> = {
  vneconomy: ["https://vneconomy.vn/rss.html", "https://vneconomy.vn/"],
  nghiencuuquocte: ["https://nghiencuuquocte.org/"],
};

const VNECONOMY_BLOCKLIST = new Set([
  "rss",
  "rss.html",
  "podcast",
  "chung-khoan",
  "infographics",
  "tieu-dung",
  "thuong-vu-anh",
  "emagazine",
  "tai-chinh",
  "thi-truong",
  "bat-dong-san",
  "kinh-te-so",
  "the-gioi",
  "xa-hoi",
  "du-lich",
  "nhip-song-so",
  "goc-nhin",
  "doanh-nghiep",
  "vi-mo",
  "kinh-te-xanh",
]);

function normalizeUrl(href: string, base: string) {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function filenameFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").filter(Boolean).pop() || "";
    return last.replace(/\.htm$/i, "").toLowerCase();
  } catch {
    return "";
  }
}

function isRecentNghienCuuQuocTeUrl(url: string) {
  const match = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  if (!match) return false;

  const [, y, m, d] = match;
  const published = new Date(`${y}-${m}-${d}T00:00:00+07:00`);
  const now = new Date();
  const diffMs = now.getTime() - published.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays >= -1 && diffDays <= 7;
}

function isLikelyArticleUrl(source: SourceKey, url: string) {
  if (source === "vneconomy") {
    if (!url.startsWith("https://vneconomy.vn/") || !url.endsWith(".htm")) return false;
    if (url.includes("/rss") || url.includes("javascript:")) return false;

    const filename = filenameFromUrl(url);
    if (!filename) return false;
    if (VNECONOMY_BLOCKLIST.has(filename)) return false;
    if (filename.split("-").length < 4) return false;

    return true;
  }

  return (
    url.startsWith("https://nghiencuuquocte.org/") &&
    /\d{4}\/\d{2}\/\d{2}/.test(url) &&
    isRecentNghienCuuQuocTeUrl(url)
  );
}

async function parseVnEconomyRss(url: string) {
  const xml = await fetch(url, {
    headers: { "user-agent": "news-dashboard-v3/1.0" },
    next: { revalidate: 1800 },
  }).then((res) => res.text());

  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);
  const channels = parsed?.rss?.channel;
  const channelArray = Array.isArray(channels) ? channels : [channels].filter(Boolean);
  const links = new Set<string>();

  for (const channel of channelArray) {
    const items = Array.isArray(channel?.item) ? channel.item : [channel?.item].filter(Boolean);
    for (const item of items) {
      const link = item?.link;
      if (typeof link === "string" && isLikelyArticleUrl("vneconomy", link)) {
        links.add(link.trim());
      }
    }
  }

  return Array.from(links);
}

async function parseHtmlLinks(url: string, source: SourceKey) {
  const html = await fetch(url, {
    headers: { "user-agent": "news-dashboard-v3/1.0" },
    next: { revalidate: 1800 },
  }).then((res) => res.text());

  const $ = cheerio.load(html);
  const collected = new Set<string>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    const normalized = normalizeUrl(href, url);
    if (!normalized) return;
    if (isLikelyArticleUrl(source, normalized)) {
      collected.add(normalized);
    }
  });

  return Array.from(collected);
}

export async function discoverArticleLinks(source: SourceKey): Promise<string[]> {
  const collected = new Set<string>();

  if (source === "vneconomy") {
    try {
      for (const link of await parseVnEconomyRss(SOURCE_URLS.vneconomy[0])) {
        collected.add(link);
      }
    } catch {}
  }

  for (const url of SOURCE_URLS[source]) {
    try {
      for (const link of await parseHtmlLinks(url, source)) {
        collected.add(link);
      }
    } catch {}
  }

  return Array.from(collected).slice(0, 20);
}
