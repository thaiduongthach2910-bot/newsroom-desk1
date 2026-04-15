import OpenAI from "openai";
import { SummaryBlock } from "@/lib/types";

const summaryFallback = (title: string, excerpt: string, content: string): SummaryBlock => {
  const short = excerpt || content.slice(0, 220);
  return {
    summaryShort: short,
    whatItReallySays:
      "Bài này có giá trị ở việc gom các tín hiệu quan trọng lại và buộc người đọc nhìn vào phần bản chất thay vì chỉ nhìn tiêu đề.",
    whyItMatters:
      "Nếu đọc đúng trọng tâm, bạn sẽ nhanh nhận ra bài này liên quan đến quyết định chính sách, thị trường hoặc cách hiểu vấn đề.",
    easyExplanation:
      "Nói ngắn gọn, đây là phần giải thích lại bằng ngôn ngữ dễ hiểu hơn từ nội dung gốc của bài.",
    keyTakeaway: `Điểm chính cần giữ lại từ bài "${title}" là phải đọc cả tác động phía sau, không chỉ sự kiện bề mặt.`,
    cautionNote:
      "Đây là bản fallback khi chưa cấu hình OpenAI API key, nên chất lượng diễn giải sẽ đơn giản hơn bản AI đầy đủ.",
    conclusionText:
      "Bản v1 vẫn hoạt động được mà không chặn bạn ở bước cấu hình AI, nhưng nên thêm OpenAI key để có chất lượng tóm tắt tốt hơn.",
    diagramHint: "none",
  };
};

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
    return summaryFallback(title, excerpt, content);
  }

  const client = new OpenAI({ apiKey });
  const prompt = `
Bạn là trợ lý phân tích tin tức bằng tiếng Việt. Hãy đọc bài viết sau và trả về JSON thuần, không markdown, không giải thích ngoài JSON.

Yêu cầu:
- Viết rõ, gọn, có chiều sâu.
- Nếu bài thuộc loại bình luận/biên dịch, phải giữ giọng thận trọng và phân biệt fact với opinion.
- Không sao chép nguyên văn bài báo dài dòng.
- Trả về đúng các khóa sau:
{
  "summaryShort": "...",
  "whatItReallySays": "...",
  "whyItMatters": "...",
  "easyExplanation": "...",
  "keyTakeaway": "...",
  "cautionNote": "...",
  "conclusionText": "...",
  "diagramHint": "timeline | cause-effect | compare | none"
}

Nguồn: ${sourceLabel}
Loại bài: ${articleType}
Tiêu đề: ${title}
Tóm tắt/đoạn mở đầu: ${excerpt}
Nội dung:
${content.slice(0, 12000)}
`;

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_SUMMARY_MODEL || "gpt-5.4-mini",
      input: prompt,
      store: false,
      text: {
        verbosity: "low",
      },
    });

    const parsed = parseJsonSafely(response.output_text);
    return parsed ?? summaryFallback(title, excerpt, content);
  } catch {
    return summaryFallback(title, excerpt, content);
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
${content.slice(0, 10000)}

Câu hỏi của người dùng:
${question}

Hãy trả lời:
- Rõ ràng
- Dễ hiểu
- Có good will
- Nếu câu hỏi vượt ngoài dữ liệu của bài, nói rõ là bài hiện tại không đủ để khẳng định.
`;

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_CHAT_MODEL || "gpt-5.4-mini",
      input: prompt,
      store: false,
      text: { verbosity: "low" },
    });

    return response.output_text.trim();
  } catch {
    return `Tôi chưa trả lời được bằng AI lúc này. Dựa trên bài đang mở, ý chính cần giữ lại là: ${summary.keyTakeaway}`;
  }
}
