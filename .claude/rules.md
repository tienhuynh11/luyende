# Quy tắc dự án Góc Ôn Tập

## 1. Mục đích cốt lõi
- Nền tảng dành cho **Gia sư / Giáo viên** giao bài tập trắc nghiệm, biên soạn bộ lý thuyết, chấm chữa bài chi tiết và **dạy học trực tiếp** (bảng trắng + up ảnh đề + trao đổi) cho học sinh THCS (Lớp 6–9, chương trình GDPT 2018).

## 2. Dữ liệu & Hiệu năng (Không lưu `localStorage` dư thừa)
- Mọi dữ liệu nghiệp vụ (tài khoản, đề thi, bài giao, bài nộp, chấm chữa, bộ lý thuyết) lưu trực tiếp trên **PostgreSQL** (schema `luyende`).
- **Không** lưu lịch sử làm bài, nháp đề hay đồng bộ mã khôi phục vào `localStorage`. Chỉ giữ tối thiểu tùy chọn giao diện Sáng/Tối (`luyende_theme`).

## 3. Bảo mật & Phân quyền tách biệt (Anti-bypass)
- **Tách biệt hoàn toàn theo từng giáo viên**: giáo viên nào chỉ thấy và thao tác được với học sinh, đề riêng, bài giao, bài nộp, bộ lý thuyết và phòng dạy trực tiếp của chính mình (`teacher_id`).
- **Học sinh chỉ thấy bài được giao**: ẩn kho đề mặc định với học sinh; chặn bypass gõ thẳng URL `/de/...` cả ở Frontend lẫn `POST /api/submissions`.
- **Chế độ công bố điểm**: khi gia sư chọn *Chờ gia sư xem và xác nhận công bố*, API phải ẩn hoàn toàn điểm/số câu đúng (`score = 0`, chặn xem chi tiết) cho tới khi gia sư bấm **Xác nhận & Công bố điểm**.
- **Phòng dạy trực tiếp**: học sinh không được vào xem bảng/chat khi gia sư chưa bấm **Mở phòng**; server tự làm sạch payload gửi cho học sinh khi phòng đóng.
- Mật khẩu dùng `scrypt` + salt riêng + `timingSafeEqual`; phiên dùng cookie `HttpOnly; SameSite=Lax; Secure` lưu bản băm SHA-256; có rate limiting cho đăng nhập/đăng ký.

## 4. Quy tắc UI/UX (theo `ui-ux-pro-max` - Minimalism & Swiss Style)
- **Không làm giao diện kiểu AI**: không banner quảng cáo lấp lánh, không emoji thay icon, không hiệu ứng nhảy giật làm lệch layout.
- **Tối ưu cả Desktop (PC) và Mobile**:
  - Breakpoints chuẩn: `375px` (điện thoại nhỏ), `768px` (tablet/mobile nav), `1024px`, `1440px`.
  - Mobile dùng thanh điều hướng dưới cùng (`<= 5` mục) có `env(safe-area-inset-bottom)`, nút bấm `>= 44×44px`, input `font-size: 16px` tránh iOS tự zoom.
  - Bảng trắng dạy trực tiếp giữ cố định tỉ lệ `16:10` để nét vẽ khớp tuyệt đối giữa PC và Mobile; khung chat dạng bong bóng nổi có xem nhanh tin nhắn mới.
- **Khả năng tiếp cận (Accessibility)**:
  - Tương phản chữ tối thiểu `4.5:1` ở cả chế độ Sáng và Tối.
  - Luôn giữ `focus-visible` rõ ràng cho bàn phím, hỗ trợ `prefers-reduced-motion`, mọi icon-only button đều có `aria-label` và `title`.
  - Dùng trọn bộ icon vector `lucide-react` đồng nhất nét vẽ.
