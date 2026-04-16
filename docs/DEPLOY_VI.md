# Hướng dẫn triển khai thật - viết cho người không biết code

## 1. Đưa code lên GitHub
1. Tạo 1 repository mới trên GitHub, ví dụ: `newsroom-desk`
2. Tải toàn bộ thư mục code này lên đó
3. Đảm bảo trong repo có các file như `package.json`, `app/`, `components/`, `lib/`

## 2. Tạo project trên Vercel
1. Vào Vercel
2. Bấm **Add New Project**
3. Chọn repository GitHub vừa tạo
4. Bấm **Import**
5. Vercel sẽ tự nhận đây là dự án Next.js

## 3. Dán biến môi trường vào Vercel
Trong Vercel project:
- vào **Settings**
- vào **Environment Variables**
- tạo 4 biến:
  - `OPENAI_API_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CRON_SECRET`

Có thể thêm:
- `OPENAI_SUMMARY_MODEL` = `gpt-5.4-mini`
- `OPENAI_CHAT_MODEL` = `gpt-5.4-mini`

Sau đó **Redeploy** project.

## 4. Tạo bảng trong Supabase
1. Vào Supabase
2. Mở project của bạn
3. Vào **SQL Editor**
4. Dán nội dung file `SUPABASE_SCHEMA.sql` từ bộ starter trước đó
5. Bấm **Run**

## 5. Tạo lịch chạy trong Supabase Cron
Bạn sẽ tạo 2 lịch:
- lịch quét bài mới
- lịch tạo digest 6h sáng

### 5.1 Lịch quét bài mới
- Tần suất: mỗi 30 phút
- URL gọi tới:
  `https://ten-mien-cua-ban.vercel.app/api/cron/collect`
- Header:
  `x-cron-secret: [giá trị CRON_SECRET của bạn]`

### 5.2 Lịch tạo digest 6h sáng
- Tần suất: mỗi ngày lúc 06:00
- URL gọi tới:
  `https://ten-mien-cua-ban.vercel.app/api/cron/morning-digest`
- Header:
  `x-cron-secret: [giá trị CRON_SECRET của bạn]`

## 6. Kiểm tra thủ công
Sau khi deploy, bạn có thể test nhanh bằng cách dùng Postman hoặc một công cụ gọi API:
- Gọi `/api/cron/collect`
- Gọi `/api/cron/morning-digest`

Nếu trả về `ok: true`, nghĩa là job đã chạy.

## 7. Điều cần nhớ
- Không bao giờ để lộ `SUPABASE_SERVICE_ROLE_KEY`
- Không dán API key vào GitHub public
- Nếu dashboard chưa có dữ liệu thật, nó vẫn sẽ hiện dữ liệu demo để bạn xem giao diện
