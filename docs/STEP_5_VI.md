# STEP 5 — Siết collector, dedupe và nâng summary

## File cần ghi đè
- lib/collectors/discover.ts
- lib/collectors/parse-article.ts
- lib/openai.ts
- lib/supabase.ts
- app/api/cron/collect/route.ts

## Sau khi commit
1. Chờ Vercel redeploy xong.
2. Giữ `collect-news` chạy mỗi phút thêm 2–3 lượt để test.
3. Kiểm tra:
   - Vercel Runtime Logs của `/api/cron/collect`
   - bảng `articles`
   - bảng `article_summaries`
4. Nếu ổn, đổi cron về `*/30 * * * *`.
5. Chưa bật `morning-digest` nếu summary còn quá generic.
