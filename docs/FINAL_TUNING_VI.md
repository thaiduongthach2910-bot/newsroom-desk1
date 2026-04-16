# Final tuning v2

Patch này chỉ sửa đúng 3 file:
- `lib/collectors/discover.ts`
- `lib/collectors/parse-article.ts`
- `lib/openai.ts`

Mục tiêu:
- mở lại VnEconomy theo hướng lấy bài thật nhiều hơn
- chặn các bài kiểu historical/ngoại đề từ Nghiên cứu Quốc tế
- giảm việc summary rơi vào fallback generic
- nếu vẫn fallback thì text fallback vẫn đọc được hơn trước

Sau khi ghi đè 3 file này:
1. Commit lên GitHub
2. Chờ Vercel redeploy
3. Xóa dữ liệu test cũ nếu muốn nhìn sạch
4. Cho `collect-news` chạy mỗi phút 2-3 lượt để test
5. Kiểm tra lại `articles`, `article_summaries`, và Vercel Logs của `/api/cron/collect`

SQL dọn dữ liệu:
```sql
truncate table article_chat_messages restart identity cascade;
truncate table article_summaries restart identity cascade;
truncate table digest_articles restart identity cascade;
truncate table daily_digests restart identity cascade;
truncate table articles restart identity cascade;
```

Giữ nguyên bảng `sources`.
