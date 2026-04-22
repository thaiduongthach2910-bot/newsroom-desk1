import { NextResponse } from "next/server";
import { discoverArticleLinks } from "@/lib/collectors/discover";
import { parseArticle } from "@/lib/collectors/parse-article";
import { storeArticle } from "@/lib/supabase";
import { SourceKey } from "@/lib/types";

// Vercel hobby plan: max 60s serverless function. Pro: 300s.
// Ta giới hạn runtime bằng tay thấp hơn để luôn trả về được trước khi Vercel kill.
export const maxDuration = 60;

// Ngân sách thời gian mềm cho cả run: dừng xử lý bài mới khi vượt.
const RUN_BUDGET_MS = 50_000;

// Tối đa số bài xử lý mỗi source mỗi run.
// Vì summary giờ dùng gemini-2.5-pro (100 RPD free tier), phải chặt tay hơn.
// Tính toán: collect 15 phút/lần × 96 runs/ngày × 1 bài/nguồn × 2 nguồn = tối đa 192 calls/ngày
// Thực tế (trừ dedupe skip): ~30-50 calls/ngày — an toàn dưới 100 quota Pro.
// Nếu Pro hết quota, code tự fallback sang Flash (250 RPD).
const MAX_LINKS_PER_SOURCE = 1;

// Timeout cứng cho parse+summarize 1 bài (bao cả gọi Gemini ~45s bên trong).
const PER_ARTICLE_TIMEOUT_MS = 55_000;

function authorized(request: Request) {
  const header = request.headers.get("x-cron-secret");
  const secret = process.env.CRON_SECRET;
  return !!secret && header === secret;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout ${ms}ms: ${label}`)),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

type ItemResult = {
  url: string;
  stored: "stored" | "updated" | "skipped" | "error" | "timeout" | "budget-exceeded";
  error?: string;
};

async function collectSource(
  source: SourceKey,
  deadlineAt: number
): Promise<ItemResult[]> {
  const results: ItemResult[] = [];

  let links: string[] = [];
  try {
    links = await withTimeout(
      discoverArticleLinks(source),
      15_000,
      `discover ${source}`
    );
  } catch (error) {
    results.push({
      url: `discover:${source}`,
      stored: "error",
      error: error instanceof Error ? error.message : String(error),
    });
    return results;
  }

  const picked = links.slice(0, MAX_LINKS_PER_SOURCE);

  for (const url of picked) {
    // Budget check: nếu còn ít hơn 5s cho bài tiếp → dừng sớm, để lần sau làm
    if (Date.now() > deadlineAt - 5_000) {
      results.push({ url, stored: "budget-exceeded" });
      continue;
    }

    try {
      const article = await withTimeout(
        parseArticle(url, source),
        PER_ARTICLE_TIMEOUT_MS,
        `parseArticle ${url}`
      );

      if (!article) {
        results.push({ url, stored: "skipped" });
        continue;
      }

      if (!article.keepArticle) {
        results.push({ url, stored: "skipped" });
        continue;
      }

      const saved = await storeArticle(article);
      results.push({
        url,
        stored: saved.mode === "updated" ? "updated" : "stored",
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isTimeout = /timeout/i.test(msg);
      results.push({
        url,
        stored: isTimeout ? "timeout" : "error",
        error: msg,
      });
    }
  }

  return results;
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const deadlineAt = startedAt + RUN_BUDGET_MS;

  const vneconomy = await collectSource("vneconomy", deadlineAt).catch((error) => [
    {
      url: "vneconomy:root",
      stored: "error" as const,
      error: error instanceof Error ? error.message : String(error),
    },
  ]);

  const nghiencuuquocte = await collectSource(
    "nghiencuuquocte",
    deadlineAt
  ).catch((error) => [
    {
      url: "nghiencuuquocte:root",
      stored: "error" as const,
      error: error instanceof Error ? error.message : String(error),
    },
  ]);

  const elapsedMs = Date.now() - startedAt;

  return NextResponse.json({
    ok: true,
    elapsedMs,
    budgetMs: RUN_BUDGET_MS,
    summary: {
      vneconomy: vneconomy.length,
      nghiencuuquocte: nghiencuuquocte.length,
    },
    items: {
      vneconomy,
      nghiencuuquocte,
    },
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
