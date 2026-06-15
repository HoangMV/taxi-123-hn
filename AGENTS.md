# Quy ước AI cho dự án TAXI 123_HN

## Ngôn ngữ và mã hóa

- Mọi nội dung hiển thị cho người dùng phải viết bằng tiếng Việt có dấu đầy đủ.
- Mọi comment, README, hướng dẫn cấu hình và tài liệu dự án phải ưu tiên tiếng Việt rõ nghĩa.
- Không được viết chuỗi tiếng Việt không dấu trong code mới, trừ tên biến kỹ thuật hoặc khóa dữ liệu lấy từ AppSheet.
- Tất cả file văn bản phải lưu bằng mã hóa UTF-8.
- Không tạo hoặc giữ lại chuỗi bị lỗi mã hóa kiểu UTF-8 bị đọc sai, ký tự thay thế Unicode, hoặc tiếng Việt bị thay bằng dấu `?`.
- Không ghi file tiếng Việt bằng lệnh PowerShell inline/here-string nếu có nguy cơ làm mất dấu. Khi cần sửa nội dung tiếng Việt, ưu tiên `apply_patch` hoặc script `.cjs` đã lưu UTF-8 trong repo.
- Sau khi sửa file có tiếng Việt, phải chạy `npm run check:encoding`. Nếu lệnh báo lỗi, phải sửa sạch trước khi kết thúc.

## Cấu hình môi trường

- Chỉ giữ các biến `.env` thực sự đang dùng trong mã nguồn.
- Mỗi biến trong `.env.example` phải có comment mô tả tác dụng.
- Nếu thêm biến mới, phải cập nhật giải thích trong `README.md`.

## Quy tắc AppSheet và dữ liệu Ref

- Trước khi làm chức năng mới có đọc AppSheet, phải đọc `docs/appsheet-schema.md` để biết cột hiện có.
- Trước khi hiển thị dữ liệu có mã Ref, phải đọc `docs/appsheet-relationships.md` để biết bảng nào liên kết với bảng nào.
- Cột bắt đầu bằng `Ref_` hoặc cột nghiệp vụ lưu ID bảng khác là dữ liệu kết nối xuôi, không được mặc định hiển thị thẳng cho người dùng.
- Cột bắt đầu bằng `Related ` là kết nối ngược do AppSheet tự sinh, dùng để hiểu quan hệ bảng. Không coi đây là dữ liệu nhập chính.
- Khi render giao diện, chứng từ, Word, PDF hoặc HTML, nếu dữ liệu đang là mã Ref như `V3B3GM6D` thì phải gọi bảng được tham chiếu và lấy thông tin thật như `HoTen`, `Display`, `Ten...`, `CCCD`, `SoGPLX` theo nghiệp vụ.
- Với nghiệp vụ bàn giao xe: `XE_BANGIAO.DaiDienBenGiao1`, `XE_BANGIAO.DaiDienBenGiao2`, `XE_BANGIAO.Ref_LaiXe` liên kết tới `NHANSU.ID_NhanSu`; khi hiển thị phải lấy tên từ `NHANSU.HoTen` hoặc dự phòng `NHANSU.Display`.
- Nếu React cần gọi AppSheet trực tiếp thì tái sử dụng `src/services/appSheetService.js`; với nghiệp vụ đọc nhiều bảng hoặc cần resolve Ref phức tạp, ưu tiên API bundle theo `docs/appsheet-feature-standard.md`.

## Quy tắc định dạng ngày

- Khi hiển thị hoặc xuất ngày trong nghiệp vụ, ngày luôn có đủ 2 chữ số: `01`, `02`, `03`, ..., `31`.
- Tháng `1` và `2` phải có số `0` phía trước: `01`, `02`.
- Tháng `3` đến `12` không có số `0` phía trước: `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`, `12`.
- Năm luôn hiển thị đủ 4 chữ số.
- Khi viết chức năng mới có ngày tháng, phải tái sử dụng helper định dạng ngày hiện có hoặc tạo helper dùng chung theo đúng quy tắc trên, không format rời rạc trong từng component.

## Kiến trúc

- Giữ dự án ở mức khung sườn, tránh thêm logic thừa chưa dùng.
- Ưu tiên sửa ở tầng gom dữ liệu hoặc feature helper trước khi sửa nhiều component render.
- Nếu thêm bảng AppSheet mới vào `.env`, chạy `npm run schema:appsheet -- --output=docs/appsheet-schema.md` để cập nhật schema.
- Nếu phát hiện thêm quan hệ Ref quan trọng, cập nhật `docs/appsheet-relationships.md` để AI lần sau hiểu ngay.

## Quy chuẩn trang nghiệp vụ AppSheet

- Trước khi tạo hoặc sửa trang nghiệp vụ có đọc nhiều bảng AppSheet, phải đọc `docs/appsheet-feature-standard.md` cùng với `docs/appsheet-schema.md` và `docs/appsheet-relationships.md`.
- Với nghiệp vụ mới cần hồ sơ chính, chi tiết và dữ liệu Ref, ưu tiên tạo API bundle trong `api/` và route local tương ứng trong `scripts/appsheet-proxy.cjs`; React page và HTML standalone chỉ gọi API bundle thay vì gọi nhiều bảng AppSheet rời rạc từ trình duyệt.
- Nếu trang cần hiển thị nhanh, dùng luồng tải hai pha: tải hồ sơ chính với `includeRelated=0`, render preview ngay, sau đó tải dữ liệu liên kết và cập nhật preview.
- Trong backend bundle, các bảng không phụ thuộc nhau phải chạy song song bằng `Promise.all`; tránh `await` tuần tự làm cộng dồn thời gian AppSheet.
- API bundle nên có cache memory ngắn cho các selector AppSheet hay gọi lại, mặc định khoảng 5 phút nếu nghiệp vụ không yêu cầu dữ liệu tức thời tuyệt đối.
- Các thư viện xuất file nặng như `exceljs`, `FileSaver`, `docxtemplater`, `pizzip` phải lazy load khi người dùng bấm xuất file, không tải ngay khi mở trang.
- Mọi fetch tới API bundle phải đọc JSON an toàn để phát hiện trường hợp server trả HTML thay vì JSON, và báo lỗi tiếng Việt dễ hiểu như cần chạy `npm run proxy` khi test local.
- Sau khi thêm API bundle mới, phải kiểm tra cả endpoint production trong `api/` và route local proxy trong `scripts/appsheet-proxy.cjs`.
