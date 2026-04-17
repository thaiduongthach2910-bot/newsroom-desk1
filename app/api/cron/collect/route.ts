import { NextResponse } from "next/server";
import { discoverArticleLinks } from "@/lib/collectors/discover";
import { parseArticle } from "@/lib/collectors/parse-article";
import { storeArticle } from "@/lib/supabase";
import { SourceKey } from "@/lib/types";

export const maxDuration = 300;

function authorized(request: Request) {
  const header = request.headers.get("x-cron-secret");
  const secret = process.env.CRON_SECRET;
  return !!secret && header === secret;
}

const MAX_LINKS_PER_SOURCE = 1;

async function collectSource(source: SourceKey) {
  const links = await discoverArticleLinks(source);
  const results: Array<{ url: string; stored: string; error?: string }> = [];

  for (const url of links.slice(0, MAX_LINKS_PER_SOURCE)) {
    try {
      const article = await parseArticle(url, source);
      if (!article || !article.keepArticle) {
        results.push({ url, stored: "skipped" });
        continue;
      }

      const saved = await storeArticle(article);
      results.push({ url, stored: saved.mode });
    } catch (error) {
      results.push({
        url,
        stored: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const vneconomy = await collectSource("vneconomy");
    const nghiencuuquocte = await collectSource("nghiencuuquocte");

    return NextResponse.json({
      ok: true,
      summary: {
        vneconomy: vneconomy.length,
        nghiencuuquocte: nghiencuuquocte.length,
      },
      items: {
        vneconomy,
        nghiencuuquocte,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
