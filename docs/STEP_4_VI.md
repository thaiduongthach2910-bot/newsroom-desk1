# STEP 4 — Vá collector, chống 500, và nâng summary

Gói này thay 4 file chính:
- `lib/collectors/discover.ts`
- `lib/collectors/parse-article.ts`
- `lib/openai.ts`
- `lib/supabase.ts`
- `app/api/cron/collect/route.ts`

## Mục tiêu
- Loại bớt trang chuyên mục/landing page.
- Giữ lại bài mới thật sự từ Nghiên cứu Quốc tế.
- Tránh một bài lỗi làm sập cả lượt collect.
- Giảm lỗi `429` từ OpenAI bằng retry.
- Sửa lỗi insert UUID sai ở bảng `articles`.

## Sau khi upload patch
1. Chờ Vercel redeploy xong.
2. Cho `collect-news` chạy test 2–3 lượt.
3. Nếu ổn, đổi lại cron về `*/30 * * * *`.
4. Chưa bật `morning-digest` cho đến khi summary bớt generic.
