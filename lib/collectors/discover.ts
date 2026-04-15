import * as cheerio from "cheerio";
import { SourceKey } from "@/lib/types";

const SOURCE_URLS: Record<SourceKey, string[]> = {
  vneconomy: ["https://vneconomy.vn/", "https://vneconomy.vn/rss.html"],
  nghiencuuquocte: ["https://nghiencuuquocte.org/"],
};

function normalizeUrl(href: string, base: string) {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function isLikelyArticleUrl(source: SourceKey, url: string) {
  if (source === "vneconomy") {
    return url.startsWith("https://vneconomy.vn/") &&
      url.endsWith(".htm") &&
      !url.includes("/rss") &&
      !url.includes("javascript:");
  }

  return (
    url.startsWith("https://nghiencuuquocte.org/") &&
    /\d{4}\/\d{2}\/\d{2}/.test(url)
  );
}

export async function discoverArticleLinks(source: SourceKey): Promise<string[]> {
  const urls = SOURCE_URLS[source];
  const collected = new Set<string>();

  for (const url of urls) {
    const html = await fetch(url, {
      headers: {
        "user-agent": "news-dashboard-v1/1.0",
      },
      next: { revalidate: 1800 },
    }).then((res) => res.text());

    const $ = cheerio.load(html);

    $("a[href]").each((_, element) => {
      const href = $(element).attr("href");
      if (!href) return;
      const normalized = normalizeUrl(href, url);
      if (!normalized) return;
      if (isLikelyArticleUrl(source, normalized)) {
        collected.add(normalized);
      }
    });
  }

  return Array.from(collected).slice(0, 20);
}
