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

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function splitSentences(text: string) {
  return normalizeSpaces(text)
    .split(/(?<=[.!?…])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 30);
}

function excerptOrFirstSentences(excerpt: string, content: string, maxSentences = 2) {
  const excerptText = normalizeSpaces(excerpt);
  if (excerptText.length >= 80) return excerptText;

  const sentences = splitSentences(content).slice(0, maxSentences);
  if (sentences.length > 0) return sentences.join(" ");

  return normalizeSpaces(content).slice(0, 280);
}

function inferWhyItMatters(title: string, content: string, sourceLabel: string) {
  const text = `${title} ${content}`.toLowerCase();

  if (sourceLabel.toLowerCase().includes("nghiên cứu") || sourceLabel.toLowerCase().includes("nghien")) {
    return "Giá trị của bài nằm ở góc nhìn chiến lược: nó giúp người đọc hiểu cách một tác giả hoặc một nhóm chuyên gia diễn giải cục diện khu vực, từ đó ảnh hưởng tới cách nhìn về chính sách, liên minh và rủi ro địa chính trị.";
  }

  if (/(thuế|chính sách|nghị định|quy định|luật)/i.test(text)) {
    return "Bài này đáng chú ý vì nó có thể kéo theo thay đổi về chi phí tuân thủ, điều kiện kinh doanh hoặc cách doanh nghiệp phải điều chỉnh kế hoạch vận hành.";
  }
  if (/(lãi suất|tỷ giá|ngân hàng|trái phiếu|chứng khoán|vàng|dầu)/i.test(text)) {
    return "Điểm quan trọng là tác động tới dòng tiền, định giá tài sản và kỳ vọng thị trường, chứ không chỉ là một diễn biến ngắn hạn để đọc cho biết.";
  }
  if (/(xuất khẩu|nhập khẩu|logistics|chuỗi cung ứng|cảng|vận tải)/i.test(text)) {
    return "Bài này có ý nghĩa vì nó chạm vào chi phí thương mại, chuỗi cung ứng và khả năng giao hàng — những thứ ảnh hưởng trực tiếp tới biên lợi nhuận và kế hoạch kinh doanh.";
  }

  return "Bài này đáng quan tâm vì nó không dừng ở lớp thông tin bề mặt; thứ cần nhìn là hệ quả với thị trường, doanh nghiệp hoặc môi trường chính sách phía sau.";
}

function inferWhatItReallySays(title: string, content: string, sourceLabel: string) {
  const text = `${title} ${content}`.toLowerCase();
  const isOpinion = sourceLabel.toLowerCase().includes("nghiên cứu") || sourceLabel.toLowerCase().includes("nghien");

  if (isOpinion) {
    return "Bài này nên được đọc như một lập luận chiến lược: tác giả không chỉ kể lại sự kiện mà đang cố định hình cách người đọc hiểu cán cân lực lượng, động cơ của các bên và hướng đi có thể xảy ra tiếp theo.";
  }

  if (/(ra mắt|giới thiệu|công bố sản phẩm|công nghệ)/i.test(text)) {
    return "Điều bài muốn nhấn mạnh không chỉ là việc có một sản phẩm hay công nghệ mới, mà là tín hiệu về cạnh tranh, nhu cầu thị trường và cách doanh nghiệp định vị trong giai đoạn tới.";
  }
  if (/(thuế|quy định|chính sách|nghị định|luật)/i.test(text)) {
    return "Thực chất bài đang nói rằng thay đổi chính sách hoặc khung pháp lý mới có thể tạo ra bên thắng bên thua rõ hơn trong hoạt động kinh doanh và đầu tư.";
  }

  return "Bài không chỉ báo tin; điều nó thực sự nói tới là lớp tác động thực tế phía sau sự kiện, như chi phí, dòng tiền, tâm lý thị trường hoặc thay đổi trong quyết định điều hành.";
}

function buildFallbackSummary(title: string, excerpt: string, content: string, sourceLabel: string): SummaryBlock {
  const short = excerptOrFirstSentences(excerpt, content, 2);
  const isOpinion = sourceLabel.toLowerCase().includes("nghiên cứu") || sourceLabel.toLowerCase().includes("nghien");

  return {
    summaryShort: short || `Bài "${title}" đã được thu thập, nhưng hệ thống đang dùng lớp tóm tắt dự phòng.`,
    whatItReallySays: inferWhatItReallySays(title, content, sourceLabel),
    whyItMatters: inferWhyItMatters(title, content, sourceLabel),
    easyExplanation: isOpinion
      ? `Nói ngắn gọn, bài này đang đưa ra một cách đọc về vấn đề chứ không chỉ đưa fact. Vì vậy điều cần chú ý là luận điểm trung tâm của tác giả và giả định nào đang đứng sau luận điểm đó.`
      : `Nói ngắn gọn, bài này đáng đọc vì nó gợi ra tác động thực tế phía sau tiêu đề: ai chịu ảnh hưởng, chi phí có thể đổi ra sao, và thị trường hoặc doanh nghiệp phải phản ứng thế nào.`,
    keyTakeaway: `Điểm nên giữ lại từ bài "${title}" là phải đọc lớp tác động thực tế hoặc lập luận trung tâm phía sau tiêu đề, thay vì dừng ở phần headline.`,
    cautionNote: isOpinion
      ? "Với bài bình luận hoặc biên dịch, cần tách phần fact được nêu ra khỏi phần suy luận của tác giả. Bản tóm tắt dự phòng này chỉ giúp giữ đúng hướng đọc, chưa thay thế được phân tích sâu."
      : "Đây là bản tóm tắt dự phòng. Nó giữ được ý chính, nhưng chưa bóc tách hết các điểm cần dè chừng như độ bền của xu hướng, giới hạn dữ liệu hoặc hệ quả cấp hai.",
    conclusionText: isOpinion
      ? "Có thể đọc bài này để hiểu một cách nhìn chiến lược về vấn đề, nhưng không nên coi toàn bộ lập luận trong bài là fact đã được chứng minh hoàn toàn."
      : "Bài này có giá trị khi dùng để nắm ý chính và định vị tác động thực tế, sau đó mới quyết định có cần đọc sâu toàn văn hay theo dõi thêm diễn biến tiếp theo hay không.",
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
    summaryShort: normalizeSpaces(parsed.summaryShort),
    whatItReallySays: normalizeSpaces(parsed.whatItReallySays),
    whyItMatters: normalizeSpaces(parsed.whyItMatters),
    easyExplanation: normalizeSpaces(parsed.easyExplanation),
    keyTakeaway: normalizeSpaces(parsed.keyTakeaway),
    cautionNote: normalizeSpaces(parsed.cautionNote),
    conclusionText: normalizeSpaces(parsed.conclusionText),
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
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // continue
    }
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }

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
Bạn là biên tập viên phân tích tin tức bằng tiếng Việt.
Hãy trả về DUY NHẤT một object JSON hợp lệ, không thêm lời dẫn, không markdown, không code fence.

Yêu cầu nội dung:
- Viết rõ, có nội dung thật, không dùng các câu chung chung như “bài này không chỉ...” nếu không có dữ kiện đi kèm.
- Không bịa dữ kiện ngoài bài.
- summaryShort: 2-4 câu, nêu sự kiện chính và ý nghĩa gần nhất.
- whatItReallySays: bóc ra luận điểm hoặc tác động cốt lõi của bài.
- whyItMatters: giải thích vì sao đáng theo dõi với góc nhìn thị trường / doanh nghiệp / chính sách / địa chính trị.
- easyExplanation: diễn giải ngắn, dễ hiểu, nhưng không được vô thưởng vô phạt.
- keyTakeaway: 1 câu chốt mạnh.
- cautionNote: nêu giới hạn, giả định, hoặc điều phải dè chừng khi đọc.
- conclusionText: 1-2 câu kết chắc tay.
- tableData: chỉ dùng khi bài có số liệu hoặc mốc rõ.
- diagramHint chỉ được là: timeline, cause-effect, compare, none.

Nguồn: ${sourceLabel}
Loại bài: ${articleType}

Hướng đọc riêng:
${isOpinion
  ? "- Đây là bài bình luận hoặc biên dịch. Cần nêu rõ lập luận trung tâm của tác giả và đâu là phần người đọc nên dè chừng."
  : "- Đây là bài tin hoặc phân tích thực tế. Cần bám vào tác động vận hành, thị trường, chính sách hoặc cạnh tranh."}

Tiêu đề: ${title}
Excerpt: ${excerpt}
Nội dung bài:
${content.slice(0, 14000)}
`;
}

async function tryStructuredSummary(client: OpenAI, prompt: string) {
  const response = await withRetry(() =>
    client.responses.create({
      model: process.env.OPENAI_SUMMARY_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: "Bạn là biên tập viên phân tích tin tức bằng tiếng Việt. Trả về dữ liệu đúng schema JSON.",
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
      },
    })
  );

  return normalizeSummary(extractJsonObject(response.output_text));
}

async function tryPlainJsonSummary(client: OpenAI, prompt: string) {
  const response = await withRetry(() =>
    client.responses.create({
      model: process.env.OPENAI_SUMMARY_MODEL || "gpt-4.1-mini",
      input: `${prompt}\n\nHãy chỉ trả về JSON object đúng các field yêu cầu.`,
      store: false,
      text: { verbosity: "medium" },
    })
  );

  return normalizeSummary(extractJsonObject(response.output_text));
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
    return buildFallbackSummary(title, excerpt, content, sourceLabel);
  }

  const client = new OpenAI({ apiKey });
  const prompt = buildSummaryPrompt(params);

  try {
    const structured = await tryStructuredSummary(client, prompt);
    if (structured) return structured;
  } catch {
    // continue to plain-json fallback
  }

  try {
    const plainJson = await tryPlainJsonSummary(client, prompt);
    if (plainJson) return plainJson;
  } catch {
    // continue to local fallback
  }

  return buildFallbackSummary(title, excerpt, content, sourceLabel);
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
Chỉ trả lời dựa trên bài đang mở và phần tóm tắt có sẵn. Không bịa nguồn khác.

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

Hãy trả lời rõ ràng, ngắn gọn, có cấu trúc tự nhiên. Nếu bài hiện tại không đủ dữ liệu để khẳng định, phải nói rõ điều đó.
`;

  try {
    const response = await withRetry(() =>
      client.responses.create({
        model: process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini",
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
