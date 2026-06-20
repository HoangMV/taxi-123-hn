# Quy chuẩn làm trang nghiệp vụ Google Sheets

Tài liệu này mô tả chuẩn triển khai nghiệp vụ hiện tại bằng Google Sheets API qua backend service account.

## Trước Khi Làm

1. Đọc `docs/google-sheets-schema.md` để biết tên bảng/cột hiện có.
2. Đọc `docs/google-sheets-relationships.md` để biết quan hệ Ref cần resolve; không suy luận quan hệ chỉ từ tên cột `Ref_` nếu tài liệu quan hệ đã có mapping rõ hơn.
3. Kiểm tra feature helper hiện có trong `src/features/` trước khi thêm logic mới.
4. Nếu phát hiện quan hệ Ref mới, cập nhật `docs/google-sheets-relationships.md` ngay trong lượt làm đó.

## Khi Thêm Bảng Hoặc Nghiệp Vụ Mới

1. Thêm tên bảng mới vào `REACT_APP_SCHEMA_TABLES` trong `.env` để script schema đọc được bảng đó.
2. Chạy `npm run schema:google-sheets` để cập nhật `docs/google-sheets-schema.md`.
3. Đọc phần bảng mới trong schema, liệt kê các cột có dạng `Ref_...`, cột chứa ID bảng khác dù không bắt đầu bằng `Ref_`, và các cột hiển thị sẵn như `Ten...`, `HoTen...`, `Display`.
4. Xác định bảng đích của từng Ref bằng tên cột, tên khóa chính, dữ liệu mẫu, tài liệu nghiệp vụ hoặc cấu hình AppSheet cũ nếu còn truy cập được. Nếu chưa chắc, ghi rõ `Cần kiểm tra thêm` trong `docs/google-sheets-relationships.md` và không tự render mã Ref như tên thật.
5. Cập nhật `docs/google-sheets-relationships.md` với mapping: bảng nguồn, cột Ref, bảng đích, khóa bảng đích và cột nên hiển thị.
6. Sau khi quan hệ đã rõ mới tạo hoặc sửa bundle trong `scripts/google-feature-bundles.cjs`, route trong `api/`, route local proxy và UI React/HTML.
7. Nếu bảng mới có nhiều Ref, backend phải gom bảng liên quan trong bundle và trả về `related`; frontend không tự gọi Google Sheets và không tự đoán tên từ mã Ref.

## Luồng Dữ Liệu Chuẩn

- React page và HTML standalone chỉ gọi endpoint `/api/<nghiep-vu>`.
- Backend endpoint đọc Google Sheets bằng `scripts/google-sheets-service.cjs`.
- Logic gom nhiều bảng đặt trong `scripts/google-feature-bundles.cjs`.
- Không gọi nguồn cũ trực tiếp từ trình duyệt.
- Không cache dữ liệu bảng Google Sheets; backend chỉ cache OAuth token Google.
- Response giữ shape thống nhất: `{ row, related, source: "google-sheets" }`.

## Backend Bundle

- Nếu thiếu cấu hình Google Sheets, endpoint trả `500` với lỗi tiếng Việt rõ nghĩa.
- Nếu thiếu ID chính, endpoint trả `400`.
- Nếu không tìm thấy row chính, endpoint trả `404`.
- Các bảng không phụ thuộc nhau phải đọc song song bằng `Promise.all` hoặc `values:batchGet`.
- Bỏ qua các cột `Related ...` khi parse dữ liệu vì đây không phải dữ liệu nhập chính.
- Nếu tab Google Sheet khác tên bảng trong code, dùng `GOOGLE_SHEETS_TABLE_MAP`.
- Nếu cần giới hạn cột/range để tối ưu tốc độ, dùng `GOOGLE_SHEETS_RANGE_MAP`.

## Frontend React

- Page không truyền service đọc dữ liệu cũ vào feature helper.
- Feature helper gọi API bundle, rồi build payload sạch để render/preview/export.
- Nếu API trả HTML thay vì JSON, báo lỗi hướng dẫn chạy `npm run proxy` khi test local.
- Các thư viện nặng như `exceljs`, `FileSaver`, `docxtemplater`, `pizzip` phải lazy load khi người dùng bấm xuất file.

## Standalone HTML

- Chỉ gọi API bundle tương ứng.
- Không giữ hàm gọi nguồn cũ hoặc fallback nguồn cũ.
- Giữ preview/export hiện tại, chỉ thay nguồn dữ liệu.
- Nếu có cả React page và HTML standalone cho cùng nghiệp vụ, hai bên phải giữ cùng payload, cùng trường hiển thị và cùng cách resolve Ref.

## Kiểm Thử

Sau khi thêm hoặc sửa API bundle:

```bash
node --check scripts/google-sheets-service.cjs
node --check scripts/google-feature-bundles.cjs
node --check scripts/google-api-handler.cjs
node --check scripts/google-sheets-proxy.cjs
npm run check:encoding
npm run build
```

Khi test local:

- Chạy `npm run proxy` để mở proxy Google Sheets tại `localhost:8787`.
- Chạy `npm start` để Vite proxy `/api` sang `localhost:8787`.
- Test endpoint trực tiếp qua `localhost:8787/api/<nghiep-vu>` và qua `localhost:5173/api/<nghiep-vu>`.
- Response phải có `source: "google-sheets"`.
