/**
 * lib/openai.ts
 *
 * Lịch sử: Ban đầu dùng OpenAI. Đã chuyển sang Google Gemini (free tier, 0đ/tháng)
 * vì user không muốn chịu chi phí thêm. File giữ nguyên tên `openai.ts` để
 * toàn bộ import ở nơi khác (parse-article.ts, chat/route.ts) không cần sửa.
 *
 * Model dùng:
 *  - Mặc định: gemini-2.5-flash (250 req/ngày free, chất lượng cao, tiếng Việt tốt)
 *  - Có thể đổi sang gemini-2.5-pro qua env var GEMINI_SUMMARY_MODEL (100 req/ngày free)
 *
 * Đặc điểm:
 *  - Structured output bằng responseSchema => không bao giờ fail do parse JSON
 *  - Timeout cứng 45s mỗi call => không hang collect route
 *  - Retry exponential backoff cho lỗi 429 / 503
 *  - Fallback chất lượng cao (extract key sentences từ content, không phải placeholder generic)
 */

import { GoogleGenAI, Type } from "@google/genai";
import { SummaryBlock } from "@/lib/types";

// ----- constants -----
const DEFAULT_SUMMARY_MODEL = "gemini-2.5-flash";
const DEFAULT_CHAT_MODEL = "gemini-2.5-flash";
const CALL_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 2;

// ----- helpers -----
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: number; code?: number | string; message?: string };
  const codeStr = String(e.code || "");
  const msg = e.message || "";
  return (
    e.status === 429 ||
    e.status === 503 ||
    codeStr === "429" ||
    codeStr === "503" ||
    /rate limit|quota|overload|unavailable/i.test(msg)
  );
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  try {
    return JSON.parse(JSON.stringify(error));
  } catch {
    return { message: String(error) };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout ${ms}ms: ${label}`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = MAX_RETRIES): Promise<T> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= maxRetries) throw error;
      const delay = 1500 * Math.pow(2, attempt);
      await sleep(delay);
      attempt += 1;
    }
  }
}

function firstSentences(text: string, limit = 3) {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const parts = normalized
    .split(/(?<=[.!?…])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.slice(0, limit).join(" ").slice(0, 480);
}

function trimField(v: unknown, fallback = "") {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : fallback;
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

function normalizeDiagramHint(v: unknown) {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (s === "timeline" || s === "compare") return s;
  if (s === "cause-effect" || s === "cause_effect") return "cause-effect";
  return "none";
}

function normalizeSummary(parsed: unknown): SummaryBlock | null {
  if (!parsed || typeof parsed !== "object") return null;
  const s = parsed as Record<string, unknown>;

  const summaryShort = trimField(s.summaryShort);
  const whatItReallySays = trimField(s.whatItReallySays);
  const whyItMatters = trimField(s.whyItMatters);
  const easyExplanation = trimField(s.easyExplanation);
  const keyTakeaway = trimField(s.keyTakeaway);
  const cautionNote = trimField(s.cautionNote);
  const conclusionText = trimField(s.conclusionText);

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
    tableData: coerceTableData(s.tableData),
    diagramHint: normalizeDiagramHint(s.diagramHint),
  };
}

// ----- fallback: tạo summary "đủ dùng" khi AI fail -----
function summaryFallback(
  title: string,
  excerpt: string,
  content: string,
  sourceLabel: string,
  articleType: string
): SummaryBlock {
  const base = excerpt || content;
  const short = firstSentences(base, 3) || content.slice(0, 320);
  const isOpinion = articleType === "opinion_translation";

  // Trích vài câu có nội dung thực cho các field, không dùng câu generic
  const sentences = content
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 40);

  const whatItReally = sentences[1] || sentences[0] || short;
  const whyMatters =
    sentences.find((s) => /tác động|ảnh hưởng|quan trọng|rủi ro|cơ hội|đẩy|kéo/i.test(s)) ||
    sentences[2] ||
    "";

  return {
    summaryShort: short,
    whatItReallySays: isOpinion
      ? `Đây là bài ${/biên dịch/i.test(sourceLabel) ? "biên dịch" : "bình luận/phân tích"} — cần đọc như một lập luận của tác giả, không phải bản tin trung lập. ${whatItReally}`.slice(0, 600)
      : (whatItReally ||
          "Bài đang mô tả một sự kiện/chính sách có thể tác động tới thị trường hoặc dòng tiền."
        ).slice(0, 600),
    whyItMatters:
      whyMatters ||
      (isOpinion
        ? "Giá trị nằm ở cách bài khung lại vấn đề chiến lược để người đọc có một cách nhìn theo dõi diễn biến."
        : "Giá trị nằm ở chỗ bài chỉ ra tác động thực tế lên thị trường, chính sách, doanh nghiệp hoặc dòng tiền."),
    easyExplanation: (sentences[3] || sentences[2] || short).slice(0, 500),
    keyTakeaway: `Điểm nên giữ lại từ "${title}": đọc kỹ phần tác động/lập luận chứ không chỉ headline.`,
    cautionNote: isOpinion
      ? "Với bài bình luận hoặc biên dịch, phải tách phần dữ kiện khỏi phần suy luận của tác giả."
      : "Bản tóm tắt này là tóm tắt dự phòng (tự động) vì tầng AI chính chưa chạy được — cần đọc bài gốc để xác nhận chi tiết.",
    conclusionText:
      "Tóm tắt dự phòng. Khi AI chạy lại bình thường, bản tóm tắt sâu sẽ thay thế phần này.",
    tableData: [],
    diagramHint: "none",
  };
}

// ----- prompt builder cho summary -----
function buildSummaryPrompt(params: {
  title: string;
  excerpt: string;
  content: string;
  sourceLabel: string;
  articleType: string;
}) {
  const { title, excerpt, content, sourceLabel, articleType } = params;
  const isOpinion = articleType === "opinion_translation";

  const typeBlock = isOpinion
    ? `ĐÂY LÀ BÀI BÌNH LUẬN / BIÊN DỊCH (không phải tin thuần).
- whatItReallySays phải tóm được lập luận trung tâm của tác giả, không phải "bài nói về X".
- cautionNote PHẢI nêu rõ giới hạn/định kiến có thể có của lập luận.
- whyItMatters nên nói về "cách khung vấn đề" chứ không phải "sự kiện đang diễn ra".`
    : `ĐÂY LÀ BÀI TIN / PHÂN TÍCH THỰC TẾ.
- whatItReallySays phải nhắm vào tác động thực (thị trường, chính sách, doanh nghiệp, dòng tiền), không chỉ kể lại sự kiện.
- whyItMatters phải nói ai/ngành nào bị ảnh hưởng và theo cơ chế gì, không nói chung chung.
- cautionNote chỉ nêu khi có điểm dễ hiểu nhầm hoặc dữ liệu chưa đủ.`;

  return [
    `Bạn là biên tập viên cấp cao của một bản tin kinh tế / địa chính trị tiếng Việt.`,
    `Người đọc là 1 cá nhân muốn NẮM NHANH giá trị cốt lõi của bài, không muốn đọc lại nguyên văn.`,
    ``,
    typeBlock,
    ``,
    `YÊU CẦU CHẤT LƯỢNG (quan trọng):`,
    `- Viết bằng tiếng Việt chuẩn, văn phong báo chí cao cấp kiểu The Economist / Guardian — có độ sâu, không sáo rỗng, không sao chép nguyên văn.`,
    `- TUYỆT ĐỐI KHÔNG dùng các cụm mờ nghĩa: "rất quan trọng", "đáng chú ý", "nhiều tác động", "cần theo dõi sát sao". Mỗi field phải có thông tin cụ thể.`,
    `- Nếu bài có số liệu / mốc thời gian / con người cụ thể → đưa vào summaryShort hoặc whatItReallySays.`,
    `- summaryShort: 2-4 câu, đi thẳng vào ý chính, độc giả đọc xong HIỂU bài nói gì mà không cần mở bài.`,
    `- whatItReallySays: trả lời "thông điệp ngầm / lớp thật của bài là gì?" — khác với summaryShort ở chỗ phân tích sâu hơn.`,
    `- whyItMatters: 2-3 câu, nói RÕ ai bị ảnh hưởng và qua cơ chế gì.`,
    `- easyExplanation: giải thích cho người không chuyên, dùng ví dụ/so sánh đời thường nếu có thể.`,
    `- keyTakeaway: 1 câu ngắn gọn, người đọc chỉ cần nhớ 1 thứ sau khi đọc bài thì là câu này.`,
    `- cautionNote: 1-2 câu cảnh báo về điểm dễ hiểu sai, thiên lệch nguồn, hoặc số liệu chưa đủ.`,
    `- conclusionText: 1-2 câu khép bài, không lặp lại summaryShort.`,
    `- tableData: chỉ đưa nếu bài có số liệu so sánh rõ ràng (ví dụ: trước/sau, nước A/B, năm X/Y). Nếu không có → [].`,
    `- diagramHint: chọn 1 trong: "none" | "timeline" (có mốc thời gian) | "compare" (so sánh 2 thứ) | "cause-effect" (nguyên nhân → hệ quả).`,
    ``,
    `THÔNG TIN BÀI:`,
    `- Nguồn: ${sourceLabel}`,
    `- Loại: ${articleType}`,
    `- Tiêu đề: ${title}`,
    excerpt ? `- Excerpt: ${excerpt}` : ``,
    `- Nội dung:`,
    content.slice(0, 12000),
  ]
    .filter(Boolean)
    .join("\n");
}

// ----- schema cho structured output -----
const summarySchema = {
  type: Type.OBJECT,
  properties: {
    summaryShort: { type: Type.STRING, description: "Tóm tắt 2-4 câu, đi thẳng vào ý chính" },
    whatItReallySays: { type: Type.STRING, description: "Thông điệp thật/lớp sâu hơn" },
    whyItMatters: { type: Type.STRING, description: "Ai bị ảnh hưởng và qua cơ chế gì" },
    easyExplanation: { type: Type.STRING, description: "Giải thích dễ hiểu cho người không chuyên" },
    keyTakeaway: { type: Type.STRING, description: "1 câu duy nhất cần nhớ sau khi đọc" },
    cautionNote: { type: Type.STRING, description: "Điểm dễ hiểu sai hoặc thiên lệch" },
    conclusionText: { type: Type.STRING, description: "1-2 câu khép bài" },
    tableData: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          value: { type: Type.STRING },
        },
      },
    },
    diagramHint: {
      type: Type.STRING,
      enum: ["none", "timeline", "compare", "cause-effect"],
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
    "diagramHint",
  ],
  propertyOrdering: [
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
};

// ----- summary API -----
async function callGeminiForSummary(ai: GoogleGenAI, model: string, prompt: string) {
  const response = await withRetry(() =>
    withTimeout(
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: summarySchema,
          temperature: 0.3,
          maxOutputTokens: 2000,
        },
      }),
      CALL_TIMEOUT_MS,
      `gemini generateContent (${model})`
    )
  );

  const text = response.text || "";
  if (!text) return null;
  try {
    return normalizeSummary(JSON.parse(text));
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return normalizeSummary(JSON.parse(text.slice(start, end + 1)));
    } catch {
      return null;
    }
  }
}

function summaryModelsToTry() {
  const primary = process.env.GEMINI_SUMMARY_MODEL || DEFAULT_SUMMARY_MODEL;
  const set: string[] = [primary];
  if (!set.includes("gemini-2.5-flash")) set.push("gemini-2.5-flash");
  if (!set.includes("gemini-2.5-flash-lite")) set.push("gemini-2.5-flash-lite");
  return set;
}

export async function generateSummary(params: {
  title: string;
  excerpt: string;
  content: string;
  sourceLabel: string;
  articleType: string;
}): Promise<SummaryBlock> {
  const { title, excerpt, content, sourceLabel, articleType } = params;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn("GEMINI_API_KEY missing — using fallback summary");
    return summaryFallback(title, excerpt, content, sourceLabel, articleType);
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildSummaryPrompt(params);
  const models = summaryModelsToTry();

  for (const model of models) {
    try {
      const result = await callGeminiForSummary(ai, model, prompt);
      if (result) return result;
      console.warn("generateSummary: returned invalid shape", { title, model });
    } catch (error) {
      console.error("generateSummary failed", {
        title,
        sourceLabel,
        model,
        error: normalizeError(error),
      });
    }
  }

  console.error("generateSummary: all models failed — fallback", {
    title,
    sourceLabel,
    models,
  });
  return summaryFallback(title, excerpt, content, sourceLabel, articleType);
}

// ----- chat về 1 bài -----
function chatModelsToTry() {
  const primary = process.env.GEMINI_CHAT_MODEL || DEFAULT_CHAT_MODEL;
  const set: string[] = [primary];
  if (!set.includes("gemini-2.5-flash")) set.push("gemini-2.5-flash");
  if (!set.includes("gemini-2.5-flash-lite")) set.push("gemini-2.5-flash-lite");
  return set;
}

export async function answerAboutArticle(params: {
  question: string;
  title: string;
  content: string;
  summary: SummaryBlock;
}): Promise<string> {
  const { question, title, content, summary } = params;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return `Chưa cấu hình GEMINI_API_KEY. Điều quan trọng nhất của bài "${title}" là: ${summary.keyTakeaway}`;
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = [
    `Bạn là trợ lý giải thích tin tức bằng tiếng Việt.`,
    `Chỉ trả lời dựa trên bài đang mở và phần tóm tắt có sẵn. Không bịa thêm số liệu hoặc nguồn ngoài.`,
    `Nếu câu hỏi nằm ngoài phạm vi bài, nói thẳng là "Bài này không đề cập trực tiếp" rồi mới đưa gợi ý.`,
    ``,
    `Tiêu đề: ${title}`,
    ``,
    `Tóm tắt đã có:`,
    `- Tóm tắt ngắn: ${summary.summaryShort}`,
    `- Bài thực chất nói gì: ${summary.whatItReallySays}`,
    `- Vì sao quan trọng: ${summary.whyItMatters}`,
    `- Giải thích dễ hiểu: ${summary.easyExplanation}`,
    `- Điểm cần nhớ: ${summary.keyTakeaway}`,
    `- Điểm cần dè chừng: ${summary.cautionNote}`,
    ``,
    `Nội dung bài:`,
    content.slice(0, 12000),
    ``,
    `Câu hỏi: ${question}`,
    ``,
    `Trả lời ngắn gọn, rõ ràng, bám đúng nội dung bài. Tối đa 6-8 câu.`,
  ].join("\n");

  const models = chatModelsToTry();

  for (const model of models) {
    try {
      const response = await withRetry(() =>
        withTimeout(
          ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              temperature: 0.4,
              maxOutputTokens: 1000,
            },
          }),
          CALL_TIMEOUT_MS,
          `gemini chat (${model})`
        )
      );
      const answer = (response.text || "").trim();
      if (answer) return answer;
    } catch (error) {
      console.error("answerAboutArticle failed", {
        title,
        model,
        error: normalizeError(error),
      });
    }
  }

  return `Tạm thời chưa trả lời được (AI đang gặp lỗi). Điều quan trọng nhất của bài "${title}": ${summary.keyTakeaway}`;
}
