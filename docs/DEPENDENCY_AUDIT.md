# Chính sách rà soát phụ thuộc

## Nguyên tắc

- Không chạy `npm audit fix --force` nếu chưa kiểm tra tác động, vì lệnh này có thể hạ hoặc thay đổi mạnh `react-scripts`.
- Ưu tiên cập nhật dependency theo từng nhóm nhỏ, chạy `npm run build` sau mỗi nhóm.
- Các thư viện xử lý file chỉ được dùng cho luồng cần thiết và nên tải bằng lazy-load.

## Runtime config và Access Key

- `public/runtime-config.js` chỉ chứa cấu hình không bí mật: `APP_ID`, `REGION`, `DEFAULT_TABLE`, `API_PROXY_URL`.
- Không ghi `ACCESS_KEY` vào `runtime-config.js`.
- Không tạo file config public riêng cho HTML standalone.
- `REACT_APP_ACCESS_KEY` chỉ để backend proxy đọc từ `.env`.
- Frontend và HTML standalone gọi AppSheet qua `/api/appsheet`, không gọi trực tiếp bằng key trong trình duyệt.

## Excel và Word

- `xlsx` chỉ dùng cho chức năng xuất file Excel từ dữ liệu AppSheet đã tải trong hệ thống.
- Không dùng `xlsx` để import hoặc phân tích file Excel do người dùng tải lên.
- `docxtemplater`, `pizzip`, `file-saver` chỉ tải khi người dùng bấm xuất Word.
- Nếu sau này có chức năng import file từ người dùng, cần đánh giá lại thư viện xử lý file trước khi triển khai.

## Kiểm tra định kỳ

Chạy các lệnh sau trước khi đóng gói bản phát hành:

```bash
npm run build
npm audit --omit=dev
```

Nếu `npm audit` báo lỗi ở dependency gián tiếp của `react-scripts`, cần ghi nhận và cân nhắc nâng cấp nền build thay vì ép sửa tự động.

## Trạng thái hiện tại

- `npm run build` đã tách `xlsx`, `docxtemplater`, `pizzip`, `file-saver` khỏi bundle chính bằng dynamic import.
- `npm audit --omit=dev` vẫn báo các cảnh báo từ chuỗi phụ thuộc của `react-scripts` và `xlsx`.
- `xlsx` hiện chưa có bản vá npm chính thức cho cảnh báo audit, nên dự án chỉ dùng thư viện này cho luồng xuất Excel từ dữ liệu nội bộ.
- Không dùng chức năng import Excel từ người dùng khi chưa thay hoặc đánh giá lại thư viện xử lý file.
