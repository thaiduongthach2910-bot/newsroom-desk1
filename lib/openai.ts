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

function errorLabel(error: unknown) {
  if (!error || typeof error !== "object") return "unknown";
  const e = error as { status?: number; code?: string; message?: string };
  return `${e.status || ""} ${e.code || ""} ${e.message || ""}`.trim() || "unknown";
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= maxRetries) throw error;
      const delay = 1200 * Math.pow(2, attempt);
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

function firstMeaningfulParagraph(content: string) {
  return (
    content
      .split(/\n\n+/)
      .map((item) => item.replace(/\s+/g, " ").trim())
      .find((item) => item.length > 80) || content.slice(0, 260)
  );
}

function clip(text: string, max = 260) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trim()}…`;
}

function summaryFallback(title: string, excerpt: string, content: string, sourceLabel: string, articleType: string): SummaryBlock {
  const base = clip(excerpt || firstMeaningfulParagraph(content), 280);
  const opinionLike = articleType === "opinion_translation" || sourceLabel.toLowerCase().includes("nghiên cứu");

  if (opinionLike) {
    return {
      summaryShort: base,
      whatItReallySays:
        "Đây là bài thiên về bình luận hoặc diễn giải. Điều cần đọc không chỉ là sự kiện được nêu, mà là kết luận trung tâm mà tác giả đang cố dẫn người đọc tới.",
      whyItMatters:
        "Loại bài này hữu ích khi nó giúp nhìn rõ một cách diễn giải đang ảnh hưởng tới nhận thức về khu vực, chính sách hoặc rủi ro chiến lược. Giá trị nằm ở việc hiểu lập luận, không phải coi toàn bộ bài là fact thuần.",
      easyExplanation:
        "Nói đơn giản, bài đang muốn bạn nhìn vấn đề theo một khung lập luận cụ thể. Hãy giữ phần dữ kiện, nhưng cũng để ý chỗ tác giả đang suy diễn hoặc đẩy mạnh kết luận.",
      keyTakeaway: `Điểm nên giữ lại từ bài "${title}" là tách bạch giữa dữ kiện bài nêu ra và kết luận mà tác giả đang muốn người đọc chấp nhận.`,
      cautionNote:
        "Với bài bình luận/biên dịch, luôn kiểm tra xem kết luận có thật sự được chứng minh đủ trong chính bài hay không. Phần tóm tắt này là bản dự phòng, nên chưa bóc hết mọi giả định của tác giả.",
      conclusionText:
        "Bài đáng đọc để hiểu một lối diễn giải, nhưng không nên đọc như bản tin trung lập tuyệt đối.",
      tableData: [],
      diagramHint: "none",
    };
  }

  return {
    summaryShort: base,
    whatItReallySays:
      "Bài này có giá trị khi đọc ở lớp tác động thực: nó đang gợi ý điều gì sẽ thay đổi với doanh nghiệp, thị trường, chi phí, hợp đồng hoặc quyết định vận hành, chứ không chỉ dừng ở việc kể lại diễn biến.",
    whyItMatters:
      "Nếu đọc đúng, bài cho thấy rủi ro hoặc cơ hội nằm ở hệ quả phía sau headline. Phần quan trọng không phải tin tức bề mặt, mà là việc điều đó làm đổi kỳ vọng, dòng tiền hoặc cách ra quyết định như thế nào.",
    easyExplanation:
      "Hiểu ngắn gọn, đây không chỉ là một mẩu tin để biết cho có. Nó đáng đọc vì có thể ảnh hưởng tới cách doanh nghiệp hoặc nhà đầu tư nhìn thị trường và chuẩn bị bước tiếp theo.",
    keyTakeaway: `Điểm cần giữ lại từ bài "${title}" là phải đọc lớp tác động thực phía sau sự kiện, thay vì dừng ở bề mặt thông tin.`,
    cautionNote:
      "Đây là bản dự phòng khi lớp phân tích AI chưa trả đủ structured output. Hướng đọc vẫn đúng, nhưng mức chi tiết chưa phải bản cuối cùng.",
    conclusionText:
      "Bài có ích nhất khi được dùng để hiểu tác động thực tế, không phải chỉ để cập nhật headline.",
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

  const diagramHint = ["timeline", "cause-effect", "compare", "none"].includes(parsed.diagramHint)
    ? parsed.diagramHint
    : "none";

  return {
    summaryShort: parsed.summaryShort.trim(),
    whatItReallySays: parsed.whatItReallySays.trim(),
    whyItMatters: parsed.whyItMatters.trim(),
    easyExplanation: parsed.easyExplanation.trim(),
    keyTakeaway: parsed.keyTakeaway.trim(),
    cautionNote: parsed.cautionNote.trim(),
    conclusionText: parsed.conclusionText.trim(),
    tableData: Array.isArray(parsed.tableData) ? parsed.tableData : [],
    diagramHint,
  };
}

function extractJsonPayload(raw: string) {
  const cleaned = raw.trim();
  if (!cleaned) return null;

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

    try {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }
}

function readOutputText(response: any) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) return response.output_text.trim();
  if (response?.output_parsed) return JSON.stringify(response.output_parsed);

  const output = response?.output;
  if (!Array.isArray(output)) return "";

  const chunks: string[] = [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const block of content) {
      if (typeof block?.text === "string") chunks.push(block.text);
    }
  }

  return chunks.join("\n").trim();
}

function compactContent(content: string) {
  return content
    .split(/\n\n+/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 10)
    .join("\n\n")
    .slice(0, 9000);
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
Hãy viết để người đọc hiểu bản chất, không viết chung chung, không dùng văn placeholder.
Không bịa dữ kiện ngoài bài.
Nếu bài không đủ dữ liệu để kết luận mạnh, phải nói rõ giới hạn đó.

Yêu cầu theo từng field:
- summaryShort: 3-4 câu, nêu sự kiện chính và tác động chính.
- whatItReallySays: chỉ ra bài thực chất đang dẫn người đọc tới kết luận nào.
- whyItMatters: bám vào tác động doanh nghiệp / chính sách / thị trường / logistics / địa chính trị khi có.
- easyExplanation: giải thích rõ bằng tiếng Việt tự nhiên, không được mở đầu bằng "Nói dễ hiểu".
- keyTakeaway: 1 ý chốt đáng nhớ nhất.
- cautionNote: nêu điểm phải dè chừng khi đọc bài.
- conclusionText: kết ngắn nhưng có trọng lượng.
- tableData: chỉ điền khi bài có 2-5 số liệu hoặc mốc thời gian đáng nhặt ra.

Nguồn: ${sourceLabel}
Loại bài: ${articleType}

Quy tắc riêng:
${isOpinion
  ? "- Đây là bài bình luận/biên dịch. Hãy tách rõ phần fact và phần lập luận của tác giả.\n- whatItReallySays phải nêu được luận điểm trung tâm của tác giả.\n- cautionNote phải chỉ ra giới hạn hoặc thiên hướng lập luận nếu có."
  : "- Đây là bài tin/phân tích thực tế. Hãy bám vào tác động thật, tránh bình luận vĩ mô chung chung.\n- whatItReallySays phải chỉ ra bài đang cảnh báo hoặc nhấn mạnh điều gì về tác động thực."
}

Tiêu đề: ${title}
Excerpt: ${excerpt}
Nội dung bài:
${compactContent(content)}
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
  if (!apiKey) return summaryFallback(title, excerpt, content, sourceLabel, articleType);

  const client = new OpenAI({ apiKey });
  const prompt = buildSummaryPrompt(params);

  try {
    const response = await withRetry(() =>
      client.responses.create({
        model: process.env.OPENAI_SUMMARY_MODEL || "gpt-4o-mini",
        input: [
          {
            role: "system",
            content: "Bạn là biên tập viên phân tích tin tức bằng tiếng Việt. Trả về JSON đúng schema.",
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

    const rawText = readOutputText(response as any);
    const parsed = normalizeSummary(extractJsonPayload(rawText));
    if (parsed) return parsed;

    console.warn("generateSummary fallback", { title, sourceLabel, reason: "invalid_json_output" });
    return summaryFallback(title, excerpt, content, sourceLabel, articleType);
  } catch (error) {
    console.warn("generateSummary fallback", { title, sourceLabel, reason: errorLabel(error) });
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
Chỉ trả lời dựa trên bài đang mở và phần summary có sẵn. Không bịa dữ kiện ngoài bài.

Tiêu đề: ${title}
- Tóm tắt ngắn: ${summary.summaryShort}
- Bài thực chất muốn nói gì: ${summary.whatItReallySays}
- Vì sao quan trọng: ${summary.whyItMatters}
- Giải thích dễ hiểu: ${summary.easyExplanation}
- Điểm cần nhớ: ${summary.keyTakeaway}
- Điểm cần dè chừng: ${summary.cautionNote}

Nội dung nền:
${compactContent(content).slice(0, 7000)}

Câu hỏi:
${question}
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

    return readOutputText(response as any).trim() || `Dựa trên bài đang mở, ý chính cần giữ lại là: ${summary.keyTakeaway}`;
  } catch {
    return `Tôi chưa trả lời được bằng AI lúc này. Dựa trên bài đang mở, ý chính cần giữ lại là: ${summary.keyTakeaway}`;
  }
}
