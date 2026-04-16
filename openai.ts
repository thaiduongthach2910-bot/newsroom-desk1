# STEP 6 — Lọc nguồn sạch hơn và giảm summary generic

Ghi đè 3 file:
- lib/collectors/discover.ts
- lib/collectors/parse-article.ts
- lib/openai.ts

Sau đó:
1. commit
2. chờ Vercel redeploy
3. truncate lại `articles`, `article_summaries`, `digest_articles`, `daily_digests`, `article_chat_messages`
4. để `collect-news` chạy mỗi phút 2–3 lượt để test
5. kiểm tra logs + bảng `articles` + `article_summaries`

Kỳ vọng:
- ít URL chuyên mục/landing page hơn
- summary bớt generic/fallback hơn
- chưa bật `morning-digest`
