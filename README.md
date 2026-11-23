# LuyệnĐề THCS

Web luyện đề kiểm tra trắc nghiệm cấp 2 (Lớp 6, 7, 8, 9) theo **Chương trình GDPT 2018** (bám sát 3 bộ sách *Kết nối tri thức, Chân trời sáng tạo, Cánh diều*), thiết kế tương thích hoàn hảo trên cả **PC và điện thoại**.

## Tính năng chính

- **96 đề kiểm tra trắc nghiệm Toán THCS** (24 đề cho mỗi khối Lớp 6, 7, 8, 9), tập trung vào thời điểm **Học kì 1**:
  - 8 Đề kiểm tra Cuối Học kì 1 (90 phút — cấu trúc mới: Trắc nghiệm 4 lựa chọn + Đúng/Sai + Trả lời ngắn)
  - 6 Đề kiểm tra Giữa Học kì 1 (60 phút)
  - 6 Đề kiểm tra 15 phút theo chuyên đề
  - 4 Đề Ôn tập chương (45 phút)
- **Sinh đề luyện tập ngẫu nhiên** bất cứ lúc nào cho từng khối lớp.
- **Chấm điểm tự động theo thang điểm 10** (chuẩn cách tính điểm Đúng/Sai mới của Bộ GD&ĐT) kèm **lời giải chi tiết** hiển thị công thức Toán đẹp mắt bằng KaTeX.
- **Hai chế độ làm bài**: *Thi thử* (có đồng hồ đếm ngược, tự lưu nháp) và *Luyện tập* (kiểm tra & xem lời giải ngay từng câu).
- **Sẵn sàng mở rộng đa môn**: Kiến trúc tách biệt từng môn (`client/src/content/subjects.ts` và `client/src/content/index.ts`) để dễ dàng bổ sung Ngữ văn, Tiếng Anh, Khoa học tự nhiên, Lịch sử & Địa lí sau này.

## Cấu trúc thư mục

```
client/   Vite + React + KaTeX (giao diện PC/Mobile, kho đề, lời giải chi tiết)
server/   Node HTTP server (phục vụ client/dist, /health, API đồng bộ lịch sử tùy chọn)
shared/   Kiểu dữ liệu & logic chấm điểm dùng chung giữa client và server
Dockerfile & render.yaml   Deploy 1-click lên Render giống dự án speakup
```

## Chạy local

```bash
cd server && npm install && npm run dev   # API tại :8787
cd client && npm install && npm run dev   # Giao diện tại :5173
```

## Deploy lên Render

1. Đẩy thư mục `luyende` lên GitHub.
2. Vào Render Dashboard → **New → Blueprint** → chọn repo. Render tự đọc `render.yaml` và build `Dockerfile`.
3. **Không bắt buộc cấu hình biến môi trường nào** — web chạy ngay lập tức với lưu trữ cục bộ (`localStorage`).
4. *(Tùy chọn)* Nếu muốn đồng bộ lịch sử làm bài giữa PC và điện thoại, điền `DATABASE_URL` (có thể dùng chung Neon Postgres với `speakup`; bảng của `luyende` nằm riêng trong schema `luyende`).

## Thêm môn học mới sau này

1. Tạo thư mục `client/src/content/<ma-mon>/` chứa các file đề theo khối lớp 6–9.
2. Đổi `available: true` cho môn đó trong `client/src/content/subjects.ts`.
3. Gắn danh sách đề vào `EXAMS_BY_SUBJECT` trong `client/src/content/index.ts`.
