# Quy chuẩn làm trang nghiệp vụ AppSheet

Tài liệu này là quy chuẩn chung khi tạo hoặc sửa các trang nghiệp vụ có đọc dữ liệu AppSheet. Mục tiêu là để React page, HTML standalone và các chức năng xuất file chạy đồng bộ, tải nhanh và không hiển thị mã Ref cho người dùng.

## Khi bắt đầu chức năng mới

1. Đọc `docs/appsheet-schema.md` để biết bảng và cột hiện có.
2. Đọc `docs/appsheet-relationships.md` để biết quan hệ Ref cần resolve.
3. Xác định bảng chính, bảng chi tiết, bảng danh mục/Ref và khóa lọc chính từ URL.
4. Nếu phát hiện quan hệ Ref mới, cập nhật `docs/appsheet-relationships.md` ngay trong lượt làm đó.

## Kiến trúc chuẩn

Với nghiệp vụ cần đọc nhiều bảng AppSheet, không để trình duyệt gọi nhiều bảng rời rạc. Phải ưu tiên tạo API bundle riêng trong `api/` và route tương ứng trong `scripts/appsheet-proxy.cjs`.

Mẫu cấu trúc:

```text
api/<nghiep-vu>.js
src/features/<nghiepVu>.js
src/pages/<NghiepVu>Page.jsx
public/<nghiep_vu>_standalone.html
```

API bundle chịu trách nhiệm:

- Nhận ID hồ sơ từ query/body.
- Tải hồ sơ chính.
- Tải bảng chi tiết.
- Resolve các bảng Ref như `NHANSU`, `DONVI`, `XE`, `DM_CHUCDANH`.
- Trả JSON đã gom để frontend dùng chung.
- Có cache ngắn cho các lệnh `Find` AppSheet.

React page và HTML standalone chỉ nên gọi API bundle, sau đó build payload sạch để render. Không đưa logic gọi từng bảng AppSheet vào component nếu nghiệp vụ đã có API bundle.

## Luồng tải hai pha

Với trang cần hiển thị nhanh, dùng luồng hai pha:

1. Gọi API với `includeRelated=0` để lấy hồ sơ chính.
2. Render preview ngay khi có hồ sơ chính, không để màn hình trắng.
3. Gọi API bundle lần hai để lấy dữ liệu liên kết và danh sách chi tiết.
4. Cập nhật lại preview khi dữ liệu đầy đủ.

Mẫu:

```js
const row = await fetchBundleRow(id);
setPayload(buildPayload(row));

setLoadingRelated(true);
const related = await fetchBundleRelated(row);
setPayload(buildPayload(row, related));
setLoadingRelated(false);
```

## Tối ưu backend

Không `await` tuần tự các bảng độc lập. Bảng nào không phụ thuộc nhau phải chạy song song bằng `Promise.all`.

Ví dụ chuẩn:

```js
const chiTietPromise = findAppSheetRows({
  tableName: 'CT_HS_DAOTAO',
  selector: buildEqualsSelector('CT_HS_DAOTAO', 'Ref_HoSoDaoTao', row.ID_HoSoDaoTao)
});
const donViPromise = findRowsByIds('DONVI', 'ID_DonVi', [row.Ref_DonViDeNghi]);

const chiTietRows = await chiTietPromise;
const nhanSuPromise = findRowsByIds(
  'NHANSU',
  'ID_NhanSu',
  chiTietRows.map((item) => item.Ref_NhanSu)
);

const [donViRows, nhanSuRows] = await Promise.all([donViPromise, nhanSuPromise]);
```

API bundle nên có cache memory khoảng 5 phút cho các selector AppSheet:

```js
const findCache = new Map();
const findCacheTtlMs = 5 * 60 * 1000;
```

## Resolve Ref

Không hiển thị trực tiếp cột `Ref_...`, ID bảng khác hoặc mã khóa như `V3B3GM6D` cho người dùng.

Ví dụ:

- `Ref_NhanSu` phải resolve sang `NHANSU.HoTen`, `Display`, `CCCD`, `NgaySinh`, `NgayCapCCCD`, `Dia_Chi_Day_Du` theo nghiệp vụ.
- `Ref_DonVi` hoặc `Ref_DonViDeNghi` phải resolve sang `DONVI.TenDonVi`, dự phòng `Display`.
- Nếu chưa resolve được, để trống trường người dùng đọc hoặc hiển thị cảnh báo riêng; không đưa mã Ref vào chứng từ, bảng preview, Word, PDF, HTML hoặc Excel.

## Xuất file

Không tải thư viện nặng ngay khi mở trang nếu thư viện chỉ dùng để xuất file.

Các thư viện như `exceljs`, `FileSaver`, `docxtemplater`, `pizzip` phải lazy load khi người dùng bấm nút xuất file.

Với HTML standalone:

```js
async function ensureExportLibraries() {
  if (!exportLibrariesPromise) {
    exportLibrariesPromise = Promise.all([
      loadScriptOnce(EXCELJS_URL),
      loadScriptOnce(FILE_SAVER_URL)
    ]);
  }

  await exportLibrariesPromise;
}
```

Với React, dùng `import()` động:

```js
const [ExcelJS, fileSaver] = await Promise.all([
  import('exceljs'),
  import('file-saver')
]);
```

## Đọc JSON an toàn

Mọi API bundle phải được đọc bằng helper chống trường hợp server trả HTML thay vì JSON. Trường hợp này thường xảy ra khi local chưa chạy proxy hoặc Vite trả fallback `index.html`.

Mẫu:

```js
async function readJsonResponse(response, fallbackMessage) {
  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      const preview = text.trim().slice(0, 40).toLowerCase();
      if (preview.startsWith('<!doctype') || preview.startsWith('<html') || preview.startsWith('<')) {
        throw new Error('API trả về HTML thay vì JSON. Khi chạy local, hãy chạy thêm npm run proxy cùng với npm start, rồi tải lại trang.');
      }
      throw new Error(fallbackMessage || 'Không đọc được phản hồi JSON từ API.');
    }
  }

  if (!response.ok) {
    throw new Error(data.error || fallbackMessage || `Yêu cầu thất bại (${response.status}).`);
  }

  return data;
}
```

## Local proxy

Khi thêm endpoint mới trong `api/`, phải thêm route tương ứng trong `scripts/appsheet-proxy.cjs` để local hoạt động qua Vite proxy.

Khi kiểm thử local cần chạy hai terminal:

```powershell
npm run proxy
```

```powershell
npm start
```

## Kiểm thử bắt buộc

Sau khi sửa hoặc thêm trang nghiệp vụ AppSheet, chạy tối thiểu:

```powershell
node --check api/<nghiep-vu>.js
node --check scripts/appsheet-proxy.cjs
npm run check:encoding
npm run build
```

Nếu có HTML standalone, kiểm thử thêm:

- Mở URL không có ID và có ID.
- Kiểm tra preview hiện sau khi hồ sơ chính tải xong.
- Kiểm tra dữ liệu liên kết cập nhật sau đó.
- Kiểm tra nút xuất file chỉ tải thư viện khi bấm.
- Kiểm tra không có mã Ref xuất hiện trong nội dung người dùng đọc.

