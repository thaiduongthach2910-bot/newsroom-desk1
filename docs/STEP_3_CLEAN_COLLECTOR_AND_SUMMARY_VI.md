# Bước 3 — làm sạch collector và nâng chất lượng summary

Bản này sửa 3 vấn đề chính:

1. Không còn hút bừa các trang chuyên mục/landing page của VnEconomy.
2. Không còn kéo bài quá cũ của Nghiên cứu Quốc tế.
3. Summary chuyển từ kiểu fallback/generic sang Structured Outputs để ra đúng schema ổn định hơn.

## File đã thay
- `lib/collectors/discover.ts`
- `lib/collectors/parse-article.ts`
- `lib/openai.ts`
- `lib/supabase.ts`

## Việc phải làm sau khi upload code
1. Commit lên GitHub.
2. Chờ Vercel redeploy.
3. Xoá dữ liệu cũ trong `articles` và `article_summaries` nếu muốn nhìn sạch.
4. Chạy lại `collect-news`.
5. Kiểm tra chất lượng row mới trong `articles` và `article_summaries`.

## Gợi ý dọn dữ liệu cũ
Bạn có thể vào Supabase SQL Editor và chạy:

```sql
truncate table article_chat_messages restart identity cascade;
truncate table article_summaries restart identity cascade;
truncate table digest_articles restart identity cascade;
truncate table daily_digests restart identity cascade;
truncate table articles restart identity cascade;
```

## Kỳ vọng sau khi chạy lại
- `articles` chỉ còn bài viết thật hơn, bớt trang chuyên mục.
- `article_summaries` bớt fallback, câu chữ dài và sát mẫu hơn.
- `table_json` bắt đầu có dữ liệu ở một số bài có số liệu rõ.
