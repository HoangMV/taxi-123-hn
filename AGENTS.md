# Quy ước AI cho dự án TAXI 123_HN

## Ngôn ngữ và mã hóa

- Mọi nội dung hiển thị cho người dùng phải viết bằng tiếng Việt có dấu đầy đủ.
- Mọi comment, README, hướng dẫn cấu hình cũng phải ưu tiên tiếng Việt rõ nghĩa.
- Không được viết chuỗi tiếng Việt không dấu trong code mới, trừ tên biến kỹ thuật hoặc khóa dữ liệu lấy từ AppSheet.
- Tất cả file văn bản phải lưu bằng mã hóa UTF-8.
- Không tạo hoặc giữ lại chuỗi bị lỗi mã hóa kiểu `Ã`, `�`, hoặc tiếng Việt bị vỡ dấu.

## Cấu hình môi trường

- Chỉ giữ các biến `.env` thực sự đang dùng trong mã nguồn.
- Mỗi biến trong `.env.example` phải có comment mô tả tác dụng.
- Nếu thêm biến mới, phải cập nhật giải thích trong `README.md`.

## Kiến trúc

- Giữ dự án ở mức khung sườn, tránh thêm logic thừa chưa dùng.
- Tập trung tái sử dụng `src/services/appSheetService.js` cho mọi kết nối AppSheet.
