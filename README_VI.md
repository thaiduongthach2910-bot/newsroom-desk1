# Newsroom Desk v1

Đây là bộ mã nguồn v1 cho dashboard đọc tin tự động theo hướng **đẹp như một trang báo điện tử cao cấp**, nhưng vẫn là một web app cá nhân, nhẹ và dễ triển khai.

## App này làm được gì
- Có **trang chủ newsroom-style** với hero story, digest sáng, top stories và dòng bài mới.
- Có **trang chi tiết từng bài** với:
  - tóm tắt ngắn
  - bài thực chất muốn nói gì
  - vì sao quan trọng
  - giải thích dễ hiểu
  - điểm cần nhớ
  - điểm cần dè chừng
  - kết luận
  - ô chat hỏi lại riêng cho bài đó
- Có route nền để:
  - quét bài mới
  - tạo digest 6h sáng
- Có **fallback dữ liệu mẫu** nên app vẫn lên giao diện đẹp ngay cả khi bạn chưa nối Supabase/OpenAI xong.

## Cấu trúc chính
- `app/`: giao diện và API routes
- `components/`: các khối UI
- `lib/`: logic lấy dữ liệu, AI, Supabase, collector
- `public/`: hình ảnh minh hoạ phong cách báo chí
- `docs/`: hướng dẫn triển khai

## Chạy local
```bash
npm install
npm run dev
```

Sau đó mở:
```bash
http://localhost:3000
```

## Các biến môi trường cần có
Copy `.env.example` thành `.env.local`, rồi điền:
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

## Lưu ý quan trọng
- Nếu chưa điền OpenAI key, app vẫn chạy nhưng phần AI sẽ dùng fallback đơn giản.
- Nếu chưa điền Supabase, app vẫn lên giao diện với dữ liệu mẫu.
- Khi đã cấu hình xong, route cron có thể chạy thật để lấy bài và tóm tắt.
