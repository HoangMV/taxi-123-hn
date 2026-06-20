# Quy ước AI cho dự án TAXI 123_HN

## Ngôn Ngữ Và Mã Hóa

- Mọi nội dung hiển thị cho người dùng phải viết bằng tiếng Việt có dấu đầy đủ.
- Mọi comment, README, hướng dẫn cấu hình và tài liệu dự án phải ưu tiên tiếng Việt rõ nghĩa.
- Không được viết chuỗi tiếng Việt không dấu trong code mới, trừ tên biến kỹ thuật hoặc khóa dữ liệu lấy từ Google Sheets/schema nghiệp vụ.
- Tất cả file văn bản phải lưu bằng mã hóa UTF-8.
- Không tạo hoặc giữ lại chuỗi bị lỗi mã hóa kiểu UTF-8 bị đọc sai, ký tự thay thế Unicode, hoặc tiếng Việt bị thay bằng dấu `?`.
- Không ghi file tiếng Việt bằng lệnh PowerShell inline/here-string nếu có nguy cơ làm mất dấu. Khi cần sửa nội dung tiếng Việt, ưu tiên `apply_patch` hoặc script `.cjs` đã lưu UTF-8 trong repo.
- Sau khi sửa file có tiếng Việt, phải chạy `npm run check:encoding`. Nếu lệnh báo lỗi, phải sửa sạch trước khi kết thúc.

## Cấu Hình Môi Trường

- Chỉ giữ các biến `.env` thực sự đang dùng trong mã nguồn.
- Mỗi biến trong `.env.example` phải có comment mô tả tác dụng.
- Nếu thêm biến mới, phải cập nhật giải thích trong `README.md`.
- Không đọc hoặc in nội dung `.env` khi không cần thiết vì file có thể chứa private key service account.

## Quy Tắc Google Sheets Và Dữ Liệu Ref

- Nguồn đọc dữ liệu hiện tại là Google Sheets API qua backend service account.
- React page và HTML standalone không gọi Google Sheets trực tiếp từ trình duyệt; chỉ gọi endpoint `/api/<nghiep-vu>`.
- Trước khi làm chức năng mới có đọc dữ liệu nghiệp vụ, đọc `docs/google-sheets-schema.md` để biết tên bảng/cột hiện có. Tài liệu này ghi lại tên bảng/cột đang đọc từ Google Sheets.
- Trước khi hiển thị dữ liệu có mã Ref, đọc `docs/google-sheets-relationships.md` để biết bảng nào liên kết với bảng nào.
- Cột bắt đầu bằng `Ref_` hoặc cột nghiệp vụ lưu ID bảng khác là dữ liệu kết nối xuôi, không được mặc định hiển thị thẳng cho người dùng.
- Cột bắt đầu bằng `Related ` là kết nối ngược do hệ thống cũ sinh ra; chỉ dùng để hiểu quan hệ bảng, không coi đây là dữ liệu nhập chính.
- Khi render giao diện, chứng từ, Word, PDF hoặc HTML, nếu dữ liệu đang là mã Ref như `V3B3GM6D` thì phải gọi bảng được tham chiếu và lấy thông tin thật như `HoTen`, `Display`, `Ten...`, `CCCD`, `SoGPLX` theo nghiệp vụ.
- Với nghiệp vụ bàn giao xe: `XE_BANGIAO.DaiDienBenGiao1`, `XE_BANGIAO.DaiDienBenGiao2`, `XE_BANGIAO.Ref_LaiXe` liên kết tới `NHANSU.ID_NhanSu`; khi hiển thị phải lấy tên từ `NHANSU.HoTen` hoặc dự phòng `NHANSU.Display`.

## Quy Tắc Định Dạng Ngày

- Khi hiển thị hoặc xuất ngày trong nghiệp vụ, ngày luôn có đủ 2 chữ số: `01`, `02`, `03`, ..., `31`.
- Tháng `1` và `2` phải có số `0` phía trước: `01`, `02`.
- Tháng `3` đến `12` không có số `0` phía trước: `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`, `12`.
- Năm luôn hiển thị đủ 4 chữ số.
- Khi viết chức năng mới có ngày tháng, phải tái sử dụng helper định dạng ngày hiện có hoặc tạo helper dùng chung theo đúng quy tắc trên, không format rời rạc trong từng component.

## Kiến Trúc

- Giữ dự án ở mức khung sườn, tránh thêm logic thừa chưa dùng.
- Ưu tiên sửa ở tầng gom dữ liệu hoặc feature helper trước khi sửa nhiều component render.
- Dùng `scripts/google-sheets-service.cjs` cho logic đọc Google Sheets chung.
- Dùng `scripts/google-feature-bundles.cjs` để gom dữ liệu nghiệp vụ từ nhiều tab.
- Dùng `scripts/google-api-handler.cjs` để tạo API route backend.
- Dùng `scripts/google-sheets-proxy.cjs` khi test local bằng `npm run proxy`.
- Nếu phát hiện thêm quan hệ Ref quan trọng, cập nhật `docs/google-sheets-relationships.md` để AI lần sau hiểu ngay.
- Khi thêm bảng mới vào `REACT_APP_SCHEMA_TABLES`, phải chạy `npm run schema:google-sheets`, đọc cột mới, xác định Ref trỏ tới bảng nào và ghi mapping vào `docs/google-sheets-relationships.md` trước khi render/export dữ liệu Ref.

## Quy Chuẩn Trang Nghiệp Vụ Google Sheets

- Trước khi tạo hoặc sửa trang nghiệp vụ có đọc nhiều bảng, phải đọc `docs/google-sheets-feature-standard.md`, `docs/google-sheets-schema.md` và `docs/google-sheets-relationships.md`.
- Với nghiệp vụ mới cần hồ sơ chính, chi tiết và dữ liệu Ref, tạo API bundle trong `api/` và route local tương ứng trong `scripts/google-sheets-proxy.cjs`; React page và HTML standalone chỉ gọi API bundle.
- Không fallback sang API nguồn cũ.
- Không cache dữ liệu bảng Google Sheets; chỉ cache OAuth token Google ở backend service.
- Nếu trang cần hiển thị nhanh, dùng luồng tải hai pha: tải hồ sơ chính với `includeRelated=0`, render preview ngay, sau đó tải dữ liệu liên kết và cập nhật preview.
- Trong backend bundle, các bảng không phụ thuộc nhau phải chạy song song bằng `Promise.all`; tránh `await` tuần tự làm cộng dồn thời gian.
- Các thư viện xuất file nặng như `exceljs`, `FileSaver`, `docxtemplater`, `pizzip` phải lazy load khi người dùng bấm xuất file, không tải ngay khi mở trang.
- Mọi fetch tới API bundle phải đọc JSON an toàn để phát hiện trường hợp server trả HTML thay vì JSON, và báo lỗi tiếng Việt dễ hiểu như cần chạy `npm run proxy` khi test local.
- Sau khi thêm API bundle mới, phải kiểm tra cả endpoint production trong `api/` và route local proxy trong `scripts/google-sheets-proxy.cjs`.
