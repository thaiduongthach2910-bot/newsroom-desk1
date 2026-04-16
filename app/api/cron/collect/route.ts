import { NextResponse } from "next/server";
import { discoverArticleLinks } from "@/lib/collectors/discover";
import { parseArticle } from "@/lib/collectors/parse-article";
import { storeArticle } from "@/lib/supabase";
import { SourceKey } from "@/lib/types";

function authorized(request: Request) {
  const header = request.headers.get("x-cron-secret");
  const secret = process.env.CRON_SECRET;
  return !!secret && header === secret;
}

async function collectSource(source: SourceKey) {
  const links = await discoverArticleLinks(source);
  const results: Array<{ url: string; stored: string }> = [];

  for (const url of links.slice(0, 10)) {
    const article = await parseArticle(url, source);
    if (!article || !article.keepArticle) continue;

    const saved = await storeArticle(article);
    results.push({
      url,
      stored: saved.mode,
    });
  }

  return results;
}

async function runCollect(request: Request) {
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
  return runCollect(request);
}

export async function POST(request: Request) {
  return runCollect(request);
}
