# Bản thay file hoàn chỉnh - không cần vá tay

Trong gói này có 3 file cần thay nguyên file:
- `lib/collectors/discover.ts`
- `lib/collectors/parse-article.ts`
- `lib/openai.ts`

## Làm đúng 5 bước
1. Giải nén file zip.
2. Trong GitHub repo của bạn, mở đúng 3 file cùng tên ở trên.
3. Xóa toàn bộ nội dung cũ của từng file.
4. Dán toàn bộ nội dung file mới tương ứng vào.
5. Commit rồi chờ Vercel redeploy.

## Sau khi deploy xong
1. Vào Supabase SQL Editor.
2. Chạy lệnh sau để dọn dữ liệu test cũ:

```sql
truncate table article_chat_messages restart identity cascade;
truncate table article_summaries restart identity cascade;
truncate table digest_articles restart identity cascade;
truncate table daily_digests restart identity cascade;
truncate table articles restart identity cascade;
```

Không xóa bảng `sources`.

## Rồi test lại
- Cho `collect-news` chạy mỗi phút thêm 2–3 lượt.
- Sau khi thấy ổn thì đổi lại cron về `*/30 * * * *`.

## Kỳ vọng của bản này
- VnEconomy sẽ ưu tiên lấy link từ RSS thay vì hút bừa landing page.
- Các title rác kiểu chuyên mục/ấn phẩm sẽ bị chặn mạnh hơn.
- Nghiên cứu Quốc tế sẽ bớt lọt bài historical/ngoại đề.
- Summary sẽ cố chạy nhánh chính trước; nếu lỗi, log sẽ hiện lỗi gốc rõ hơn thay vì chỉ fallback mù.
