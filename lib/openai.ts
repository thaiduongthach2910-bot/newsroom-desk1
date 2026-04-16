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

function summaryFallback(title: string, excerpt: string, content: string, sourceLabel: string): SummaryBlock {
  const short = excerpt || content.split(/
+/).find((x) => x.trim().length > 80)?.trim() || content.slice(0, 220);
  const isOpinion = sourceLabel.toLowerCase().includes("nghiên") || sourceLabel.toLowerCase().includes("nghien");

  return {
    summaryShort: short,
    whatItReallySays: isOpinion
      ? `Bài này chủ yếu đang đẩy người đọc đến một lập luận hoặc cách nhìn chiến lược nhất định, chứ không chỉ tường thuật sự kiện.`
      : `Bài này muốn bạn nhìn vào tác động thực tế phía sau headline, không chỉ bám vào thông tin bề mặt.`,
    whyItMatters: `Điểm quan trọng của bài "${title}" nằm ở tác động tới cách hiểu vấn đề hoặc ra quyết định, chứ không chỉ ở sự kiện đơn lẻ.`,
    easyExplanation: isOpinion
      ? "Nói dễ hiểu, đây là bài bình luận/biên dịch nên cần đọc theo hướng lập luận của tác giả, không nên hiểu như bản tin trung lập hoàn toàn."
      : "Nói dễ hiểu, bài này đang chỉ ra tác động thật phía sau tin tức, thường liên quan đến chi phí, rủi ro, dòng tiền hoặc kỳ vọng thị trường.",
    keyTakeaway: `Điểm cần giữ lại là: đọc bài này theo bản chất tác động, không chỉ theo tiêu đề.`,
    cautionNote: isOpinion
      ? "Đây là bản tóm tắt dự phòng. Với bài bình luận/biên dịch, cần tiếp tục đọc kỹ để tách lập luận của tác giả khỏi dữ kiện mô tả trong bài."
      : "Đây là bản tóm tắt dự phòng. Bạn nên đọc lại bài gốc nếu cần chi tiết số liệu, điều khoản hoặc bối cảnh chính sách đầy đủ.",
    conclusionText: "Bản dự phòng này đủ để nắm trục ý chính, nhưng chưa đạt độ sâu phân tích cuối cùng.",
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
      return parsed as SummaryBlock;
    }
  } catch {}

  return null;
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

Yêu cầu chung:
- Viết thẳng, rõ, không chung chung.
- Không được trả kiểu lấp chỗ trống như "bài này có giá trị" hay "nếu đọc đúng trọng tâm".
- Không lặp lại headline bằng từ khác.
- Chỉ dùng dữ liệu có trong bài. Không bịa thêm.
- Nếu bài không đủ dữ liệu để khẳng định, nói rõ mức độ chưa chắc.
- summaryShort: 2-3 câu ngắn.
- whatItReallySays: phải bóc đúng luận điểm trung tâm hoặc bản chất tác động.
- whyItMatters: giải thích tại sao người đọc này nên quan tâm.
- easyExplanation: giải thích dễ hiểu nhưng vẫn đúng.
- keyTakeaway: 1 ý ngắn, sắc.
- cautionNote: chỉ ra điểm cần dè chừng.
- conclusionText: chốt lại ngắn, rõ.
- tableData: chỉ trả khi bài có số liệu, tỷ lệ, mốc thời gian hoặc so sánh rõ; nếu không có thì để mảng rỗng.
- diagramHint: chỉ được là one of ["none","timeline","compare","cause-effect"].

Nguồn: ${sourceLabel}
Loại bài: ${articleType}

Hướng đọc riêng:
${isOpinion
  ? "- Đây là bài bình luận/biên dịch. whatItReallySays phải nêu được lập luận trung tâm của tác giả. cautionNote phải nói rõ đâu là phần cần đọc dè chừng vì mang tính lập luận, giả định hoặc góc nhìn."
  : "- Đây là bài tin/phân tích. whatItReallySays phải nói rõ tác động thực tế phía sau sự kiện. cautionNote ưu tiên nhắc rủi ro hiểu sai, thiếu số liệu hoặc headline gây lệch trọng tâm."}

Tiêu đề: ${title}
Tóm tắt mô tả ngắn hiện có: ${excerpt}

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
            content: "Bạn là biên tập viên phân tích tin tức bằng tiếng Việt. Trả về dữ liệu có cấu trúc đúng schema.",
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

    const parsed = parseJsonSafely(response.output_text);
    return parsed ?? summaryFallback(title, excerpt, content, sourceLabel);
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

    return response.output_text.trim();
  } catch {
    return `Tôi chưa trả lời được bằng AI lúc này. Dựa trên bài đang mở, ý chính cần giữ lại là: ${summary.keyTakeaway}`;
  }
}
