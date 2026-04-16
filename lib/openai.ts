import OpenAI from "openai";
import { SummaryBlock } from "@/lib/types";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    diagramHint: { type: "string" },
  },
  required: [
    "summaryShort",
    "whatItReallySays",
    "whyItMatters",
    "easyExplanation",
    "keyTakeaway",
    "cautionNote",
    "conclusionText",
    "diagramHint",
  ],
} as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: number; code?: string; message?: string };
  return e.status === 429 || e.code === "rate_limit_exceeded" || e.message?.includes("429") === true;
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= maxRetries) {
        throw error;
      }

      const delay = 1500 * Math.pow(2, attempt);
      await sleep(delay);
      attempt += 1;
    }
  }
}

function pickSentences(content: string, limit = 6) {
  return content
    .split(/(?<=[\.\!\?])\s+|\n+/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length > 35)
    .slice(0, limit);
}

function summaryFallback(title: string, excerpt: string, content: string, sourceLabel: string): SummaryBlock {
  const isOpinion = sourceLabel.toLowerCase().includes("nghiên") || sourceLabel.toLowerCase().includes("nghien");
  const sentences = pickSentences(content, 8);
  const short = excerpt || sentences[0] || content.slice(0, 220);
  const second = sentences[1] || sentences[0] || short;
  const third = sentences[2] || second;

  return {
    summaryShort: short,
    whatItReallySays: isOpinion
      ? `Trục lập luận chính của bài là: ${second}`
      : `Bản chất của tin này là: ${second}`,
    whyItMatters: isOpinion
      ? `Điểm đáng chú ý của bài "${title}" nằm ở chỗ nó gợi ra một cách nhìn hoặc lập luận có thể ảnh hưởng tới cách người đọc đánh giá vấn đề.`
      : `Điều đáng quan tâm ở bài "${title}" là tác động thực tế mà nó gợi ra đối với quyết định, kỳ vọng hoặc rủi ro của người đọc.`,
    easyExplanation: third,
    keyTakeaway: second.length > 180 ? second.slice(0, 180).trim() : second,
    cautionNote: isOpinion
      ? "Đây là bài có màu sắc bình luận/biên dịch. Cần tách phần lập luận của tác giả khỏi các dữ kiện mô tả trong bài."
      : "Cần đọc kỹ phần số liệu, thời điểm và bối cảnh để tránh hiểu headline theo nghĩa quá rộng hoặc quá sớm.",
    conclusionText: isOpinion
      ? "Đọc bài này nên tập trung vào logic lập luận và giả định nền của tác giả, không nên coi toàn bộ như fact đã chốt."
      : "Đọc bài này nên tập trung vào tác động thực tế và điều kiện áp dụng, không chỉ nhìn headline.",
    tableData: [],
    diagramHint: "none",
  };
}

function parseJsonSafely(text: string): SummaryBlock | null {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");

  try {
    const parsed = JSON.parse(cleaned);
    if (
      parsed &&
      typeof parsed.summaryShort === "string" &&
      typeof parsed.whatItReallySays === "string" &&
      typeof parsed.whyItMatters === "string" &&
      typeof parsed.easyExplanation === "string" &&
      typeof parsed.keyTakeaway === "string" &&
      typeof parsed.cautionNote === "string" &&
      typeof parsed.conclusionText === "string"
    ) {
      return {
        ...parsed,
        tableData: Array.isArray(parsed.tableData) ? parsed.tableData : [],
        diagramHint: typeof parsed.diagramHint === "string" ? parsed.diagramHint : "none",
      } as SummaryBlock;
    }
  } catch {
    // ignore
  }

  return null;
}

function extractResponseText(response: any) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  const item = response?.output?.find((entry: any) => entry.type === "message");
  const text = item?.content?.find((entry: any) => entry.type === "output_text")?.text;
  return typeof text === "string" ? text : "";
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
Bạn là biên tập viên phân tích tin tức bằng tiếng Việt cho một dashboard đọc tin cá nhân.

Mục tiêu: viết ra bản tóm tắt có chiều sâu, tránh mọi kiểu câu chung chung như "bài này có giá trị" hoặc "nếu đọc đúng trọng tâm".

Quy tắc bắt buộc:
- Chỉ dùng dữ liệu có trong bài.
- Không bịa thêm dữ kiện, tên người, số liệu hay bối cảnh ngoài bài.
- Không lặp lại headline bằng từ khác.
- Viết ngắn nhưng sắc, cụ thể, có substance.
- Nếu bài không đủ dữ liệu để khẳng định mạnh, phải nói mức độ dè chừng.
- tableData chỉ dùng khi bài có số liệu, tỷ lệ, mốc thời gian hay so sánh rõ.
- diagramHint chỉ được là one of ["none","timeline","compare","cause-effect"].

Nguồn: ${sourceLabel}
Loại bài: ${articleType}

Yêu cầu riêng theo nguồn:
${isOpinion
  ? `- Đây là bài bình luận/biên dịch. whatItReallySays phải nêu luận điểm trung tâm của tác giả.
- whyItMatters phải giải thích vì sao lập luận đó đáng chú ý.
- cautionNote phải nhắc rõ phần nào cần đọc dè chừng vì mang tính góc nhìn, giả định hoặc suy diễn.`
  : `- Đây là bài tin/phân tích kinh tế. whatItReallySays phải bóc đúng tác động thực tế phía sau sự kiện.
- whyItMatters phải nói rõ ảnh hưởng tới doanh nghiệp, thị trường, dòng tiền, rủi ro hoặc chính sách.
- cautionNote phải nhắc chỗ dễ hiểu sai nếu chỉ đọc headline.`}

Tiêu đề: ${title}
Mô tả ngắn: ${excerpt}

Nội dung bài:
${content.slice(0, 12000)}
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

  if (!process.env.OPENAI_API_KEY) {
    return summaryFallback(title, excerpt, content, sourceLabel);
  }

  try {
    const response = await withRetry(() =>
      client.responses.create({
        model: process.env.OPENAI_SUMMARY_MODEL || "gpt-4o-mini",
        input: [
          {
            role: "system",
            content: "Bạn là biên tập viên phân tích tin tức bằng tiếng Việt. Trả về dữ liệu có cấu trúc đúng schema và tránh văn phong chung chung.",
          },
          {
            role: "user",
            content: buildSummaryPrompt(params),
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
          verbosity: "medium",
        },
      })
    );

    const parsed = parseJsonSafely(extractResponseText(response));
    return parsed ?? summaryFallback(title, excerpt, content, sourceLabel);
  } catch (error) {
    console.warn("generateSummary fallback", {
      title,
      sourceLabel,
      message: error instanceof Error ? error.message : String(error),
    });
    return summaryFallback(title, excerpt, content, sourceLabel);
  }
}

export async function answerAboutArticle(params: {
  question: string;
  title: string;
  content: string;
  summary: SummaryBlock;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const { question, title, content, summary } = params;

  if (!apiKey) {
    return `Chưa cấu hình OpenAI API key. Dựa trên dữ liệu hiện có, bài "${title}" chủ yếu nhấn vào: ${summary.keyTakeaway}`;
  }

  const prompt = `
Bạn là trợ lý giải thích tin tức bằng tiếng Việt.
Chỉ trả lời dựa trên bài đang mở và phần tóm tắt đã có. Không bịa thêm dữ kiện ngoài bài.

Tiêu đề: ${title}

Tóm tắt có sẵn:
- Tóm tắt ngắn: ${summary.summaryShort}
- Bài thực chất muốn nói gì: ${summary.whatItReallySays}
- Vì sao quan trọng: ${summary.whyItMatters}
- Giải thích dễ hiểu: ${summary.easyExplanation}
- Điểm cần nhớ: ${summary.keyTakeaway}
- Điểm cần dè chừng: ${summary.cautionNote}

Nội dung nền:
${content.slice(0, 12000)}

Câu hỏi của người dùng:
${question}

Hãy trả lời:
- Rõ ràng
- Dễ hiểu
- Có good will
- Nếu câu hỏi vượt ngoài dữ liệu của bài, nói rõ là bài hiện tại không đủ để khẳng định.
`;

  try {
    const response = await withRetry(() =>
      client.responses.create({
        model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
        input: prompt,
        store: false,
        text: { verbosity: "medium" },
      })
    );

    return extractResponseText(response).trim();
  } catch {
    return `Tôi chưa trả lời được bằng AI lúc này. Dựa trên bài đang mở, ý chính cần giữ lại là: ${summary.keyTakeaway}`;
  }
}
