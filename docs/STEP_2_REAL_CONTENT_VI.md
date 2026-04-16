# Bước tiếp theo: chuyển từ bản demo sang bản đọc bài thật

Bản hiện tại đã chứng minh web chạy được. Bước tiếp theo là làm cho dashboard hiển thị bài thật và output dài hơn, gần với mẫu bạn đã yêu cầu.

## Gói thay đổi trong v2

- Ưu tiên lấy link VnEconomy từ RSS chính thức, rồi mới fallback sang HTML.
- Giữ Nghiên cứu Quốc tế theo logic bài bình luận/biên dịch.
- Prompt tóm tắt dài hơn, phân biệt rõ 2 kiểu nguồn.
- Cron route nhận cả GET lẫn POST để khớp cách gọi từ Supabase Cron.
- Trang bài chi tiết có thể hiển thị bảng rút nhanh nếu AI trả về `tableData`.

## Việc phải làm sau khi cập nhật code

1. Commit toàn bộ thay đổi lên GitHub.
2. Chờ Vercel redeploy thành công.
3. Gọi thử: `/api/cron/collect` bằng cron hoặc bằng request có `x-cron-secret`.
4. Gọi tiếp: `/api/cron/morning-digest`.
5. Refresh trang chủ. Khi DB có bài thật, dashboard sẽ dần thay seed/demo content.

## Điều cần hiểu đúng

- Giao diện sẽ giữ kiểu newsroom hiện tại.
- Nội dung chỉ hết “sơ sài” khi cron bắt đầu bơm bài thật và AI bắt đầu tạo summary thật.
- Nếu OpenAI key chưa có quota hoặc lỗi, hệ thống vẫn có fallback text nhưng chất lượng sẽ thấp hơn.
