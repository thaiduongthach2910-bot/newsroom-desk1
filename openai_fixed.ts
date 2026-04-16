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

const summaryFallback = (title: string, excerpt: string, content: string, sourceLabel: string): SummaryBlock => {
  const short = excerpt || content.slice(0, 320);
  const isOpinion = sourceLabel.toLowerCase().includes("nghiên cứu") || sourceLabel.toLowerCase().includes("nghien");

  return {
    summaryShort: short,
    whatItReallySays: isOpinion
      ? "Bài này thuộc nhóm bình luận/biên dịch nên cần đọc như một lập luận chiến lược: tác giả đang cố thuyết phục người đọc nhìn sự kiện theo một kết luận nhất định, chứ không chỉ tường thuật diễn biến."
      : "Bài này không chỉ báo tin mà đang cố hướng người đọc tới một kết luận thực dụng hơn: đằng sau sự kiện là hệ quả về hợp đồng, dòng tiền, chi phí và quyết định vận hành.",
    whyItMatters: "Giá trị của bài không nằm ở phần headline mà ở việc nó buộc người đọc đổi cách nhìn vấn đề: từ đọc tin đơn thuần sang đọc tác động thật lên doanh nghiệp, thị trường hoặc chính sách.",
    easyExplanation: "Nói dễ hiểu, đây là bản dự phòng khi lớp phân tích AI chưa đổ đủ nội dung. Nó cho bạn đại ý đúng hướng, nhưng chưa đạt độ sâu cuối cùng mà dashboard này nhắm tới.",
    keyTakeaway: `Điểm nên giữ lại từ bài "${title}" là phải đọc lớp tác động thực tế phía sau, không dừng ở phần tin bề mặt.`,
    cautionNote: isOpinion
      ? "Với bài bình luận/biên dịch, luôn tách giữa fact được bài nêu ra và phần suy luận của tác giả. Bản fallback này chưa làm việc đó đủ sâu."
      : "Bản fallback này chưa bóc tách hết lớp hệ quả pháp lý, vận hành hay dòng tiền. Vì vậy nó chỉ nên được xem là điểm khởi đầu để đọc tiếp, không phải bản phân tích cuối.",
    conclusionText: "Hệ thống đã lấy được bài thật, nhưng phần này vẫn là fallback. Cần để lớp structured output chạy ổn định để nội dung đạt đúng tiêu chuẩn bạn muốn.",
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
Bạn là biên tập viên phân tích tin tức bằng tiếng Việt, viết cho một người đọc muốn hiểu bản chất chứ không chỉ đọc headline.

Mục tiêu: tạo output đủ chiều sâu để hiển thị trên dashboard đọc tin cá nhân. Phải viết thật, có nội dung, không dùng câu vô thưởng vô phạt.

Quy tắc chung:
- Viết rõ, trực diện, không sáo rỗng.
- Không chép lại tiêu đề theo kiểu báo chí.
- Không bịa dữ kiện ngoài bài.
- Nếu bài không đủ dữ liệu để kết luận mạnh, phải nói rõ giới hạn đó.
- Từng trường phải có giá trị thực, không được viết kiểu placeholder.
- summaryShort: 3-5 câu, nêu được sự kiện chính và tác động chính.
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
  ? "- Đây là bài bình luận/biên dịch, không phải bản tin trung lập.\n- whatItReallySays phải nêu được lập luận trung tâm của tác giả.\n- cautionNote phải nói rõ chỗ nào là giả định, thiên hướng lập luận, hoặc điểm chưa được chứng minh đủ trong phạm vi bài.\n- easyExplanation nên giải thích kiểu: nói dễ hiểu thì tác giả đang bảo rằng..."
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

    const parsed = normalizeSummary(JSON.parse(response.output_text));
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
