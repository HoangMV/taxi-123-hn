# TAXI 123_HN

Ứng dụng React cho nghiệp vụ TAXI 123_HN, tập trung vào các chức năng chính:

- Thống kê phù hiệu xe theo đơn vị vận tải.
- Lập và xuất quyết định thu hồi GPKD.
- Kết nối dữ liệu qua AppSheet API bằng `src/services/appSheetService.js`.

## Chạy dự án ở máy local

Lần đầu tải dự án về máy:

```bash
npm install
copy .env.example .env
```

Sau đó mở file `.env` và điền đúng thông tin AppSheet.

Khi chạy dự án ở máy local, cần mở **2 terminal** trong thư mục dự án.

Terminal 1 chạy giao diện React:

```bash
npm start
```

Terminal 2 chạy proxy AppSheet:

```bash
npm run proxy
```

Sau khi cả 2 terminal đều đang chạy, mở trình duyệt tại:

```text
http://127.0.0.1:3000
```

Không tắt terminal chạy `npm run proxy` khi đang dùng app. Nếu proxy không chạy, các màn đọc dữ liệu sẽ báo lỗi dạng `AppSheet 500` hoặc không tải được dữ liệu.

Nếu `localhost:3000` mở nhầm sang app khác trên máy, hãy dùng `http://127.0.0.1:3000`.

## Biến môi trường

```env
REACT_APP_APP_ID=
REACT_APP_ACCESS_KEY=
REACT_APP_API_PROXY_URL=/api/appsheet
REACT_APP_REGION=www
REACT_APP_DEFAULT_TABLE=
```

Ý nghĩa:

- `REACT_APP_APP_ID`: ID ứng dụng AppSheet.
- `REACT_APP_ACCESS_KEY`: khóa gọi AppSheet API. Chỉ backend proxy hoặc Vercel Function đọc biến này từ môi trường server; frontend không được ghi key ra file public.
- `REACT_APP_API_PROXY_URL`: đường dẫn proxy để frontend gọi AppSheet, mặc định là `/api/appsheet`.
- `REACT_APP_REGION`: vùng máy chủ AppSheet, đa số là `www`.
- `REACT_APP_DEFAULT_TABLE`: bảng mặc định dự phòng cho các màn cần đọc bảng cấu hình, có thể để trống.

Khi chạy `npm start` hoặc `npm run build`, script `scripts/generate-runtime-config.cjs` sẽ tạo `public/runtime-config.js`. File này là cấu hình public dùng chung cho app React và các file HTML standalone, gồm `APP_ID`, `REGION`, `DEFAULT_TABLE`, `API_PROXY_URL`.

## Deploy Vercel

Đẩy source lên GitHub, sau đó import repository vào Vercel.

Cấu hình trên Vercel:

- Build Command: `npm run build`
- Output Directory: `build`
- Install Command: `npm install`

Thêm các Environment Variables trong Vercel:

- `REACT_APP_APP_ID`
- `REACT_APP_ACCESS_KEY`
- `REACT_APP_REGION`
- `REACT_APP_DEFAULT_TABLE`
- `REACT_APP_API_PROXY_URL` với giá trị `/api/appsheet`

Vercel sẽ chạy API route `api/appsheet.js` để giữ `REACT_APP_ACCESS_KEY` ở server-side. Không commit file `.env` lên GitHub.

## Cấu trúc chính

```text
api/                 # Vercel Function cho proxy AppSheet
public/              # Static assets và HTML standalone
scripts/             # Script tạo runtime config và proxy local
src/
  components/        # UI cơ bản
  config/            # Cấu hình route, menu, runtime config
  features/          # Logic nghiệp vụ
  layouts/           # MainLayout
  pages/             # Dashboard, thống kê, quyết định
  routes/            # Khai báo route
  services/          # AppSheet service
```

## Ghi chú

- Dự án này không dùng chức năng đăng nhập.
- Các màn nghiệp vụ tái sử dụng `appSheetService` để kết nối AppSheet.
- Chính sách rà soát dependency nằm ở `docs/DEPENDENCY_AUDIT.md`.
