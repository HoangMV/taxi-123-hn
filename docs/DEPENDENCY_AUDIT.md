# Chính sách rà soát phụ thuộc

## Nguyên Tắc

- Không chạy `npm audit fix --force` nếu chưa kiểm tra tác động, vì lệnh này có thể thay đổi mạnh nền build hoặc thư viện nghiệp vụ.
- Ưu tiên cập nhật dependency theo từng nhóm nhỏ, chạy `npm run build` sau mỗi nhóm.
- Các thư viện xử lý file chỉ được dùng cho luồng cần thiết và nên tải bằng lazy-load.

## Runtime Config Và Khóa Truy Cập

- `public/runtime-config.js` chỉ chứa cấu hình public không bí mật như `DEFAULT_TABLE` và `API_BASE_URL`.
- Không ghi private key Google service account vào `runtime-config.js`, file public hoặc source frontend.
- Không tạo file config public riêng cho HTML standalone.
- Frontend và HTML standalone gọi Google Sheets qua `/api/<nghiep-vu>`, không gọi trực tiếp bằng key trong trình duyệt.

## Excel Và Word

- `exceljs` chỉ dùng cho chức năng xuất file Excel từ dữ liệu Google Sheets đã tải trong hệ thống.
- Không dùng thư viện Excel để import hoặc phân tích file Excel do người dùng tải lên khi chưa rà soát riêng.
- `docxtemplater`, `pizzip`, `file-saver` chỉ tải khi người dùng bấm xuất Word.
- Nếu sau này có chức năng import file từ người dùng, cần đánh giá lại thư viện xử lý file trước khi triển khai.

## Kiểm Tra Định Kỳ

Chạy các lệnh sau trước khi đóng gói bản phát hành:

```bash
npm run build
npm audit --omit=dev
```

Nếu `npm audit` báo lỗi ở dependency gián tiếp của nền build hoặc thư viện xuất file, cần ghi nhận và cân nhắc thay thư viện thay vì ép sửa tự động.

## Trạng Thái Hiện Tại

- Dự án dùng Vite cho frontend build.
- Dữ liệu nghiệp vụ đọc qua Google Sheets API ở backend.
- `docxtemplater`, `pizzip`, `file-saver` và `exceljs` chỉ tải khi người dùng bấm xuất file.
- Không dùng chức năng import Excel từ người dùng khi chưa thay hoặc đánh giá lại thư viện xử lý file.
