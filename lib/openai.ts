import OpenAI from "openai";
import { SummaryBlock } from "@/lib/types";

const OPENAI_TIMEOUT_MS = 20000;

function summaryFallback(title: string, excerpt: string, content: string, sourceLabel: string): SummaryBlock {
  const short = (excerpt || content.slice(0, 260)).replace(/\s+/g, " ").trim();
  const isOpinion = /nghiên cứu|nghien cuu/i.test(sourceLabel);

  return {
    summaryShort: short || `Bài "${title}" đã được lấy về, nhưng lớp tóm tắt AI chưa chạy xong nên hệ thống đang dùng bản rút gọn an toàn.`,
    whatItReallySays: isOpinion
      ? "Đây là bài bình luận hoặc biên dịch. Cách đọc đúng là tách phần dữ kiện được nêu ra khỏi phần kết luận mà tác giả đang muốn đẩy người đọc tới."
      : "Đây là bài tin hoặc phân tích thực tế. Điều cần đọc không chỉ là sự kiện, mà là tác động cụ thể lên doanh nghiệp, thị trường, chi phí hoặc chính sách.",
    whyItMatters: "Điểm đáng quan tâm là tác động thực tế phía sau headline. Nếu chỉ đọc lướt tiêu đề, bạn sẽ bỏ qua phần hệ quả mới là thứ quan trọng.",
    easyExplanation: "Nói dễ hiểu, đây là bản tóm tắt dự phòng: đủ để nắm hướng chính của bài, nhưng chưa phải lớp phân tích sâu cuối cùng.",
    keyTakeaway: `Điểm nên giữ lại từ bài "${title}" là phải nhìn vào tác động thực tế hoặc lập luận trung tâm, không dừng ở phần bề mặt.`,
    cautionNote: isOpinion
      ? "Với bài bình luận/biên dịch, luôn tách dữ kiện khỏi suy luận của tác giả."
      : "Với bài tin/phân tích, cần dè chừng việc headline mạnh hơn dữ kiện thật trong thân bài.",
    conclusionText: "Bài đã được thu thập thành công. Khi lớp AI chính ổn định hơn, phần kết luận sẽ sắc hơn bản dự phòng này.",
    tableData: [],
    diagramHint: "none",
  };
}

function normalizeSummary(parsed: any): SummaryBlock | null {
  if (!parsed || typeof parsed !== "object") return null;

  const required = [
    "summaryShort",
    "whatItReallySays",
    "whyItMatters",
    "easyExplanation",
    "keyTakeaway",
    "cautionNote",
    "conclusionText",
  ];

  for (const key of required) {
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
    diagramHint: parsed.diagramHint === "timeline" || parsed.diagramHint === "compare" || parsed.diagramHint === "cause-effect" ? parsed.diagramHint : "none",
  };
}

function buildPrompt(params: {
  title: string;
  excerpt: string;
  content: string;
  sourceLabel: string;
  articleType: string;
}) {
  const isOpinion = params.articleType === "opinion_translation";

  return `Bạn là biên tập viên phân tích tin tức bằng tiếng Việt.
Viết ngắn, rõ, có nội dung thật, không sáo rỗng, không bịa dữ kiện ngoài bài.

Trả về JSON hợp lệ với các khóa:
summaryShort, whatItReallySays, whyItMatters, easyExplanation, keyTakeaway, cautionNote, conclusionText, tableData, diagramHint

Yêu cầu:
- summaryShort: 2-4 câu.
- whatItReallySays: bóc rõ điều bài muốn người đọc hiểu.
- whyItMatters: nói tác động thực tế.
- easyExplanation: giải thích gọn, đời thường, không giáo điều.
- keyTakeaway: 1 câu chốt.
- cautionNote: 1 câu về giới hạn hoặc điểm cần dè chừng.
- conclusionText: 1-2 câu kết.
- tableData: mảng rỗng nếu bài không có số liệu rõ.
- diagramHint: chỉ dùng one of none, timeline, compare, cause-effect.

Nguồn: ${params.sourceLabel}
Loại bài: ${params.articleType}
Cách đọc riêng: ${isOpinion ? "Đây là bài bình luận/biên dịch, cần tách dữ kiện khỏi suy luận." : "Đây là bài tin/phân tích, cần bám vào tác động thực tế."}

Tiêu đề: ${params.title}
Excerpt: ${params.excerpt}
Nội dung bài:
${params.content.slice(0, 6000)}`;
}

export async function generateSummary(params: {
  title: string;
  excerpt: string;
  content: string;
  sourceLabel: string;
  articleType: string;
}): Promise<SummaryBlock> {
  const apiKey = process.env.OPENAI_API_KEY;
  const { title, excerpt, content, sourceLabel } = params;

  if (!apiKey) return summaryFallback(title, excerpt, content, sourceLabel);

  const client = new OpenAI({
    apiKey,
    timeout: OPENAI_TIMEOUT_MS,
    maxRetries: 0,
  });

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_SUMMARY_MODEL || "gpt-4o-mini",
      input: buildPrompt(params),
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "news_summary",
          strict: true,
          schema: {
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
              "tableData",
              "diagramHint",
            ],
          },
        },
      },
    });

    const outputText = (response.output_text || "").trim();
    if (!outputText) return summaryFallback(title, excerpt, content, sourceLabel);

    const parsed = normalizeSummary(JSON.parse(outputText));
    return parsed ?? summaryFallback(title, excerpt, content, sourceLabel);
  } catch (error) {
    console.error("generateSummary primary failed", {
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

  const client = new OpenAI({ apiKey, timeout: OPENAI_TIMEOUT_MS, maxRetries: 0 });

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_SUMMARY_MODEL || "gpt-4o-mini",
      input: `Bạn là trợ lý giải thích tin tức bằng tiếng Việt. Chỉ trả lời dựa trên bài đang mở và phần tóm tắt đã có sẵn.\n\nTiêu đề: ${title}\n\nTóm tắt có sẵn:\n- ${summary.summaryShort}\n- ${summary.whatItReallySays}\n- ${summary.whyItMatters}\n- ${summary.easyExplanation}\n- ${summary.keyTakeaway}\n- ${summary.cautionNote}\n\nNội dung nền:\n${content.slice(0, 6000)}\n\nCâu hỏi của người dùng:\n${question}`,
      store: false,
    });

    return response.output_text?.trim() || `Dựa trên bài "${title}", ý chính vẫn là: ${summary.keyTakeaway}`;
  } catch {
    return `Dựa trên bài "${title}", ý chính vẫn là: ${summary.keyTakeaway}`;
  }
}
