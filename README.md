# TAXI 123_HN

Ứng dụng React cho các nghiệp vụ TAXI 123_HN, gồm trang React và các file HTML standalone để xem trước, in và xuất Word/Excel.

Nguồn đọc dữ liệu hiện tại là Google Sheets API ở backend. App không gọi Google Sheets API trực tiếp nữa.

## Chạy Local

Lần đầu tải dự án:

```bash
npm install
copy .env.example .env
```

Sau đó mở `.env` và điền thông tin Google Sheets service account.

Khi chạy local, mở 2 terminal trong thư mục dự án.

Terminal 1 chạy giao diện React:

```bash
npm start
```

Terminal 2 chạy API/static proxy local:

```bash
npm run proxy
```

Mặc định proxy chạy tại:

```text
http://localhost:8787
```

Nếu trang React hoặc HTML standalone báo API trả HTML thay vì JSON, hãy kiểm tra terminal `npm run proxy` đang chạy.

## Biến Môi Trường

```env
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_SHEETS_DEFAULT_RANGE=A:ZZ
GOOGLE_SHEETS_TABLE_MAP={}
GOOGLE_SHEETS_RANGE_MAP={}
REACT_APP_DEFAULT_TABLE=
REACT_APP_API_BASE_URL=/api
```

Ý nghĩa:

- `GOOGLE_SHEETS_SPREADSHEET_ID`: ID Google Spreadsheet chứa dữ liệu nghiệp vụ.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: email service account đã được share quyền xem Google Sheet.
- `GOOGLE_PRIVATE_KEY`: private key service account, chỉ để ở backend/server env.
- `GOOGLE_SHEETS_DEFAULT_RANGE`: range mặc định khi đọc tab, mặc định `A:ZZ` để tránh thiếu cột.
- `GOOGLE_SHEETS_TABLE_MAP`: JSON map tên bảng trong code sang tên tab nếu tab Google Sheet khác tên bảng.
- `GOOGLE_SHEETS_RANGE_MAP`: JSON map range riêng cho từng bảng để tối ưu tốc độ.
- `REACT_APP_DEFAULT_TABLE`: bảng public dự phòng, có thể để trống.
- `REACT_APP_API_BASE_URL`: đường dẫn API backend public, mặc định `/api`.

## Kiến Trúc Dữ Liệu

- `scripts/google-sheets-service.cjs`: service đọc Google Sheets bằng service account, có cache OAuth token nhưng không cache dữ liệu bảng.
- `scripts/google-feature-bundles.cjs`: gom dữ liệu nghiệp vụ từ nhiều tab bằng Google Sheets API.
- `scripts/google-api-handler.cjs`: factory tạo API route Google Sheets-only.
- `scripts/google-sheets-proxy.cjs`: proxy local cho Google Sheets API và static server.
- `api/*.js`: endpoint nghiệp vụ cho Vercel/backend.

`docs/google-sheets-schema.md` ghi lại tên bảng/cột đang đọc từ Google Sheets; `docs/google-sheets-relationships.md` ghi lại quan hệ Ref lịch sử cần dùng khi hiển thị dữ liệu. Không coi các cột `Related ...` là dữ liệu chính.

## Deploy Vercel

Thiết lập:

- Build Command: `npm run build`
- Output Directory: `build`
- Install Command: `npm install`

Thêm các biến môi trường Google Sheets ở trên vào Vercel. Không commit `.env` hoặc private key lên GitHub.

## Ghi Chú

- Dự án không dùng chức năng đăng nhập.
- Template Word/Excel trong `public` vẫn được giữ vì các trang xuất file đang dùng.
- Sau khi sửa nội dung tiếng Việt, chạy `npm run check:encoding` trước khi kết thúc.
