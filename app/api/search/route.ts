import { NextResponse } from "next/server";
import { searchArticles } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 50);

  if (!q.trim()) {
    return NextResponse.json({ query: "", hits: [] });
  }

  try {
    const hits = await searchArticles(q, limit);
    return NextResponse.json({
      query: q,
      hits: hits.map((h) => ({
        slug: h.article.slug,
        title: h.article.title,
        source: h.article.source,
        sourceLabel: h.article.sourceLabel,
        publishedAt: h.article.publishedAt,
        importanceLevel: h.article.importanceLevel,
        snippet: h.snippet,
        matchSource: h.matchSource,
      })),
    });
  } catch (error) {
    console.error("search failed", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
