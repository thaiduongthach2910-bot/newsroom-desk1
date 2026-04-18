import OpenAI from "openai";
import { SummaryBlock } from "@/lib/types";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const e = error as { status?: number; code?: string; message?: string };
  return e.status === 429 || e.code === "rate_limit_exceeded" || /rate limit/i.test(e.message || "");
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
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

function firstSentences(text: string, limit = 3) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const parts = normalized
    .split(/(?<=[.!?…])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.slice(0, limit).join(" ").slice(0, 420);
}

function trimField(value: unknown, fallback = "") {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : fallback;
}

function coerceTableData(value: unknown): Array<Record<string, string | number>> {
  if (!Array.isArray(value)) return [];

  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const entries = Object.entries(row as Record<string, unknown>)
        .filter(([, v]) => ["string", "number"].includes(typeof v))
        .slice(0, 4);
      if (entries.length === 0) return null;
      return Object.fromEntries(entries) as Record<string, string | number>;
    })
    .filter((row): row is Record<string, string | number> => !!row)
    .slice(0, 5);
}

function normalizeDiagramHint(value: unknown) {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (v === "timeline" || v === "compare") return v;
  if (v === "cause-effect" || v === "cause_effect") return "cause-effect";
  return "none";
}

function normalizeSummary(parsed: unknown): SummaryBlock | null {
  if (!parsed || typeof parsed !== "object") return null;

  const source = parsed as Record<string, unknown>;
  const summaryShort = trimField(source.summaryShort);
  const whatItReallySays = trimField(source.whatItReallySays);
  const whyItMatters = trimField(source.whyItMatters);
  const easyExplanation = trimField(source.easyExplanation);
  const keyTakeaway = trimField(source.keyTakeaway);
  const cautionNote = trimField(source.cautionNote);
  const conclusionText = trimField(source.conclusionText);

  if (
    !summaryShort ||
    !whatItReallySays ||
    !whyItMatters ||
    !easyExplanation ||
    !keyTakeaway ||
    !cautionNote ||
    !conclusionText
  ) {
    return null;
  }

  return {
    summaryShort,
    whatItReallySays,
    whyItMatters,
    easyExplanation,
    keyTakeaway,
    cautionNote,
    conclusionText,
    tableData: coerceTableData(source.tableData),
    diagramHint: normalizeDiagramHint(source.diagramHint),
  };
}

function tryParseJson(text: string): SummaryBlock | null {
  const raw = (text || "").trim();
  if (!raw) return null;

  try {
    return normalizeSummary(JSON.parse(raw));
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;

    try {
      return normalizeSummary(JSON.parse(raw.slice(start, end + 1)));
    } catch {
      return null;
    }
  }
}

const summaryFallback = (title: string, excerpt: string, content: string, sourceLabel: string): SummaryBlock => {
  const short = firstSentences(excerpt || content, 3) || content.slice(0, 320);
  const isOpinion = /nghiên cứu|nghien cuu/i.test(sourceLabel);

  return {
    summaryShort: short,
    whatItReallySays: isOpinion
      ? "Bài này nên được đọc như một lập luận hoặc góc nhìn của tác giả về cục diện, chứ không phải bản tin trung lập theo nghĩa hẹp."
      : "Bài này đang nhấn vào hệ quả thực tế của sự kiện, chứ không chỉ kể lại diễn biến bề mặt.",
    whyItMatters: isOpinion
      ? "Giá trị của bài nằm ở cách nó khung lại vấn đề chiến lược và gợi cho người đọc một cách nhìn để theo dõi diễn biến tiếp theo."
      : "Giá trị của bài nằm ở chỗ nó gợi ra tác động thực lên thị trường, doanh nghiệp, chính sách hoặc dòng tiền.",
    easyExplanation: isOpinion
      ? "Nói ngắn gọn, tác giả đang cố chứng minh vì sao nên nhìn sự kiện này theo một hướng nhất định."
      : "Nói ngắn gọn, bài đang chỉ ra chuyện này có thể tác động thế nào ngoài đời thật, không chỉ trên mặt báo.",
    keyTakeaway: `Điểm nên giữ lại từ bài "${title}" là phải nhìn lớp tác động hoặc lập luận phía sau headline.`,
    cautionNote: isOpinion
      ? "Với bài bình luận hoặc biên dịch, cần tách phần dữ kiện được nêu ra khỏi phần suy luận của tác giả."
      : "Bản dự phòng này chỉ nêu trục chính của bài, chưa thay thế được một bản tóm tắt AI đầy đủ.",
    conclusionText: "Đây là bản tóm tắt dự phòng để hệ thống không bỏ trống nội dung khi lớp phân tích chính gặp lỗi.",
    tableData: [],
    diagramHint: "none",
  };
};

function buildSummaryPrompt(params: {
  title: string;
  excerpt: string;
  content: string;
  sourceLabel: string;
  articleType: string;
}) {
  const { title, excerpt, content, sourceLabel, articleType } = params;
  const isOpinion = articleType === "opinion_translation";

  return [
    "Bạn là biên tập viên phân tích tin tức bằng tiếng Việt.",
    "Trả về duy nhất 1 object JSON hợp lệ, không markdown, không giải thích thêm.",
    "Các key bắt buộc: summaryShort, whatItReallySays, whyItMatters, easyExplanation, keyTakeaway, cautionNote, conclusionText, tableData, diagramHint.",
    "summaryShort phải dài 2-4 câu, đi thẳng vào ý chính.",
    isOpinion
      ? "Vì đây là bài bình luận/biên dịch, whatItReallySays và cautionNote phải chỉ ra rõ lập luận trung tâm và giới hạn lập luận của tác giả."
      : "Vì đây là bài tin/phân tích, whatItReallySays và whyItMatters phải bám vào tác động thực tế, tránh nói chung chung.",
    "diagramHint chỉ được là: none, timeline, compare, cause-effect.",
    "tableData là mảng; nếu bài không có số liệu rõ thì trả về [].",
    `Nguồn: ${sourceLabel}`,
    `Loại bài: ${articleType}`,
    `Tiêu đề: ${title}`,
    `Excerpt: ${excerpt}`,
    `Nội dung: ${content.slice(0, 10000)}`,
  ].join("\n\n");
}

async function callResponsesJson(client: OpenAI, model: string, prompt: string) {
  const response = await withRetry(() =>
    client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: "Bạn là biên tập viên phân tích tin tức bằng tiếng Việt. Luôn trả về một object JSON hợp lệ.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_output_tokens: 900,
      store: false,
    })
  );

  return tryParseJson(response.output_text || "");
}

async function callChatJson(client: OpenAI, model: string, prompt: string) {
  const response = await withRetry(() =>
    client.chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Bạn là biên tập viên phân tích tin tức bằng tiếng Việt. Luôn trả về đúng một object JSON hợp lệ.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 900,
    })
  );

  const content = response.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((p) => (typeof p === "string" ? p : "")).join("\n") : "";
  return tryParseJson(text);
}

function candidateModels(primary?: string) {
  const values = [
    primary,
    "gpt-4.1-mini",
    "gpt-4o-mini",
  ].filter((value, index, arr): value is string => !!value && arr.indexOf(value) === index);

  return values;
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
  const models = candidateModels(process.env.OPENAI_SUMMARY_MODEL);

  for (const model of models) {
    try {
      const viaResponses = await callResponsesJson(client, model, prompt);
      if (viaResponses) return viaResponses;
    } catch (error) {
      console.error("generateSummary responses failed", {
        title,
        sourceLabel,
        model,
        error: normalizeError(error),
      });
    }

    try {
      const viaChat = await callChatJson(client, model, prompt);
      if (viaChat) return viaChat;
    } catch (error) {
      console.error("generateSummary chat failed", {
        title,
        sourceLabel,
        model,
        error: normalizeError(error),
      });
    }
  }

  console.error("generateSummary primary failed", {
    title,
    sourceLabel,
    models,
    reason: "all model attempts failed or returned invalid JSON",
  });

  return summaryFallback(title, excerpt, content, sourceLabel);
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
Chỉ trả lời dựa trên bài đang mở và phần tóm tắt đã có sẵn. Không bịa thêm nguồn ngoài.

Tiêu đề: ${title}

Tóm tắt có sẵn:
- Tóm tắt ngắn: ${summary.summaryShort}
- Bài thực chất muốn nói gì: ${summary.whatItReallySays}
- Vì sao quan trọng: ${summary.whyItMatters}
- Giải thích dễ hiểu: ${summary.easyExplanation}
- Điểm cần nhớ: ${summary.keyTakeaway}
- Điểm cần dè chừng: ${summary.cautionNote}

Nội dung nền:
${content.slice(0, 10000)}

Câu hỏi của người dùng:
${question}
  `.trim();

  const models = candidateModels(process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_SUMMARY_MODEL);

  for (const model of models) {
    try {
      const response = await withRetry(() =>
        client.responses.create({
          model,
          input: [
            { role: "system", content: "Trả lời ngắn gọn, rõ ràng, bám đúng nội dung bài." },
            { role: "user", content: prompt },
          ],
          max_output_tokens: 600,
          store: false,
        })
      );

      const answer = (response.output_text || "").trim();
      if (answer) return answer;
    } catch (error) {
      console.error("answerAboutArticle failed", {
        title,
        model,
        error: normalizeError(error),
      });
    }
  }

  return `Dựa trên nội dung hiện có, điều quan trọng nhất của bài "${title}" là: ${summary.keyTakeaway}`;
}
