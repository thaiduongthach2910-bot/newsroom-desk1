export type SourceKey = "vneconomy" | "nghiencuuquocte";
export type ImportanceLevel = "high" | "medium" | "low";
export type ArticleType = "news_analysis" | "opinion_translation";

export interface SummaryBlock {
  summaryShort: string;
  whatItReallySays: string;
  whyItMatters: string;
  easyExplanation: string;
  keyTakeaway: string;
  cautionNote: string;
  conclusionText: string;
  tableData?: Array<Record<string, string | number>>;
  diagramHint?: string;
}

export interface ArticleRecord {
  id: string;
  slug: string;
  source: SourceKey;
  sourceLabel: string;
  url: string;
  title: string;
  excerpt: string;
  content: string;
  imageUrl?: string;
  publishedAt: string;
  articleType: ArticleType;
  importanceLevel: ImportanceLevel;
  importanceScore: number;
  keepArticle: boolean;
  isPromotional: boolean;
  summary: SummaryBlock;
}

export interface DailyDigestItem {
  slug: string;
  title?: string;
  sourceLabel?: string;
}

export interface DailyDigest {
  date: string;
  title: string;
  intro: string;
  articleSlugs: string[];
  items?: DailyDigestItem[];
}

export interface HomepageData {
  featured: ArticleRecord | null;
  topStories: ArticleRecord[];
  latest: ArticleRecord[];
  digest: DailyDigest | null;
}
