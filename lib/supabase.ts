import { createClient } from "@supabase/supabase-js";
import { mockArticles, mockDigest } from "@/lib/mock-data";
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
    excerpt: row.article_summaries?.summary_short || row.article_summaries?.[0]?.summary_short || row.clean_text?.slice(0, 220) || "",
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
  if (!supabase) return mockDigest;

  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("daily_digests")
    .select("digest_date, title, intro_text, digest_json")
    .eq("digest_date", today)
    .maybeSingle();

  if (!data) return mockDigest;

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

  return {
    featured: articles[0] ?? null,
    topStories: articles.slice(1, 5),
    latest: articles.slice(0, 12),
    digest,
  };
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

  const sourceId = sourceRow?.id;
  if (!sourceId) throw new Error(`Không tìm thấy source_id cho ${sourceName}`);

  const { data: upsertedArticle, error: articleError } = await supabase
    .from("articles")
    .upsert(
      {
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
      },
      { onConflict: "url" }
    )
    .select("id")
    .single();

  if (articleError) throw articleError;

  const articleId = upsertedArticle.id;

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

  return { mode: "stored" as const, articleId };
}

export async function storeDigest(digest: DailyDigest) {
  const supabase = getSupabaseClient();
  if (!supabase) return { mode: "preview" as const };

  const { data: digestRow, error: digestError } = await supabase
    .from("daily_digests")
    .upsert(
      {
        digest_date: digest.date,
        title: digest.title,
        intro_text: digest.intro,
        digest_json: { articleSlugs: digest.articleSlugs, items: digest.items || [] },
      },
      { onConflict: "digest_date" }
    )
    .select("id")
    .single();

  if (digestError) throw digestError;

  const digestId = digestRow.id;

  const articles = await getArticles();
  const bySlug = new Map(articles.map((article) => [article.slug, article.id]));

  for (const [index, slug] of digest.articleSlugs.entries()) {
    const articleId = bySlug.get(slug);
    if (!articleId) continue;

    await supabase.from("digest_articles").upsert(
      {
        digest_id: digestId,
        article_id: articleId,
        rank_order: index + 1,
      },
      { onConflict: "digest_id,article_id" }
    );
  }

  return { mode: "stored" as const, digestId };
}
