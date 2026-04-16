# Final patch từ repo hiện tại

Bản này sửa đúng trên codebase đang chạy của bạn, không vá chồng patch cũ nữa.

## File cần ghi đè
- `lib/collectors/discover.ts`
- `lib/collectors/parse-article.ts`
- `lib/openai.ts`
- `lib/supabase.ts`

## Bản này sửa gì
1. Chặn mạnh hơn các URL trang chuyên mục/landing page của VnEconomy.
2. Không cho `parse-article` dùng selector quá rộng ở VnEconomy nữa.
3. Chỉ nhận bài VnEconomy khi có body chuyên biệt và có published meta.
4. Giảm summary fallback kiểu chung chung, tách giọng điệu rõ hơn cho bài bình luận.
5. Dedupe mạnh hơn theo URL, title, published_at và title đã chuẩn hóa trong 7 ngày gần nhất.
6. Bổ sung lại `storeDigest` để tránh lỗi import nếu route digest còn gọi tới.

## Cách làm
1. Ghi đè 4 file trên vào repo GitHub hiện tại.
2. Commit.
3. Chờ Vercel redeploy.
4. Xóa dữ liệu test cũ nếu muốn nhìn kết quả sạch:

```sql
truncate table article_chat_messages restart identity cascade;
truncate table article_summaries restart identity cascade;
truncate table digest_articles restart identity cascade;
truncate table daily_digests restart identity cascade;
truncate table articles restart identity cascade;
```

Giữ nguyên bảng `sources`.

5. Cho `collect-news` chạy mỗi phút 2-3 lượt để test.
6. Nếu ổn thì đổi lại cron về `*/30 * * * *`.
