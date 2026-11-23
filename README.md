# LuyệnĐề THCS

Web luyện đề kiểm tra trắc nghiệm cấp 2 (Lớp 6, 7, 8, 9) theo **Chương trình GDPT 2018**, có hệ thống tài khoản **Giáo viên** (tạo lớp, giao đề, xem bài làm & xuất điểm Excel) và **Học sinh** (tham gia lớp bằng mã, làm bài, xem điểm & lời giải chi tiết).

## Bảo mật đăng nhập

- Mật khẩu băm bằng **`scrypt` + salt ngẫu nhiên riêng từng tài khoản**, so sánh bằng `timingSafeEqual`.
- Phiên đăng nhập dùng token ngẫu nhiên 256-bit, chỉ lưu bản băm **SHA-256** trong Postgres (`luyende.sessions`), gửi qua cookie **`HttpOnly; SameSite=Lax; Secure`**.
- Giới hạn tần suất thử đăng nhập / đăng ký (rate limiting) chống dò mật khẩu.
- Phân quyền rõ ràng giữa `teacher` và `student`; toàn bộ truy vấn SQL dùng parameterized queries.
- **Bảo vệ tài khoản giáo viên**: tài khoản giáo viên đầu tiên có thể đăng ký ngay khi triển khai. Từ giáo viên thứ 2 trở đi bắt buộc phải có biến môi trường `TEACHER_INVITE_CODE` để học sinh không thể tự đăng ký làm giáo viên.

## Luồng sử dụng cho Giáo viên & Học sinh

1. **Giáo viên**: Vào `/dang-nhap` → tab **Đăng ký tài khoản** → chọn vai trò **Giáo viên** để tạo tài khoản đầu tiên.
2. Vào mục **Quản lý lớp** (`/giao-vien`):
   - Tạo lớp (vd `8A1`, Khối 8) → hệ thống cấp **Mã lớp** (vd `T8-AB12`).
   - Chọn **Giao đề** cho lớp (từ 96 đề Toán 6–9) kèm hạn nộp & dặn dò.
   - Xem kết quả nộp bài của học sinh, bấm **Xem bài** để kiểm tra từng câu, hoặc bấm **Xuất Excel (CSV)**.
3. **Học sinh**: Đăng ký tài khoản **Học sinh** và nhập **Mã lớp** giáo viên gửi → đề giáo viên giao hiện ngay trên trang chủ. Nộp bài xong học sinh thấy điểm + lời giải chi tiết, còn giáo viên thấy ngay kết quả trong bảng điểm.

## Deploy lên Render

1. Đẩy code lên GitHub.
2. Render tự đọc `render.yaml` và build `Dockerfile`.
3. Điền biến môi trường:
   - `DATABASE_URL`: chuỗi kết nối Postgres (Neon). Toàn bộ bảng nằm riêng trong schema `luyende`.
   - `TEACHER_INVITE_CODE` *(tùy chọn)*: mã bí mật nếu sau này muốn tạo thêm tài khoản giáo viên khác.
