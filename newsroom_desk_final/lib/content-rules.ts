import { ArticleType, ImportanceLevel, SourceKey } from "@/lib/types";

const HIGH_IMPORTANCE_KEYWORDS = [
  "thuế",
  "lãi suất",
  "fed",
  "địa chính trị",
  "chiến tranh",
  "trung đông",
  "chuỗi cung ứng",
  "xuất khẩu",
  "nhập khẩu",
  "thị trường",
  "chính sách",
  "quốc hội",
  "ngân hàng",
  "tỷ giá",
  "logistics",
  "iran",
  "israel",
  "trump",
  "trung quốc",
];

const MEDIUM_IMPORTANCE_KEYWORDS = [
  "đầu tư",
  "diễn đàn",
  "hội chợ",
  "triển lãm",
  "doanh nghiệp",
  "thương mại",
  "công nghệ",
  "chuẩn mực",
  "pháp lý",
  "khu vực",
];

const PROMOTIONAL_KEYWORDS = [
  "đăng ký ngay",
  "ưu đãi đặc biệt",
  "khuyến mại",
  "giảm giá",
  "mua ngay",
  "đặt chỗ ngay",
  "sponsored",
  "tài trợ",
];

const EXEMPT_EVENT_KEYWORDS = [
  "hội chợ",
  "triển lãm",
  "diễn đàn",
  "xúc tiến",
  "kết nối giao thương",
  "roadshow",
];

export function detectArticleType(source: SourceKey, title: string, content: string): ArticleType {
  const text = `${title} ${content}`.toLowerCase();
  if (
    source === "nghiencuuquocte" ||
    text.includes("biên dịch") ||
    text.includes("foreign affairs") ||
    text.includes("foreign policy") ||
    text.includes("bình luận")
  ) {
    return "opinion_translation";
  }
  return "news_analysis";
}

export function isPromotionalArticle(title: string, excerpt: string, content: string): boolean {
  const text = `${title} ${excerpt} ${content}`.toLowerCase();
  const hasPromotionalSignals = PROMOTIONAL_KEYWORDS.some((keyword) => text.includes(keyword));
  const hasEventInformation = EXEMPT_EVENT_KEYWORDS.some((keyword) => text.includes(keyword));
  return hasPromotionalSignals && !hasEventInformation;
}

export function scoreImportance(title: string, excerpt: string, content: string): {
  score: number;
  level: ImportanceLevel;
} {
  const text = `${title} ${excerpt} ${content}`.toLowerCase();
  let score = 35;

  for (const keyword of HIGH_IMPORTANCE_KEYWORDS) {
    if (text.includes(keyword)) score += 10;
  }

  for (const keyword of MEDIUM_IMPORTANCE_KEYWORDS) {
    if (text.includes(keyword)) score += 5;
  }

  if (text.includes("việt nam")) score += 8;
  if (text.includes("toàn cầu") || text.includes("quốc tế")) score += 6;
  if (text.length > 5000) score += 4;

  score = Math.min(100, score);

  let level: ImportanceLevel = "low";
  if (score >= 80) level = "high";
  else if (score >= 60) level = "medium";

  return { score, level };
}
