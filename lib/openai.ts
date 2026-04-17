import OpenAI from "openai";
import { SummaryBlock } from "@/lib/types";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  try {
    return JSON.parse(JSON.stringify(error));
  } catch {
    return { message: String(error) };
  }
}

function isRateLimitError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const e = error as { status?: number; code?: string };
  return e.status === 429 || e.code === "rate_limit_exceeded";
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 1): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= maxRetries) {
        throw error;
      }

      const delay = 1200 * Math.pow(2, attempt);
      await sleep(delay);
      attempt += 1;
    }
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`OpenAI timeout after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summaryShort: { type: "string" },
    whatItReallySays: { type: "string" },
    whyItMatters: { type: "string" },
    easyExplanation: { type: "string" },
    keyTakeaway: { type: "string" },
    cautionNote: { type: "string" },
    conclusionText: { type: "string" },
    tableData: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          value: { type: "string" },
        },
        required: ["label", "value"],
      },
    },
    diagramHint: {
      type: "string",
      enum: ["timeline", "cause-effect", "compare", "none"],
    },
  },
  required: [
    "summaryShort",
    "whatItReallySays",
    "whyItMatters",
    "easyExplanation",
    "keyTakeaway",
    "cautionNote",
    "conclusionText",
    "tableData",
    "diagramHint",
  ],
} as const;

const summaryFallback = (title: string, excerpt: string, content: string, sourceLabel: string): SummaryBlock => {
  const sourceText = sourceLabel.toLowerCase();
  const isOpinion = sourceText.includes("nghiên cứu") || sourceText.includes("nghien");
  const usableText = (excerpt || content || "").replace(/\s+/g, " ").trim();
  const short = usableText.slice(0, 280) || title;

  return {
    summaryShort: short,
    whatItReallySays: isOpinion
      ? "Đây là bài bình luận hoặc biên dịch. Trọng tâm không nằm ở việc kể lại sự kiện, mà ở cách tác giả diễn giải ý nghĩa chiến lược của sự kiện đó."
      : "Đây là bài tin hoặc phân tích theo hướng thực tế. Trọng tâm nên được đọc ở tác động lên thị trường, doanh nghiệp hoặc chính sách, không chỉ ở phần headline.",
    whyItMatters: isOpinion
      ? "Bài đáng đọc khi bạn muốn hiểu cách một luận điểm chiến lược đang được dựng lên và nó có thể ảnh hưởng tới cách nhìn về khu vực, quan hệ quốc tế hoặc rủi ro chính sách."
      : "Bài đáng đọc khi nó giúp bạn nối sự kiện với hệ quả thực: dòng tiền, tâm lý thị trường, chi phí, rủi ro hoặc quyết định kinh doanh.",
    easyExplanation: isOpinion
      ? "Nói ngắn gọn, tác giả đang cố nói rằng đằng sau sự kiện này có một thông điệp chiến lược lớn hơn điều được kể ở bề mặt."
      : "Nói ngắn gọn, bài này quan trọng vì nó không chỉ đưa tin mà còn gợi ra chuyện gì có thể thay đổi trong thực tế sau đó.",
    keyTakeaway: `Điểm nên giữ lại từ bài "${title}" là phải đọc lớp tác động thật phía sau nội dung bề mặt.`,
    cautionNote: isOpinion
      ? "Với bài bình luận hoặc biên dịch, cần tách dữ kiện được nêu ra khỏi phần suy luận của tác giả."
      : "Bản fallback này chỉ là lớp tóm tắt an toàn. Nó chưa thay thế được bản phân tích đầy đủ khi nhánh AI chính chạy thành công.",
    conclusionText: "Hệ thống đã giữ được nội dung cốt lõi của bài, nhưng đây vẫn là bản tóm tắt an toàn để tránh làm nghẽn cả pipeline.",
    tableData: [],
    diagramHint: "none",
  };
};

function normalizeSummary(parsed: any): SummaryBlock | null {
  if (!parsed || typeof parsed !== "object") return null;

  const requiredStrings = [
    "summaryShort",
    "whatItReallySays",
    "whyItMatters",
    "easyExplanation",
    "keyTakeaway",
    "cautionNote",
    "conclusionText",
  ];

  for (const key of requiredStrings) {
    if (typeof parsed[key] !== "string" || !parsed[key].trim()) return null;
  }

  return {
    summaryShort: parsed.summaryShort.trim(),
    whatItReallySays: parsed.whatItReallySays.trim(),
    whyItMatters: parsed.whyItMatters.trim(),
    easyExplanation: parsed.easyExplanation.trim(),
    keyTakeaway: parsed.keyTakeaway.trim(),
    cautionNote: parsed.cautionNote.trim(),
    conclusionText: parsed.conclusionText.trim(),
    tableData: Array.isArray(parsed.tableData) ? parsed.tableData : [],
    diagramHint:
      parsed.diagramHint === "timeline" ||
      parsed.diagramHint === "cause-effect" ||
      parsed.diagramHint === "compare"
        ? parsed.diagramHint
        : "none",
  };
}

function buildSummaryPrompt(params: {
  title: string;
  excerpt: string;
  content: string;
  sourceLabel: string;
  articleType: string;
}) {
  const { title, excerpt, content, sourceLabel, articleType } = params;
  const isOpinion = articleType === "opinion_translation";

  return `
Bạn là biên tập viên phân tích tin tức bằng tiếng Việt.
Mục tiêu là viết gọn, rõ, có nội dung thật, không sáo rỗng.

Quy tắc:
- Chỉ dùng thông tin trong bài.
- Không viết kiểu khen chê chung chung.
- summaryShort: 2-4 câu.
- whatItReallySays: nêu ý chính thật của bài.
- whyItMatters: nêu tác động thực.
- easyExplanation: giải thích dễ hiểu, ngắn.
- keyTakeaway: chốt 1 ý chính.
- cautionNote: nêu giới hạn khi đọc.
- conclusionText: kết luận ngắn, chắc.
- tableData chỉ dùng khi bài có số liệu thật rõ.

Nguồn: ${sourceLabel}
Loại bài: ${articleType}
${isOpinion ? "Đây là bài bình luận/biên dịch. Hãy tách lập luận khỏi fact." : "Đây là bài tin/phân tích. Hãy bám tác động thực tế."}

Tiêu đề: ${title}
Excerpt: ${excerpt}
Nội dung bài:
${content.slice(0, 9000)}
`;
}

export async function generateSummary(params: {
  title: string;
  excerpt: string;
  content: string;
  sourceLabel: string;
  articleType: string;
}): Promise<SummaryBlock> {
  const { title, excerpt, content, sourceLabel } = params;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return summaryFallback(title, excerpt, content, sourceLabel);
  }

  const client = new OpenAI({ apiKey });
  const prompt = buildSummaryPrompt(params);

  try {
    const response = await withTimeout(
      withRetry(() =>
        client.responses.create({
          model: process.env.OPENAI_SUMMARY_MODEL || "gpt-4o-mini",
          input: [
            {
              role: "system",
              content: "Bạn là biên tập viên phân tích tin tức bằng tiếng Việt. Trả về dữ liệu đúng schema.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          store: false,
          text: {
            format: {
              type: "json_schema",
              name: "news_summary",
              schema: SUMMARY_SCHEMA,
              strict: true,
            },
            verbosity: "low",
          },
        })
      ),
      18000
    );

    const raw = response.output_text || "{}";
    const parsed = normalizeSummary(JSON.parse(raw));
    if (!parsed) throw new Error("Summary schema normalized to null");
    return parsed;
  } catch (error) {
    console.error("generateSummary primary failed", {
      title,
      sourceLabel,
      error: normalizeError(error),
    });

    return summaryFallback(title, excerpt, content, sourceLabel);
  }
}

export async function answerAboutArticle(params: {
  title: string;
  content: string;
  question: string;
}): Promise<string> {
  const { title, content, question } = params;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return "Hiện chưa có OpenAI API key nên phần trả lời theo bài viết đang chạy ở chế độ giới hạn.";
  }

  const client = new OpenAI({ apiKey });

  const response = await withTimeout(
    client.responses.create({
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "Bạn là trợ lý đọc báo. Chỉ trả lời dựa trên nội dung bài đã cung cấp. Nếu bài không đủ thông tin, nói rõ là bài không cho biết.",
        },
        {
          role: "user",
          content: `Tiêu đề: ${title}\n\nNội dung:\n${content.slice(0, 12000)}\n\nCâu hỏi: ${question}`,
        },
      ],
      store: false,
      text: { verbosity: "medium" },
    }),
    20000
  );

  return response.output_text || "Tôi chưa rút ra được câu trả lời chắc chắn từ nội dung bài.";
}
