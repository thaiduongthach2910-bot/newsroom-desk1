import { NextResponse } from "next/server";
import { answerAboutArticle } from "@/lib/openai";
import { getArticleBySlug } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const slug = typeof body?.slug === "string" ? body.slug : undefined;
    const question = typeof body?.question === "string" ? body.question : undefined;

    if (!slug || !question) {
      return NextResponse.json({ error: "Thiếu slug hoặc question." }, { status: 400 });
    }

    const article = await getArticleBySlug(slug);
    if (!article) {
      return NextResponse.json({ error: "Không tìm thấy bài viết." }, { status: 404 });
    }

    const answer = await answerAboutArticle({
      question,
      title: article.title,
      content: article.content,
      summary: article.summary,
    });

    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json({ error: "Không xử lý được yêu cầu chat." }, { status: 500 });
  }
}
