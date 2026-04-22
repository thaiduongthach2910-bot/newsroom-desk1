/**
 * lib/openai.ts (v3)
 *
 * Cải tiến v3:
 *  - Summary dùng gemini-2.5-pro (chất lượng cao hơn flash, quota 100/ngày đủ dùng)
 *  - Chat + ask-on-selection dùng gemini-2.5-flash (quota 250/ngày)
 *  - Thêm 3 field summary: context, keyNumbers, whatToWatch
 *  - Prompt tiếng Việt tinh chỉnh sâu hơn nữa - có ví dụ "tốt/tệ" để model học
 *  - Hàm askAboutSelection() cho feature Ask on Selection
 */

import { GoogleGenAI, Type } from "@google/genai";
import { SummaryBlock } from "@/lib/types";

// ----- constants -----
const DEFAULT_SUMMARY_MODEL = "gemini-2.5-pro";
const DEFAULT_CHAT_MODEL = "gemini-2.5-flash";
const CALL_TIMEOUT_MS = 50_000;
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
  if (error instanceof Error) return { name: error.name, message: error.message };
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
      const delay = 2000 * Math.pow(2, attempt);
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

function trimField(v: unknown) {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}

function coerceKeyNumbers(value: unknown): SummaryBlock["keyNumbers"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const label = trimField(r.label);
      const val = trimField(r.value);
      const meaning = trimField(r.meaning);
      if (!label || !val) return null;
      return { label, value: val, meaning };
    })
    .filter((x): x is { label: string; value: string; meaning: string } => !!x)
    .slice(0, 6);
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

  const required = {
    summaryShort: trimField(s.summaryShort),
    whatItReallySays: trimField(s.whatItReallySays),
    whyItMatters: trimField(s.whyItMatters),
    easyExplanation: trimField(s.easyExplanation),
    keyTakeaway: trimField(s.keyTakeaway),
    cautionNote: trimField(s.cautionNote),
    conclusionText: trimField(s.conclusionText),
  };

  if (Object.values(required).some((v) => !v)) return null;

  return {
    ...required,
    context: trimField(s.context) || undefined,
    keyNumbers: coerceKeyNumbers(s.keyNumbers),
    whatToWatch: trimField(s.whatToWatch) || undefined,
    tableData: coerceTableData(s.tableData),
    diagramHint: normalizeDiagramHint(s.diagramHint),
  };
}

// ----- fallback -----
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

  const sentences = content
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 40);

  const whatItReally = sentences[1] || sentences[0] || short;
  const whyMatters =
    sentences.find((s) =>
      /tác động|ảnh hưởng|quan trọng|rủi ro|cơ hội|đẩy|kéo/i.test(s)
    ) ||
    sentences[2] ||
    "";

  return {
    summaryShort: short,
    whatItReallySays: isOpinion
      ? `Đây là bài ${/biên dịch/i.test(sourceLabel) ? "biên dịch" : "bình luận/phân tích"} — cần đọc như một lập luận của tác giả, không phải bản tin trung lập. ${whatItReally}`.slice(0, 600)
      : (
          whatItReally ||
          "Bài đang mô tả một sự kiện/chính sách có thể tác động tới thị trường hoặc dòng tiền."
        ).slice(0, 600),
    whyItMatters:
      whyMatters ||
      (isOpinion
        ? "Giá trị nằm ở cách bài khung lại vấn đề chiến lược."
        : "Giá trị nằm ở chỗ bài chỉ ra tác động thực tế lên thị trường, chính sách, doanh nghiệp hoặc dòng tiền."),
    easyExplanation: (sentences[3] || sentences[2] || short).slice(0, 500),
    keyTakeaway: `Điểm nên giữ lại từ "${title}": đọc kỹ phần tác động chứ không chỉ headline.`,
    cautionNote: isOpinion
      ? "Với bài bình luận hoặc biên dịch, tách rõ dữ kiện khỏi suy luận của tác giả."
      : "Bản tóm tắt này là tóm tắt dự phòng (tự động) — cần đọc bài gốc để xác nhận chi tiết.",
    conclusionText: "Tóm tắt dự phòng. Khi AI chạy lại bình thường, bản sâu sẽ thay thế phần này.",
    tableData: [],
    diagramHint: "none",
  };
}

// ----- prompt builder -----
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
- whatItReallySays phải tóm được LẬP LUẬN TRUNG TÂM của tác giả, không phải "bài nói về X".
- cautionNote PHẢI nêu rõ giới hạn / định kiến có thể có của lập luận.
- whyItMatters nói về "cách khung vấn đề" và hàm ý chiến lược, không phải "sự kiện đang diễn ra".
- context nên nêu tác giả/bối cảnh gốc bài (nếu là biên dịch — tên tác giả gốc, xuất xứ, xu hướng trường phái).`
    : `ĐÂY LÀ BÀI TIN / PHÂN TÍCH THỰC TẾ.
- whatItReallySays nhắm vào tác động THỰC (thị trường, chính sách, doanh nghiệp, dòng tiền), không kể lại sự kiện.
- whyItMatters nói RÕ ai/ngành nào bị ảnh hưởng và theo CƠ CHẾ gì.
- context nên nêu tình trạng trước đó / chính sách / thống kê liên quan để người đọc hiểu tầm bài.`;

  return [
    `Bạn là biên tập viên cấp cao của một bản tin kinh tế / địa chính trị tiếng Việt.`,
    `Người đọc là 1 cá nhân muốn HIỂU SÂU bài chứ không chỉ đọc lại headline. Họ có thời gian đọc kỹ nếu bài xứng đáng.`,
    ``,
    typeBlock,
    ``,
    `YÊU CẦU CHẤT LƯỢNG (cực kỳ quan trọng):`,
    `- Viết tiếng Việt chuẩn, văn phong báo chí cao cấp kiểu The Economist / FT / Financial Review — sâu, cô đọng, không sáo rỗng.`,
    `- TUYỆT ĐỐI KHÔNG dùng cụm mờ nghĩa: "rất quan trọng", "đáng chú ý", "nhiều tác động", "cần theo dõi sát sao", "mang lại nhiều cơ hội". Thay bằng thông tin cụ thể.`,
    `- Có số/tên/mốc cụ thể → ĐƯA VÀO summaryShort hoặc whatItReallySays.`,
    `- Không sao chép nguyên câu từ bài gốc — diễn đạt lại bằng văn của bạn.`,
    ``,
    `TỪNG FIELD:`,
    `- summaryShort: 3-5 câu, bản tóm tắt "đủ ý". Độc giả đọc xong PHẢI hiểu bài nói gì, ai liên quan, con số trọng tâm, và kết luận bài đi tới đâu. KHÔNG chỉ 1-2 câu hời hợt.`,
    `- whatItReallySays: 3-5 câu, phân tích lớp sâu — thông điệp ngầm, ý đồ của bên viết, các giả định không nói ra. KHÁC BIỆT với summaryShort.`,
    `- whyItMatters: 3-4 câu nói RÕ ai/ngành/dòng tiền bị ảnh hưởng, qua cơ chế nào, trong khung thời gian nào.`,
    `- easyExplanation: 3-5 câu giải thích cho người không chuyên. Dùng ví dụ / so sánh đời thường. Giải nghĩa thuật ngữ chuyên ngành.`,
    `- keyTakeaway: 1 câu sắc bén — nếu độc giả chỉ nhớ 1 câu thì là câu này.`,
    `- cautionNote: 2-3 câu cảnh báo điểm dễ hiểu sai, thiên lệch nguồn, dữ liệu chưa đủ, hay hàm ý ngầm cần dè chừng.`,
    `- conclusionText: 2-3 câu khép bài, KHÔNG lặp summaryShort — nên nói về "vậy còn gì chưa rõ" hoặc "cách bài này gợi mở ra câu chuyện lớn hơn".`,
    `- context: 2-4 câu BỐI CẢNH trước bài — người đọc cần biết gì để hiểu. Ví dụ: "Trước khi có NQ 68, chính sách X đã..." hoặc "Tác giả Y là giáo sư trường Z chuyên nghiên cứu...". Bỏ qua nếu bài tự đã đủ bối cảnh.`,
    `- keyNumbers: mảng các con số quan trọng. Mỗi phần tử có 3 trường: label (tên chỉ số), value (giá trị + đơn vị), meaning (2-3 câu giải thích con số này nghĩa là gì). TỐI ĐA 5 số. Nếu bài không có số đáng kể → mảng rỗng.`,
    `- whatToWatch: 2-3 câu — sau bài này, nên theo dõi điều gì/dấu hiệu gì trong vài tuần tới? Giúp độc giả biến bài thành "theo dõi chủ động".`,
    `- tableData: chỉ đưa nếu bài có số liệu so sánh cụ thể (trước/sau, A vs B, năm X/Y). Không có → [].`,
    `- diagramHint: "none" | "timeline" | "compare" | "cause-effect".`,
    ``,
    `VÍ DỤ ĐỘ DÀI và CHẤT LƯỢNG MONG MUỐN cho summaryShort:`,
    `TỆ (tránh): "Bài nói về chính sách thuế quan mới của Mỹ. Điều này ảnh hưởng tới xuất khẩu Việt Nam. Các doanh nghiệp cần theo dõi."`,
    `TỐT: "Mỹ vừa áp thuế 46% với hàng Việt Nam từ 5/4, ba mặt hàng chủ lực (dệt may, da giày, gỗ) bị ảnh hưởng nặng nhất do chiếm 38% kim ngạch xuất Mỹ. Chính phủ đang đàm phán giảm xuống 20% nhưng Bộ Thương mại Mỹ chưa phản hồi. Các doanh nghiệp có hợp đồng FOB sẽ chịu toàn bộ mức thuế, trong khi hợp đồng CIF có thể share với đối tác Mỹ."`,
    ``,
    `THÔNG TIN BÀI:`,
    `- Nguồn: ${sourceLabel}`,
    `- Loại: ${articleType}`,
    `- Tiêu đề: ${title}`,
    excerpt ? `- Excerpt: ${excerpt}` : ``,
    `- Nội dung:`,
    content.slice(0, 14000),
  ]
    .filter(Boolean)
    .join("\n");
}

// ----- schema -----
const summarySchema = {
  type: Type.OBJECT,
  properties: {
    summaryShort: { type: Type.STRING, description: "3-5 câu tóm tắt đủ ý" },
    whatItReallySays: { type: Type.STRING, description: "3-5 câu phân tích lớp sâu" },
    whyItMatters: { type: Type.STRING, description: "3-4 câu ai/cơ chế/khung thời gian" },
    easyExplanation: { type: Type.STRING, description: "3-5 câu giải thích dễ hiểu" },
    keyTakeaway: { type: Type.STRING, description: "1 câu sắc bén" },
    cautionNote: { type: Type.STRING, description: "2-3 câu cảnh báo" },
    conclusionText: { type: Type.STRING, description: "2-3 câu khép bài" },
    context: { type: Type.STRING, description: "2-4 câu bối cảnh trước bài" },
    keyNumbers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          value: { type: Type.STRING },
          meaning: { type: Type.STRING },
        },
        required: ["label", "value", "meaning"],
      },
    },
    whatToWatch: { type: Type.STRING, description: "2-3 câu theo dõi tiếp" },
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
    "context",
    "whatItReallySays",
    "whyItMatters",
    "easyExplanation",
    "keyNumbers",
    "keyTakeaway",
    "cautionNote",
    "whatToWatch",
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
          maxOutputTokens: 3500,
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
  // Nếu primary fail (rate limit Pro), fallback sang Flash (quota cao hơn)
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
      console.warn("generateSummary: invalid shape", { title, model });
    } catch (error) {
      console.error("generateSummary failed", {
        title,
        sourceLabel,
        model,
        error: normalizeError(error),
      });
    }
  }

  console.error("generateSummary: all models failed — fallback", { title });
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
    `Chỉ trả lời dựa trên bài đang mở và phần tóm tắt có sẵn. Không bịa số liệu hoặc nguồn ngoài.`,
    `Nếu câu hỏi nằm ngoài phạm vi bài, nói thẳng "Bài này không đề cập trực tiếp" rồi mới đưa gợi ý.`,
    ``,
    `Tiêu đề: ${title}`,
    ``,
    `Tóm tắt đã có:`,
    `- Tóm tắt ngắn: ${summary.summaryShort}`,
    summary.context ? `- Bối cảnh: ${summary.context}` : "",
    `- Bài thực chất nói gì: ${summary.whatItReallySays}`,
    `- Vì sao quan trọng: ${summary.whyItMatters}`,
    `- Giải thích dễ hiểu: ${summary.easyExplanation}`,
    `- Điểm cần nhớ: ${summary.keyTakeaway}`,
    `- Điểm cần dè chừng: ${summary.cautionNote}`,
    summary.whatToWatch ? `- Theo dõi tiếp: ${summary.whatToWatch}` : "",
    ``,
    `Nội dung bài:`,
    content.slice(0, 12000),
    ``,
    `Câu hỏi: ${question}`,
    ``,
    `Trả lời ngắn gọn, rõ ràng, bám nội dung bài. Tối đa 6-8 câu.`,
  ]
    .filter(Boolean)
    .join("\n");

  const models = chatModelsToTry();

  for (const model of models) {
    try {
      const response = await withRetry(() =>
        withTimeout(
          ai.models.generateContent({
            model,
            contents: prompt,
            config: { temperature: 0.4, maxOutputTokens: 1200 },
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

// ----- ask on selection (feature B) -----
export type AskMode = "explain" | "context" | "related_thinking";

export async function askAboutSelection(params: {
  mode: AskMode;
  selection: string;
  articleTitle: string;
  articleContent: string;
}): Promise<string> {
  const { mode, selection, articleTitle, articleContent } = params;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return "Chưa cấu hình GEMINI_API_KEY.";

  const ai = new GoogleGenAI({ apiKey });

  const modePrompts: Record<AskMode, string> = {
    explain: `Nhiệm vụ: GIẢI THÍCH đoạn được chọn dưới đây cho người không chuyên.
- Giải nghĩa thuật ngữ có trong đoạn.
- Chỉ ra con số / tên riêng / khái niệm khó và diễn giải.
- Dùng ví dụ đời thường nếu giúp hiểu nhanh hơn.
- Trả lời 4-6 câu, tiếng Việt chuẩn.`,
    context: `Nhiệm vụ: CUNG CẤP BỐI CẢNH cho đoạn được chọn.
- Để hiểu đoạn này, cần biết điều gì ĐÃ xảy ra trước đó?
- Có sự kiện / chính sách / thống kê liên quan nào?
- Bằng kiến thức tổng quát (không bịa), giải thích 4-6 câu.
- Nếu không chắc, nói thẳng "Tôi không đủ thông tin để xác nhận, cần nguồn khác".`,
    related_thinking: `Nhiệm vụ: PHÂN TÍCH SÂU đoạn được chọn.
- Đoạn này hàm ý điều gì sâu hơn câu chữ?
- Có giả định không nói ra nào? Có điểm yếu lập luận nào?
- Bài đặt đoạn này vào ngữ cảnh nào? Có góc nhìn nào bị bỏ sót?
- Trả lời 5-7 câu, sắc sảo, như một biên tập viên cấp cao.`,
  };

  const prompt = [
    `Bạn là trợ lý đọc tin thông minh bằng tiếng Việt.`,
    modePrompts[mode],
    ``,
    `BÀI ĐANG ĐỌC:`,
    `Tiêu đề: ${articleTitle}`,
    `Nội dung đầy đủ (cho bối cảnh):`,
    articleContent.slice(0, 10000),
    ``,
    `ĐOẠN NGƯỜI DÙNG CHỌN:`,
    `"${selection.slice(0, 1500)}"`,
    ``,
    `Chỉ dựa vào bài trên và kiến thức tổng quát — không bịa số liệu cụ thể.`,
  ].join("\n");

  const models = chatModelsToTry();

  for (const model of models) {
    try {
      const response = await withRetry(() =>
        withTimeout(
          ai.models.generateContent({
            model,
            contents: prompt,
            config: { temperature: 0.45, maxOutputTokens: 900 },
          }),
          CALL_TIMEOUT_MS,
          `gemini ask-on-selection (${model})`
        )
      );
      const answer = (response.text || "").trim();
      if (answer) return answer;
    } catch (error) {
      console.error("askAboutSelection failed", {
        mode,
        model,
        error: normalizeError(error),
      });
    }
  }

  return "Tạm thời chưa trả lời được (AI đang gặp lỗi). Bạn thử lại sau ít phút.";
}
