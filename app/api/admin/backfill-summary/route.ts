/**
 * /api/admin/backfill-summary
 *
 * Re-generate summary cho các bài CHƯA có 3 field mới (context, keyNumbers, whatToWatch).
 * Dùng sau khi đổi schema summary v3.
 *
 * Usage:
 *   GET /api/admin/backfill-summary?limit=3
 *
 * An toàn quota: default limit=3, chạy tuần tự với sleep 2s giữa mỗi call.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateSummary } from "@/lib/openai";
import { SourceKey } from "@/lib/types";

export const maxDuration = 60;

function authorized(request: Request) {
  const header = request.headers.get("x-cron-secret");
  const secret = process.env.CRON_SECRET;
  return !!secret && header === secret;
}

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapSourceLabel(sourceId: number): string {
  return sourceId === 1 ? "VnEconomy" : "Nghiên cứu Quốc tế";
}

function mapArticleType(sourceId: number): string {
  return sourceId === 1 ? "news_analysis" : "opinion_translation";
}

type Target = {
  article_id: string;
  title: string;
  clean_text: string;
  raw_text: string | null;
  source_id: number;
  has_new_fields: boolean;
};

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "3", 10), 10);

  // Tìm article_summaries thiếu 3 field mới HOẶC dùng fallback (conclusion "dự phòng")
  const { data, error } = await supabase
    .from("article_summaries")
    .select(`
      article_id,
      context_text,
      key_numbers_json,
      what_to_watch_text,
      conclusion_text,
      articles!inner(title, clean_text, raw_text, source_id)
    `)
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Lọc các bài cần backfill
  const targets: Target[] = (data || [])
    .filter((row: any) => {
      const missing =
        !row.context_text || !row.what_to_watch_text || row.key_numbers_json === null;
      const isFallback =
        row.conclusion_text?.includes("dự phòng") ||
        row.conclusion_text?.includes("tạm dùng");
      return missing || isFallback;
    })
    .slice(0, limit)
    .map((row: any) => ({
      article_id: row.article_id,
      title: row.articles.title,
      clean_text: row.articles.clean_text || "",
      raw_text: row.articles.raw_text,
      source_id: row.articles.source_id,
      has_new_fields: !!row.context_text && !!row.what_to_watch_text,
    }));

  if (targets.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "Không còn bài nào cần backfill.",
      processed: 0,
    });
  }

  const results: Array<{ article_id: string; title: string; status: string; error?: string }> =
    [];

  for (const target of targets) {
    try {
      const summary = await generateSummary({
        title: target.title,
        excerpt: "",
        content: target.clean_text || target.raw_text || "",
        sourceLabel: mapSourceLabel(target.source_id),
        articleType: mapArticleType(target.source_id),
      });

      const { error: updateError } = await supabase
        .from("article_summaries")
        .update({
          summary_short: summary.summaryShort,
          what_it_really_says: summary.whatItReallySays,
          why_it_matters: summary.whyItMatters,
          easy_explanation: summary.easyExplanation,
          key_takeaway: summary.keyTakeaway,
          caution_note: summary.cautionNote,
          conclusion_text: summary.conclusionText,
          context_text: summary.context ?? null,
          key_numbers_json: summary.keyNumbers ?? null,
          what_to_watch_text: summary.whatToWatch ?? null,
          table_json: summary.tableData ?? null,
          diagram_json: summary.diagramHint ? { hint: summary.diagramHint } : null,
          output_json: summary,
          updated_at: new Date().toISOString(),
        })
        .eq("article_id", target.article_id);

      if (updateError) throw updateError;

      results.push({
        article_id: target.article_id,
        title: target.title,
        status: "ok",
      });

      // Tránh rate limit: sleep 2s giữa mỗi call
      await sleep(2000);
    } catch (error) {
      results.push({
        article_id: target.article_id,
        title: target.title,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    results,
  });
}
