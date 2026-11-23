# TíchGóp — PWA Quản Lý Chi Tiêu Gia Đình

Ứng dụng **Progressive Web App (PWA)** hiện đại giúp quản lý chi tiêu chung cho gia đình 4 thành viên (**Cha Bình**, **Mẹ Trang**, **Minh Phát**, **Mai Anh**), ưu tiên icon trực quan, hiệu ứng mượt mà và hoạt động ngoại tuyến 100%.

## Tính năng chính
- **4 thành viên cùng xem chung tổng gia đình**: Chuyển đổi danh tính nhanh giữa Cha Bình, Mẹ Trang, Minh Phát, Mai Anh; luôn hiển thị tổng chi tiêu cả nhà và cho phép lọc chi tiết từng người.
- **Tự động tổng hợp Ngày / Tuần / Tháng / Năm**: Biểu đồ Donut phân loại, biểu đồ cột xu hướng (Theo Ngày T2–CN, Theo Tuần trong tháng, Theo Tháng), so sánh Thu & Chi và nhận xét thông minh.
- **Phân loại chi tiêu hằng ngày & Lịch tháng tương tác**: Tra cứu chi tiêu từng ngày ngay trên ô lịch, gom nhóm lịch sử theo ngày kèm tổng phụ tự động.
- **Quét & Chụp hóa đơn OCR**: Mở camera chụp bill hoặc tải ảnh hóa đơn, tự động xử lý ảnh trên trình duyệt (`tesseract.js`), tách dòng `TỔNG CỘNG`, phân loại danh mục và lưu kèm ảnh hóa đơn thu nhỏ.
- **Nhập liệu bằng Giọng nói tiếng Việt**: Hỗ trợ Web Speech API (`vi-VN`) kết hợp bộ phân tích ngôn ngữ tự nhiên tiếng Việt hiểu số tiền (`450 nghìn`, `1 triệu rưỡi`, `120k`), thành viên, danh mục và ngày tháng.
- **Chuẩn PWA cài đặt & Sao lưu**: Hỗ trợ cài lên màn hình chính (iOS / Android / Desktop), giao diện Sáng / Tối, xuất Excel CSV (UTF-8) và sao lưu / khôi phục JSON.

## Phát triển & Triển khai

```bash
npm install
npm run dev      # Chạy môi trường phát triển
npm run build    # Kiểm tra TypeScript & build PWA production
npm run preview  # Xem thử bản production PWA
```
