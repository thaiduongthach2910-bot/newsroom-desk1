import { createClient } from "@supabase/supabase-js";
import { mockArticles } from "@/lib/mock-data";
import { ArticleRecord, DailyDigest, HomepageData, SourceKey } from "@/lib/types";

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function mapSource(name: string | null | undefined): SourceKey {
  if (!name) return "vneconomy";
  return name.toLowerCase().includes("nghien") ? "nghiencuuquocte" : "vneconomy";
}

function normalizeTitleKey(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSummary(summaryRow: any) {
  const row = Array.isArray(summaryRow) ? summaryRow[0] : summaryRow;
  return {
    summaryShort: row?.summary_short ?? "",
    whatItReallySays: row?.what_it_really_says ?? "",
    whyItMatters: row?.why_it_matters ?? "",
    easyExplanation: row?.easy_explanation ?? "",
    keyTakeaway: row?.key_takeaway ?? "",
    cautionNote: row?.caution_note ?? "",
    conclusionText: row?.conclusion_text ?? "",
    tableData: row?.table_json ?? undefined,
    diagramHint: row?.diagram_json?.hint ?? row?.output_json?.diagramHint ?? "none",
  };
}

function mapArticleRow(row: any): ArticleRecord {
  const sourceName = Array.isArray(row.sources) ? row.sources[0]?.name : row.sources?.name;
  return {
    id: row.id,
    slug: row.url?.split("/").pop()?.replace(".htm", "") ?? row.id,
    source: mapSource(sourceName),
    sourceLabel: sourceName ?? "Nguồn tin",
    url: row.url,
    title: row.title,
    excerpt:
      row.article_summaries?.summary_short ||
      row.article_summaries?.[0]?.summary_short ||
      row.clean_text?.slice(0, 220) ||
      "",
    content: row.clean_text || row.raw_text || "",
    imageUrl: row.image_url || row.output_json?.imageUrl || undefined,
    publishedAt: row.published_at || row.scraped_at || new Date().toISOString(),
    articleType: row.article_type === "opinion_translation" ? "opinion_translation" : "news_analysis",
    importanceLevel: row.importance_level || "low",
    importanceScore: row.importance_score || 0,
    keepArticle: row.keep_article ?? true,
    isPromotional: row.is_promotional ?? false,
    summary: normalizeSummary(row.article_summaries),
  };
}

export async function getArticles(source?: SourceKey): Promise<ArticleRecord[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return source ? mockArticles.filter((article) => article.source === source) : mockArticles;
  }

  const query = supabase
    .from("articles")
    .select(`
      id,
      url,
      title,
      published_at,
      scraped_at,
      raw_text,
      clean_text,
      article_type,
      is_promotional,
      keep_article,
      importance_score,
      importance_level,
      sources(name),
      article_summaries(
        summary_short,
        what_it_really_says,
        why_it_matters,
        easy_explanation,
        key_takeaway,
        caution_note,
        conclusion_text,
        table_json,
        diagram_json,
        output_json
      )
    `)
    .eq("keep_article", true)
    .order("published_at", { ascending: false })
    .limit(32);

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    return source ? mockArticles.filter((article) => article.source === source) : mockArticles;
  }

  const mapped = data.map(mapArticleRow);
  return source ? mapped.filter((article) => article.source === source) : mapped;
}

export async function getArticleBySlug(slug: string): Promise<ArticleRecord | null> {
  const articles = await getArticles();
  return articles.find((article) => article.slug === slug) ?? null;
}

export async function getDigest(): Promise<DailyDigest | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  // Lấy digest mới nhất trong 2 ngày gần đây (để không trống nếu cron 06:00 chưa chạy)
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data } = await supabase
    .from("daily_digests")
    .select("digest_date, title, intro_text, digest_json")
    .gte("digest_date", twoDaysAgo)
    .order("digest_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    date: data.digest_date,
    title: data.title,
    intro: data.intro_text || "",
    articleSlugs: data.digest_json?.articleSlugs || [],
    items: data.digest_json?.items || [],
  };
}

export async function getHomepageData(): Promise<HomepageData> {
  const articles = await getArticles();
  const digest = await getDigest();

  // Tính điểm "nổi bật" = importanceScore + bonus độ mới (bài mới 24h được ưu tiên)
  const now = Date.now();
  const scored = articles.map((article) => {
    const ageHours = Math.max(
      0,
      (now - new Date(article.publishedAt).getTime()) / (1000 * 60 * 60)
    );
    // Bài trong 24h: bonus tối đa +15; sau 48h: 0
    const freshnessBonus = Math.max(0, 15 - ageHours * 0.6);
    return { article, rank: (article.importanceScore || 0) + freshnessBonus };
  });

  const byRank = [...scored].sort((a, b) => b.rank - a.rank).map((x) => x.article);

  // Hero: bài có rank cao nhất
  const featured = byRank[0] ?? null;

  // Top stories: 4 bài tiếp theo theo rank, loại trùng featured
  const topStories = byRank.filter((a) => a.slug !== featured?.slug).slice(0, 4);

  // Latest: vẫn theo publishedAt mới nhất (đã sort từ getArticles)
  const latest = articles.slice(0, 12);

  return { featured, topStories, latest, digest };
}

async function findExistingArticleId(
  supabase: any,
  params: { sourceId: number; url: string; title: string; publishedAt: string }
): Promise<string | undefined> {
  const exactUrl = await supabase.from("articles").select("id").eq("url", params.url).maybeSingle();
  const exactUrlData = exactUrl.data as { id?: string } | null;
  if (exactUrlData?.id) return exactUrlData.id;

  const sameTitleAndTime = await supabase
    .from("articles")
    .select("id")
    .eq("source_id", params.sourceId)
    .eq("title", params.title)
    .eq("published_at", params.publishedAt)
    .maybeSingle();
  const sameTitleAndTimeData = sameTitleAndTime.data as { id?: string } | null;
  if (sameTitleAndTimeData?.id) return sameTitleAndTimeData.id;

  const recentCandidates = await supabase
    .from("articles")
    .select("id,title,published_at")
    .eq("source_id", params.sourceId)
    .gte("published_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("published_at", { ascending: false })
    .limit(20);

  const candidates = (recentCandidates.data as Array<{ id: string; title: string; published_at: string }> | null) ?? [];
  const targetKey = normalizeTitleKey(params.title);
  const targetDay = params.publishedAt.slice(0, 10);

  for (const row of candidates) {
    if (!row.title) continue;
    if (normalizeTitleKey(row.title) === targetKey && row.published_at?.slice(0, 10) === targetDay) {
      return row.id;
    }
  }

  return undefined;
}

export async function storeArticle(article: ArticleRecord) {
  const supabase = getSupabaseClient();
  if (!supabase) return { mode: "preview" as const };

  const sourceName = article.source === "vneconomy" ? "VnEconomy" : "Nghien cuu Quoc te";

  const { data: sourceRow } = await supabase
    .from("sources")
    .select("id")
    .eq("name", sourceName)
    .maybeSingle();

  const sourceId = (sourceRow as { id?: number } | null)?.id;
  if (!sourceId) throw new Error(`Không tìm thấy source_id cho ${sourceName}`);

  const existingId = await findExistingArticleId(supabase as any, {
    sourceId,
    url: article.url,
    title: article.title,
    publishedAt: article.publishedAt,
  });

  let articleId = existingId;

  if (articleId) {
    const { error: updateError } = await supabase
      .from("articles")
      .update({
        source_id: sourceId,
        url: article.url,
        title: article.title,
        published_at: article.publishedAt,
        raw_text: article.content,
        clean_text: article.content,
        author_name: null,
        article_type: article.articleType,
        is_promotional: article.isPromotional,
        keep_article: article.keepArticle,
        importance_score: article.importanceScore,
        importance_level: article.importanceLevel,
        status: "summarized",
      })
      .eq("id", articleId);

    if (updateError) throw updateError;
  } else {
    const { data: insertedArticle, error: articleError } = await supabase
      .from("articles")
      .insert({
        source_id: sourceId,
        url: article.url,
        title: article.title,
        published_at: article.publishedAt,
        raw_text: article.content,
        clean_text: article.content,
        author_name: null,
        article_type: article.articleType,
        is_promotional: article.isPromotional,
        keep_article: article.keepArticle,
        importance_score: article.importanceScore,
        importance_level: article.importanceLevel,
        status: "summarized",
      })
      .select("id")
      .single();

    if (articleError) throw articleError;
    articleId = (insertedArticle as { id: string }).id;
  }

  const { error: summaryError } = await supabase.from("article_summaries").upsert(
    {
      article_id: articleId,
      summary_short: article.summary.summaryShort,
      what_it_really_says: article.summary.whatItReallySays,
      why_it_matters: article.summary.whyItMatters,
      easy_explanation: article.summary.easyExplanation,
      key_takeaway: article.summary.keyTakeaway,
      caution_note: article.summary.cautionNote,
      conclusion_text: article.summary.conclusionText,
      table_json: article.summary.tableData ?? null,
      diagram_json: article.summary.diagramHint ? { hint: article.summary.diagramHint } : null,
      output_json: article.summary,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "article_id" }
  );

  if (summaryError) throw summaryError;

  return { mode: existingId ? ("updated" as const) : ("stored" as const), articleId };
}

export async function storeDigest(digest: DailyDigest) {
  const supabase = getSupabaseClient();
  if (!supabase) return { mode: "preview" as const };

  // LƯU Ý: schema daily_digests KHÔNG có cột updated_at, chỉ có created_at.
  // Trước đây code ghi updated_at làm upsert 500 và toàn bộ morning-digest
  // chưa bao giờ tạo được bản ghi nào.
  const { error } = await supabase.from("daily_digests").upsert(
    {
      digest_date: digest.date,
      title: digest.title,
      intro_text: digest.intro,
      digest_json: {
        articleSlugs: digest.articleSlugs,
        items: digest.items ?? [],
      },
    },
    { onConflict: "digest_date" }
  );

  if (error) throw error;
  return { mode: "stored" as const };
}
