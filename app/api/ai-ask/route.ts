import { NextResponse } from "next/server";
import { askAboutSelection, AskMode } from "@/lib/openai";
import { getArticleBySlug } from "@/lib/supabase";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const VALID_MODES: AskMode[] = ["explain", "context", "related_thinking"];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slug, selection, mode } = body as {
      slug?: string;
      selection?: string;
      mode?: AskMode;
    };

    if (!slug || !selection || !mode || !VALID_MODES.includes(mode)) {
      return NextResponse.json({ error: "Missing or invalid parameters" }, { status: 400 });
    }

    if (selection.length < 10) {
      return NextResponse.json(
        { error: "Đoạn bạn chọn quá ngắn. Hãy chọn ít nhất 1 câu hoàn chỉnh." },
        { status: 400 }
      );
    }

    if (selection.length > 2000) {
      return NextResponse.json(
        { error: "Đoạn bạn chọn quá dài. Tối đa ~2000 ký tự." },
        { status: 400 }
      );
    }

    const article = await getArticleBySlug(slug);
    if (!article) {
      return NextResponse.json({ error: "Bài không tồn tại" }, { status: 404 });
    }

    const answer = await askAboutSelection({
      mode,
      selection,
      articleTitle: article.title,
      articleContent: article.content,
    });

    return NextResponse.json({ ok: true, answer });
  } catch (error) {
    console.error("ai-ask failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
