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

function collapseWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function pickSentences(text: string, maxSentences = 2, maxChars = 320) {
  const cleaned = collapseWhitespace(text);
  if (!cleaned) return "";

  const sentences = cleaned
    .split(/(?<=[.!?…])\s+|(?<=[。！？])\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  const selected: string[] = [];
  for (const sentence of sentences) {
    if (selected.join(" ").length + sentence.length > maxChars && selected.length > 0) break;
    selected.push(sentence);
    if (selected.length >= maxSentences) break;
  }

  return selected.join(" ") || cleaned.slice(0, maxChars);
}

function firstUsefulParagraph(content: string) {
  const parts = content
    .split(/\n\n+/)
    .map((part) => collapseWhitespace(part))
    .filter((part) => part.length >= 80);

  return parts[0] || collapseWhitespace(content).slice(0, 400);
}

function detectTheme(title: string, excerpt: string, content: string) {
  const text = `${title} ${excerpt} ${content}`.toLowerCase();

  if (/(myanmar|asean|trump|mỹ|trung quốc|iran|israel|ukraine|nga)/.test(text)) {
    return "địa chính trị và tác động chính sách";
  }
  if (/(thuế|lãi suất|fed|tỷ giá|ngân hàng|tài chính)/.test(text)) {
    return "tiền tệ, tài chính và chi phí vốn";
  }
  if (/(xuất khẩu|nhập khẩu|logistics|chuỗi cung ứng|vận tải)/.test(text)) {
    return "chuỗi cung ứng, thương mại và logistics";
  }
  if (/(ai|công nghệ|nền tảng|phần mềm|chip)/.test(text)) {
    return "công nghệ và tác động thương mại";
  }

  return "tác động thực tế phía sau sự kiện";
}

const summaryFallback = (title: string, excerpt: string, content: string, sourceLabel: string, articleType?: string): SummaryBlock => {
  const lead = pickSentences(excerpt || firstUsefulParagraph(content), 2, 340);
  const explainBase = pickSentences(firstUsefulParagraph(content), 2, 300);
  const isOpinion = articleType === "opinion_translation" || sourceLabel.toLowerCase().includes("nghiên cứu") || sourceLabel.toLowerCase().includes("nghien");
  const theme = detectTheme(title, excerpt, content);

  return {
    summaryShort: lead || `Bài "${title}" xoay quanh ${theme}, nhưng hệ thống hiện mới tạo được bản tóm tắt dự phòng thay vì bản phân tích đầy đủ bằng AI.`,
    whatItReallySays: isOpinion
      ? `Đây là bài bình luận/biên dịch. Luận điểm trung tâm mà tác giả muốn đẩy người đọc tới là cách nhìn về ${theme}, chứ không chỉ thuật lại sự kiện.`
      : `Bài này không dừng ở việc báo tin. Điều đáng giữ lại là hệ quả thực tế của câu chuyện đối với ${theme}.`,
    whyItMatters: `Điểm đáng chú ý không nằm ở headline mà ở chỗ bài buộc người đọc dịch câu chuyện sang ngôn ngữ tác động thực: ai bị ảnh hưởng, chi phí nào đổi, và quyết định nào có thể phải điều chỉnh.`,
    easyExplanation: explainBase || `Nói ngắn gọn, bạn nên hiểu bài này như một nỗ lực giải thích ${theme} bằng ví dụ cụ thể, chứ không phải một mẩu tin rời rạc.`,
    keyTakeaway: `Điểm nên giữ lại từ bài "${title}" là phải đọc lớp tác động thực tế phía sau câu chuyện về ${theme}.`,
    cautionNote: isOpinion
      ? "Với bài bình luận/biên dịch, cần tách phần fact được bài nêu ra khỏi phần suy luận của tác giả. Bản tóm tắt này vẫn là dự phòng nên chưa bóc tách đủ sâu."
      : "Đây vẫn là bản tóm tắt dự phòng. Nó đủ để nắm ý chính, nhưng chưa phải lớp phân tích sâu cuối cùng để dùng như kết luận chắc chắn.",
    conclusionText: `Hệ thống đã lấy được bài thật. Tuy nhiên phần tóm tắt này vẫn là fallback nên nên được coi là bản đọc nhanh, không phải bản phân tích hoàn chỉnh.`,
    tableData: [],
    diagramHint: "none",
  };
};

function extractJson(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return cleaned.slice(start, end + 1);
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
Bạn là biên tập viên phân tích tin tức bằng tiếng Việt, viết cho một người đọc muốn hiểu bản chất chứ không chỉ đọc headline.

Mục tiêu: tạo output đủ chiều sâu để hiển thị trên dashboard đọc tin cá nhân. Phải viết thật, có nội dung, không dùng câu vô thưởng vô phạt.

Quy tắc chung:
- Viết rõ, trực diện, không sáo rỗng.
- Không chép lại tiêu đề theo kiểu báo chí.
- Không bịa dữ kiện ngoài bài.
- Nếu bài không đủ dữ liệu để kết luận mạnh, phải nói rõ giới hạn đó.
- Từng trường phải có giá trị thực, không được viết kiểu placeholder.
- summaryShort: 2-4 câu, bám sát dữ kiện thật có trong bài, không mở đầu bằng "Nguồn:".
- whatItReallySays: bóc rõ bài thực chất đang muốn người đọc hiểu điều gì.
- whyItMatters: giải thích vì sao việc này đáng quan tâm với góc nhìn doanh nghiệp / chính sách / thị trường / logistics / dòng tiền nếu có.
- easyExplanation: giải thích như đang nói với người đọc thông minh nhưng không muốn đọc jargon.
- keyTakeaway: chốt điều quan trọng nhất cần giữ lại.
- cautionNote: nêu điểm cần dè chừng hoặc giới hạn khi đọc.
- conclusionText: đoạn kết ngắn nhưng có trọng lượng.
- Nếu trong bài có số liệu, mốc thời gian, tỷ lệ, quy mô, hãy cố gắng đưa 2-5 dòng vào tableData.

Nguồn: ${sourceLabel}
Loại bài: ${articleType}

Cách đọc riêng cho bài này:
${isOpinion
  ? "- Đây là bài bình luận/biên dịch, không phải bản tin trung lập.\n- whatItReallySays phải nêu được luận điểm trung tâm của tác giả.\n- cautionNote phải nói rõ chỗ nào là giả định hoặc thiên hướng lập luận.\n- easyExplanation nên diễn đạt kiểu: nói dễ hiểu thì tác giả đang bảo rằng..."
  : "- Đây là bài tin/phân tích thực tế.\n- whatItReallySays phải nêu rõ bài đang cảnh báo, nhấn mạnh hoặc định hướng người đọc theo kết luận nào.\n- whyItMatters nên bám vào tác động thực.\n- easyExplanation phải thực dụng, tránh vĩ mô chung chung."}

Tiêu đề: ${title}
Excerpt: ${excerpt}
Nội dung bài:
${content.slice(0, 15000)}
`;
}

export async function generateSummary(params: {
  title: string;
  excerpt: string;
  content: string;
  sourceLabel: string;
  articleType: string;
}): Promise<SummaryBlock> {
  const { title, excerpt, content, sourceLabel, articleType } = params;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return summaryFallback(title, excerpt, content, sourceLabel, articleType);
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
            content: "Bạn là biên tập viên phân tích tin tức bằng tiếng Việt. Trả về dữ liệu có cấu trúc đúng schema.",
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

    const raw = extractJson(response.output_text || "");
    const parsed = raw ? normalizeSummary(JSON.parse(raw)) : null;
    return parsed ?? summaryFallback(title, excerpt, content, sourceLabel, articleType);
  } catch {
    return summaryFallback(title, excerpt, content, sourceLabel, articleType);
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
