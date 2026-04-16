import OpenAI from "openai";
import { SummaryBlock } from "@/lib/types";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: number; code?: string };
  return e.status === 429 || e.code === "rate_limit_exceeded";
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

function firstMeaningfulParagraphs(content: string, max = 2) {
  return content
    .split(/\n\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 80)
    .slice(0, max);
}

function shortExcerpt(title: string, excerpt: string, content: string) {
  if (excerpt?.trim()) return excerpt.trim();
  const para = firstMeaningfulParagraphs(content, 1)[0];
  return para || title;
}

function summaryFallback(title: string, excerpt: string, content: string, sourceLabel: string): SummaryBlock {
  const isOpinion = sourceLabel.toLowerCase().includes("nghiên cứu") || sourceLabel.toLowerCase().includes("nghien");
  const preview = shortExcerpt(title, excerpt, content);
  const paragraphs = firstMeaningfulParagraphs(content, 2);
  const second = paragraphs[1] || paragraphs[0] || preview;

  return {
    summaryShort: preview,
    whatItReallySays: isOpinion
      ? `Bài này nên được đọc như một lập luận. Tác giả không chỉ kể lại sự kiện mà đang cố dẫn người đọc tới một kết luận chiến lược cụ thể. Cốt lõi của bài nằm ở cách tác giả nối các dữ kiện để bảo vệ lập luận đó.`
      : `Bài này không chỉ báo tin mà đang muốn người đọc hiểu hệ quả thực tế phía sau sự kiện. Điểm quan trọng không nằm ở headline, mà ở tác động lên doanh nghiệp, thị trường, hợp đồng hoặc dòng tiền.` ,
    whyItMatters: second,
    easyExplanation: isOpinion
      ? "Nói dễ hiểu, đây là bài kiểu 'tác giả đang muốn bạn nhìn vấn đề theo cách nào'. Vì vậy cần tách phần fact mà bài nêu ra khỏi phần suy luận của tác giả."
      : "Nói dễ hiểu, đây là bài cần đọc theo hướng tác động thực tế: sau sự kiện sẽ ảnh hưởng gì đến quyết định kinh doanh, chi phí, thời gian giao hàng, hay kỳ vọng thị trường.",
    keyTakeaway: `Điểm nên giữ lại từ bài \"${title}\" là phải đọc phần tác động thật phía sau, không dừng ở lớp thông tin bề mặt.`,
    cautionNote: isOpinion
      ? "Với bài bình luận/biên dịch, luôn dè chừng chỗ nào là suy luận và chỗ nào là dữ kiện được chứng minh trực tiếp trong bài."
      : "Bản tóm tắt fallback này chỉ là lớp tạm. Nó chưa bóc hết chiều sâu pháp lý, vận hành hoặc dòng tiền nếu bài gốc có những lớp đó.",
    conclusionText: isOpinion
      ? "Hãy đọc bài này như một lập luận cần phản biện, không phải như một bản tin trung lập tuyệt đối."
      : "Hãy đọc bài này theo hướng quản trị tác động thực tế, không chỉ như một bản tin sự kiện.",
    tableData: [],
    diagramHint: "none",
  };
}

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

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
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
Bạn là biên tập viên phân tích tin tức bằng tiếng Việt. Hãy viết giàu nội dung, không rỗng, không nhắc đi nhắc lại headline.

Quy tắc chung:
- Không bịa dữ kiện ngoài bài.
- Viết như đang giải thích cho người đọc muốn hiểu bản chất.
- Tránh những câu vô thưởng vô phạt kiểu “bài này rất quan trọng”.
- Mỗi trường phải có nội dung riêng, không lặp nhau.
- Nếu bài có số liệu hoặc mốc thời gian, cố gắng đưa vào tableData.

Nguồn: ${sourceLabel}
Loại bài: ${articleType}

${isOpinion
  ? `Đây là bài bình luận/biên dịch. Hãy xử lý như sau:
- summaryShort: tóm lập luận trung tâm và bối cảnh.
- whatItReallySays: nói rõ tác giả đang muốn người đọc tin điều gì.
- whyItMatters: giải thích vì sao lập luận này đáng chú ý về chiến lược/chính sách/địa chính trị.
- easyExplanation: mở đầu tự nhiên kiểu “Nói dễ hiểu thì tác giả đang bảo rằng...”.
- cautionNote: phải chỉ ra giới hạn của bài, chỗ thiên về lập luận hoặc chỗ cần đọc dè chừng.`
  : `Đây là bài tin/phân tích thực tế. Hãy xử lý như sau:
- summaryShort: tóm sự kiện chính và tác động chính.
- whatItReallySays: bóc ra bài thực chất đang cảnh báo/nhấn mạnh điều gì.
- whyItMatters: bám vào tác động thực lên thị trường, doanh nghiệp, logistics, hợp đồng hoặc dòng tiền nếu có.
- easyExplanation: giải thích thực dụng, tránh ngôn ngữ mơ hồ.
- cautionNote: nêu điểm dễ hiểu sai hoặc giới hạn của bài.`}

Tiêu đề: ${title}
Excerpt: ${excerpt}
Nội dung bài:
${content.slice(0, 14000)}
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
    const response = await withRetry(() =>
      client.responses.create({
        model: process.env.OPENAI_SUMMARY_MODEL || "gpt-4o-mini",
        input: [
          {
            role: "system",
            content:
              "Bạn là biên tập viên phân tích tin tức bằng tiếng Việt. Trả về dữ liệu có cấu trúc đúng schema và nội dung phải cụ thể, có chiều sâu.",
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
          verbosity: "medium",
        },
      })
    );

    const parsed = extractJsonObject(response.output_text);
    const normalized = normalizeSummary(parsed);
    return normalized ?? summaryFallback(title, excerpt, content, sourceLabel);
  } catch {
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

  const client = new OpenAI({ apiKey });

  const prompt = `
Bạn là trợ lý giải thích tin tức bằng tiếng Việt.
Nhiệm vụ: chỉ trả lời dựa trên bài đang mở và phần tóm tắt đã có sẵn. Không bịa nguồn khác. Không đi lan man.

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

    return response.output_text.trim();
  } catch {
    return `Tôi chưa trả lời được bằng AI lúc này. Dựa trên bài đang mở, ý chính cần giữ lại là: ${summary.keyTakeaway}`;
  }
}
