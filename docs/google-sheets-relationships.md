# Quan hệ bảng dữ liệu

Tài liệu này là nguồn chính để AI hiểu cột Ref nào trỏ tới bảng nào trong các nghiệp vụ Google Sheets. `docs/google-sheets-schema.md` chỉ liệt kê tên cột và kiểu dữ liệu suy luận, không chứa metadata Ref đầy đủ như AppSheet Editor. Khi một cột lưu mã khóa như `V3B3GM6D`, không hiển thị trực tiếp mã đó nếu người dùng cần tên thật; hãy gọi bảng được tham chiếu và lấy cột hiển thị phù hợp như `HoTen`, `Display`, `Ten...` hoặc cột nghiệp vụ tương ứng.

## Quy tắc đọc Ref

- Cột bắt đầu bằng `Ref_` hoặc cột nghiệp vụ đang chứa ID bảng khác là cột kết nối xuôi.
- Cột bắt đầu bằng `Related ` là cột kết nối ngược từ schema lịch sử của AppSheet, cho biết bảng hiện tại đang được bảng nào tham chiếu. Các cột này không còn là nguồn dữ liệu chính khi đọc Google Sheets, nhưng vẫn là manh mối để ghi lại quan hệ trong tài liệu này.
- Khi render chứng từ, email, Word hoặc giao diện người dùng, phải resolve mã Ref sang dữ liệu thật trước khi hiển thị.
- React và HTML standalone chỉ gọi API bundle `/api/<nghiep-vu>`; backend đọc Google Sheets và resolve Ref.
- Không đoán tên từ mã Ref. Nếu chưa có dữ liệu hiển thị trong bảng chính, phải gọi bảng Ref.

## Khi Phát Hiện Quan Hệ Mới

Khi thêm bảng hoặc nghiệp vụ mới, không đủ để chỉ cập nhật `docs/google-sheets-schema.md`. Phải bổ sung quan hệ Ref vào tài liệu này để AI lần sau biết mã nào cần resolve sang bảng nào.

Mẫu ghi quan hệ mới:

| Bảng nguồn | Cột lưu mã Ref | Bảng đích cần đọc | Khóa bảng đích | Cột nên hiển thị | Mức chắc chắn |
| --- | --- | --- | --- | --- | --- |
| `TEN_BANG_NGUON` | `Ref_TruongDuLieu` | `TEN_BANG_DICH` | `ID_BangDich` | `Ten...`, `Display` | Đã xác minh / Cần kiểm tra thêm |

Nếu chỉ thấy tên cột `Ref_...` nhưng chưa biết bảng đích, phải ghi là `Cần kiểm tra thêm` và kiểm tra dữ liệu mẫu hoặc cấu hình AppSheet cũ trước khi dùng để hiển thị chứng từ.

## Nghiệp vụ bàn giao xe

| Bảng chính | Cột lưu mã Ref | Bảng cần gọi thêm | Khóa bảng Ref | Cột nên hiển thị |
| --- | --- | --- | --- | --- |
| `XE_BANGIAO` | `DaiDienBenGiao1` | `NHANSU` | `ID_NhanSu` | `HoTen`, dự phòng `Display` |
| `XE_BANGIAO` | `DaiDienBenGiao2` | `NHANSU` | `ID_NhanSu` | `HoTen`, dự phòng `Display` |
| `XE_BANGIAO` | `Ref_LaiXe` | `NHANSU` | `ID_NhanSu` | `HoTen`, `CCCD`, `SoGPLX`, `HanGPLX` |

Ví dụ: nếu `XE_BANGIAO.DaiDienBenGiao1 = V3B3GM6D`, phải gọi `NHANSU` với điều kiện `[ID_NhanSu] = "V3B3GM6D"` rồi hiển thị `NHANSU.HoTen`, không hiển thị mã `V3B3GM6D` trong biên bản.

Một số dòng `XE_BANGIAO` hiện có snapshot lái xe bị lệch sau cột `Ref_LaiXe`: `Ref_LaiXe` có thể là số thứ tự nội bộ, còn `HoTenLaiXe` mới là `NHANSU.ID_NhanSu`; các trường hiển thị tiếp theo lần lượt có thể nằm ở `SoCCCD` (họ tên), `TrangThaiQuanLyXe` (CCCD), `TrangThaiBienBan` (số GPLX), `FileBienBan` (hạn GPLX). Khi gặp dạng này, phải ưu tiên resolve `HoTenLaiXe` sang `NHANSU.ID_NhanSu`, không in trực tiếp mã hoặc dữ liệu snapshot bị lệch.

## Quan hệ đã phát hiện

| Bảng đang được tham chiếu | Khóa chính dự đoán | Bảng liên kết tới bảng này | Cột Related trong bảng hiện tại | Cột Ref có khả năng dùng ở bảng liên kết |
| --- | --- | --- | --- | --- |
| `NHANSU` | `ID_NhanSu` | `XE_BANGIAO` | `Related XE_BANGIAOs` | `Ref_LaiXe`, `DaiDienBenGiao1`, `DaiDienBenGiao2` |
| `NHANSU` | `ID_NhanSu` | `XE_BANGIAO` | `Related XE_BANGIAOs By DaiDienBenGiao1` | `DaiDienBenGiao1` |
| `NHANSU` | `ID_NhanSu` | `XE_BANGIAO` | `Related XE_BANGIAOs By DaiDienBenGiao2` | `DaiDienBenGiao2` |
| `XE_BANGIAO` | `ID_BienBanXe` | `XE_BANGIAO_HINHANH` | `Related XE_BANGIAO_HINHANHs` | Cần kiểm tra thêm trong schema lịch sử |
| `NHANSU` | `ID_NhanSu` | `NHANSU_BHXH` | `Related NHANSU_BHXHs` | `Ref_NhanSu` |
| `DM_CHUCDANH` | `ID_ChucDanh` | `NHANSU` | `Related NHANSUs` | `Ref_ChucDanh` |
| `NHANSU` | `ID_NhanSu` | `NHANSU_NGUOITHAN` | `Related NHANSU_NGUOITHANs` | Cần kiểm tra thêm trong schema lịch sử |
| `NHANSU` | `ID_NhanSu` | `NHANSU_HOSO_CANHAN` | `Related NHANSU_HOSO_CANHANs` | Cần kiểm tra thêm trong schema lịch sử |
| `NHANSU` | `ID_NhanSu` | `NHANSU_QUATRINH_CONGTAC` | `Related NHANSU_QUATRINH_CONGTACs` | Cần kiểm tra thêm trong schema lịch sử |
| `NHANSU` | `ID_NhanSu` | `NHANSU_SUCKHOE` | `Related NHANSU_SUCKHOEs` | Cần kiểm tra thêm trong schema lịch sử |
| `NHANSU` | `ID_NhanSu` | `NHANSU_HOPDONG_LAODONG` | `Related NHANSU_HOPDONG_LAODONGs` | `Ref_NhanSu`, `Ref_NguoiKy` |
| `DONVI` | `ID_DonVi` | `NHANSU_HOPDONG_LAODONG` | `Related NHANSU_HOPDONG_LAODONGs` | `Ref_DonViLamViec` |
| `DM_BOPHAN` | `ID_BoPhan` | `NHANSU_HOPDONG_LAODONG` | Cần kiểm tra thêm trong schema lịch sử | `Ref_BoPhan`; thực tế có dòng đang lưu mã chức danh nên cần thử thêm `DM_CHUCDANH.ID_ChucDanh` |
| `DM_CHUCDANH` | `ID_ChucDanh` | `NHANSU_HOPDONG_LAODONG` | `Related NHANSU_HOPDONG_LAODONGs` | `Ref_BoPhan` khi giá trị thực tế là mã chức danh; ưu tiên `NHANSU.Ref_ChucDanh` cho chức danh nhân sự |
| `DM_MUCLUONG_DONGBHXH` | `ID_MucLuong` | `NHANSU_HOPDONG_LAODONG` | Cần kiểm tra thêm trong schema lịch sử | `MucLuongCoBan` |
| `NHANSU` | `ID_NhanSu` | `LAIXE_DAOTAO` | `Related LAIXE_DAOTAOs` | `Ref_NhanSu` |
| `NHANSU` | `ID_NhanSu` | `LAIXE_TAINAN` | `Related LAIXE_TAINANs` | Cần kiểm tra thêm trong schema lịch sử |
| `NHANSU` | `ID_NhanSu` | `NHANSU_BHXH_BANGIAO_SO` | `Related NHANSU_BHXH_BANGIAO_SOs By NguoiGiao` | `NguoiGiao` |
| `NHANSU` | `ID_NhanSu` | `NHANSU_BHXH_BANGIAO_SO` | `Related NHANSU_BHXH_BANGIAO_SOs By NguoiNhan` | `NguoiNhan` |
| `NHANSU` | `ID_NhanSu` | `DM_DOIXE` | `Related DM_DOIXEs` | Cần kiểm tra thêm trong schema lịch sử |
| `NHANSU` | `ID_NhanSu` | `NHANSU_KYQUY` | `Related NHANSU_KYQUYs` | `Ref_NhanSu` |
| `DONVI` | `ID_DonVi` | `NHANSU_KYQUY` | Cần kiểm tra thêm trong schema lịch sử | `Ref_DonViQuanLyHienTai`, dự phòng `Ref_DonVi` |
| `NHANSU` | `ID_NhanSu` | `NHANSU_KYQUY_GIAODICH` | `Related NHANSU_KYQUY_GIAODICHs` | `Ref_NhanSu`, `Ref_KyQuy` |
| `NHANSU` | `ID_NhanSu` | `NHANSU_KYQUY_GIAODICH` | `Related NHANSU_KYQUY_GIAODICHs By Ref_NhanSu` | `Ref_NhanSu` |
| `NHANSU` | `ID_NhanSu` | `LAIXE_KHENTHUONG_KYLUAT` | `Related LAIXE_KHENTHUONG_KYLUATs` | `Ref_NhanSu` |
| `NHANSU` | `ID_NhanSu` | `LAIXE_VIPHAM_ATGT` | `Related LAIXE_VIPHAM_ATGTs` | Cần kiểm tra thêm trong schema lịch sử |
| `NHANSU` | `ID_NhanSu` | `LAIXE_PHANCONG_XE` | `Related LAIXE_PHANCONG_XEs` | `Ref_NhanSu`, `Ref_Xe` |
| `NHANSU` | `ID_NhanSu` | `NHANSU_CHAMDUT_HOPDONG` | `Related NHANSU_CHAMDUT_HOPDONGs` | Cần kiểm tra thêm trong schema lịch sử |
| `NHANSU` | `ID_NhanSu` | `LAIXE_GPLX` | `Related LAIXE_GPLXs` | `Ref_NhanSu` |
| `NHANSU` | `ID_NhanSu` | `KIEMTRA_XE_TAXI` | `Related KIEMTRA_XE_TAXIs By Ref_LaiXe` | `Ref_LaiXe` |
| `NHANSU` | `ID_NhanSu` | `KIEMTRA_XE_TAXI` | `Related KIEMTRA_XE_TAXIs By NguoiChot` | `NguoiChot` |
| `NHANSU` | `ID_NhanSu` | `KIEMTRA_XE_TAXI` | `Related KIEMTRA_XE_TAXIs By CanBoKT` | `CanBoKT` |
| `NHANSU` | `ID_NhanSu` | `PHAN_ANH_KHIEU_NAI` | `Related PHAN_ANH_KHIEU_NAIs` | `Ref_NhanSuBiPhanAnh` |
| `NHANSU` | `ID_NhanSu` | `PHAN_ANH_KHIEU_NAI` | `Related PHAN_ANH_KHIEU_NAIs By Ref_CanBoXuLy` | `Ref_CanBoXuLy` |
| `NHANSU` | `ID_NhanSu` | `NHANSU_THANHLY_HOPDONG` | `Related NHANSU_THANHLY_HOPDONGs` | `Ref_NhanSu` |
| `NHANSU_BHXH` | `ID_BHXH` | `NHANSU_BHXH_BANGIAO_SO` | `Related NHANSU_BHXH_BANGIAO_SOs` | `Ref_BHXH` |
| `NHANSU_HOPDONG_LAODONG` | `ID_HopDongLaoDong` | `NHANSU_CHAMDUT_HOPDONG` | `Related NHANSU_CHAMDUT_HOPDONGs` | Cần kiểm tra thêm trong schema lịch sử |
| `NHANSU_HOPDONG_LAODONG` | `ID_HopDongLaoDong` | `NHANSU_THANHLY_HOPDONG` | `Related NHANSU_THANHLY_HOPDONGs` | `Ref_HopDongLD` |
| `NHANSU_KYQUY` | `ID_KyQuy` | `NHANSU_KYQUY_GIAODICH` | `Related NHANSU_KYQUY_GIAODICHs` | `Ref_KyQuy` |
| `NHANSU_KYQUY` | `ID_KyQuy` | `NHANSU_KYQUY_MUC` | `Related NHANSU_KYQUY_MUCs` | Cần kiểm tra thêm trong schema lịch sử |
| `NHANSU_KYQUY` | `ID_KyQuy` | `NHANSU_KYQUY_THANHLY` | `Related NHANSU_KYQUY_THANHLYs` | `Ref_KyQuy` |
| `KIEMTRA_XE_TAXI` | `ID_KiemTra` | `KIEMTRA_XE_TAXI_CHITIET` | `Related KIEMTRA_XE_TAXI_CHITIETs` | `Ref_KiemTra` |
| `DONVI` | `ID_DonVi` | `XE_THONGBAO_NGUNG` | `Related XE_THONGBAO_NGUNGs` | `Ref_DonVi` |
| `XE_THONGBAO_NGUNG` | `ID_ThongBaoNgung` | `XE_THONGBAO_NGUNG_CHITIET` | `Related XE_THONGBAO_NGUNG_CHITIETs` | `Ref_ThongBaoNgung` |
| `XE` | `ID_Xe` | `XE_THONGBAO_NGUNG_CHITIET` | `Related XE_THONGBAO_NGUNG_CHITIETs` | `Ref_Xe` |
| `XE_PHUHIEU` | `ID_PhuHieu` | `XE_THONGBAO_NGUNG_CHITIET` | `Related XE_THONGBAO_NGUNG_CHITIETs` | `Ref_PhuHieu` |

## Bảng đã đọc thêm từ quan hệ

| Bảng | Ghi chú |
| --- | --- |
| `XE_BANGIAO` | Bảng chính nghiệp vụ bàn giao xe |
| `NHANSU` | Bảng nhân sự, dùng để resolve tên người từ mã Ref |
| `XE_BANGIAO_HINHANH` | Bảng con hình ảnh bàn giao xe |
| `NHANSU_BHXH` | Bảng con bảo hiểm xã hội của nhân sự |
| `NHANSU_NGUOITHAN` | Bảng con người thân |
| `NHANSU_HOSO_CANHAN` | Bảng con hồ sơ cá nhân |
| `NHANSU_QUATRINH_CONGTAC` | Bảng con quá trình công tác |
| `NHANSU_SUCKHOE` | Bảng con sức khỏe |
| `NHANSU_HOPDONG_LAODONG` | Bảng con hợp đồng lao động |
| `LAIXE_DAOTAO` | Bảng con đào tạo lái xe |
| `LAIXE_TAINAN` | Bảng con tai nạn lái xe |
| `NHANSU_BHXH_BANGIAO_SO` | Bảng con bàn giao sổ bảo hiểm |
| `DM_CHUCDANH` | Bảng danh mục chức danh, dùng để resolve `NHANSU.Ref_ChucDanh` sang `TenChucDanh` khi hiển thị chứng từ nhân sự |
| `DM_BOPHAN` | Bảng danh mục bộ phận, dùng để resolve bộ phận làm việc trong HĐLĐ |
| `DM_MUCLUONG_DONGBHXH` | Bảng danh mục mức lương đóng BHXH, dùng để resolve `NHANSU_HOPDONG_LAODONG.MucLuongCoBan` sang `MucLuong`; nếu không tìm thấy thì không được xuất Word |
| `DM_DOIXE` | Bảng danh mục đội xe |
| `NHANSU_KYQUY` | Bảng con ký quỹ |
| `DONVI` | Bảng đơn vị, dùng để resolve `Ref_DonViQuanLyHienTai` trong ký quỹ lái xe, dự phòng `Ref_DonVi` cũ |
| `NHANSU_KYQUY_GIAODICH` | Bảng con giao dịch ký quỹ |
| `LAIXE_KHENTHUONG_KYLUAT` | Bảng con khen thưởng, kỷ luật |
| `LAIXE_VIPHAM_ATGT` | Bảng con vi phạm an toàn giao thông |
| `LAIXE_PHANCONG_XE` | Bảng con phân công xe |
| `NHANSU_CHAMDUT_HOPDONG` | Bảng con chấm dứt hợp đồng |
| `LAIXE_GPLX` | Bảng con giấy phép lái xe |
| `KIEMTRA_XE_TAXI` | Bảng kiểm tra xe taxi |
| `PHAN_ANH_KHIEU_NAI` | Bảng phản ánh, khiếu nại |
| `NHANSU_KYQUY_MUC` | Bảng con mức ký quỹ |
| `NHANSU_KYQUY_THANHLY` | Bảng con thanh lý ký quỹ; trang thanh lý ký quỹ lấy theo `ID_ThanhLy`, resolve thêm `Ref_KyQuy` sang `NHANSU_KYQUY` |
| `NHANSU_THANHLY_HOPDONG` | Bảng thanh lý hợp đồng lao động, dùng `Ref_NhanSu` để tìm hồ sơ thanh lý HĐLĐ liên quan và lấy `Ref_HopDongLD` |
| `KIEMTRA_XE_TAXI_CHITIET` | Bảng chi tiết kiểm tra xe taxi |

## Dashboard QLVT

| Bảng nguồn | Cột lưu mã Ref | Bảng đích cần đọc | Khóa bảng đích | Cột nên hiển thị | Mức chắc chắn |
| --- | --- | --- | --- | --- | --- |
| `NHANSU` | `Ref_XeHienTai` | `XE` | `ID_Xe` | `BienSo`, `MaDam`, `LoaiXe`, `TrangThaiXe` | Đã xác minh qua schema |
| `NHANSU` | `Ref_DonViLamViecHienTai`, `Ref_DonViDuocCapPH` | `DONVI` | `ID_DonVi` | `TenDonVi`, dự phòng `TenVietTat`, `Display` | Đã xác minh qua schema |
| `NHANSU` | `Ref_BoPhan` | `DM_BOPHAN` | `ID_BoPhan` | `TenBoPhan`, dự phòng `MaBoPhan`, `Display` | Đã xác minh qua schema |
| `NHANSU` | `Ref_ChucDanh` | `DM_CHUCDANH` | `ID_ChucDanh` | `TenChucDanh`, dự phòng `Display` | Đã xác minh qua schema |
| `NHANSU` | `Ref_DoiXe` | `DM_DOIXE` | `ID_DoiXe` | `TenDoiXe`, dự phòng `MaDoiXe`, `Display` | Cần kiểm tra thêm nếu schema bị Google quota |
| `NHANSU` | `Ref_DoiXe` mã cũ | `LOG_GAN_DOIXE_NHANSU` | `Ref_DoiXe_Moi`, dự phòng `Ref_DoiXe_Cu` | `TenDoiXe`, dự phòng `Xa_Truoc` | Đã xác minh ngày 21/06/2026; dùng làm fallback khi mã cũ không có trong `DM_DOIXE` |
| `NHANSU_HOPDONG_LAODONG` | `Ref_NhanSu` | `NHANSU` | `ID_NhanSu` | `HoTen`, `CCCD`, `SoDienThoai` | Đã xác minh qua schema |
| `NHANSU_BHXH` | `Ref_NhanSu` | `NHANSU` | `ID_NhanSu` | `HoTen`, `CCCD` | Đã xác minh qua schema |
| `LAIXE_GPLX` | `Ref_NhanSu` | `NHANSU` | `ID_NhanSu` | `HoTen`, `CCCD` | Đã xác minh qua schema |
| `NHANSU_SUCKHOE` | `Ref_NhanSu` | `NHANSU` | `ID_NhanSu` | `HoTen`, `CCCD` | Đã xác minh qua schema |
| `LAIXE_PHANCONG_XE` | `Ref_NhanSu` | `NHANSU` | `ID_NhanSu` | `HoTen`, `CCCD` | Đã xác minh qua schema |
| `LAIXE_PHANCONG_XE` | `Ref_Xe` | `XE` | `ID_Xe` | `BienSo`, `MaDam` | Đã xác minh qua schema |
| `XE` | `Ref_DonViChuQuan`, `Ref_DonViQuanLyHienTai` | `DONVI` | `ID_DonVi` | `TenDonVi`, dự phòng `TenVietTat`, `Display` | Đã xác minh qua schema |
| `XE` | `Ref_DoiXe` | `DM_DOIXE` | `ID_DoiXe` | `TenDoiXe`, dự phòng `MaDoiXe`, `Display` | Cần kiểm tra thêm nếu schema bị Google quota |
| `XE` | đội xe suy từ lái xe hiện tại | `LOG_GAN_DOIXE_NHANSU` | `Ref_DoiXe_Moi`, dự phòng `Ref_DoiXe_Cu` | `TenDoiXe`, dự phòng `Xa_Truoc` | Dùng khi `XE.Ref_DoiXe` trống nhưng lái xe có `NHANSU.Ref_DoiXe` mã cũ |
| `XE_PHUHIEU` | `Ref_Xe` | `XE` | `ID_Xe` | `BienSo`, `MaDam` | Đã xác minh qua schema |
| `XE_DANGKIEM` | `Ref_Xe` | `XE` | `ID_Xe` | `BienSo`, `MaDam` | Cần kiểm tra thêm nếu schema bị Google quota |
| `XE_BAOHIEM` | `Ref_Xe` | `XE` | `ID_Xe` | `BienSo`, `MaDam` | Đã xác minh qua schema |
| `XE_TAXIMET` | `Ref_Xe` | `XE` | `ID_Xe` | `BienSo`, `MaDam` | Đã xác minh qua schema |
| `XE_THECHAP_NGANHANG` | `Ref_Xe` | `XE` | `ID_Xe` | `BienSo`, `MaDam` | Đã xác minh qua schema |
| `XE_THECHAP_NGANHANG` | `Ref_NganHang` | `DM_NGANHANG` | `ID_NganHang` | `TenNganHang`, dự phòng `TenVietTat`, `Display` | Đã xác minh qua schema |
| `XE_SO_KM_THANG` | `Ref_Xe` | `XE` | `ID_Xe` | `BienSo`, `MaDam` | Đã xác minh qua schema |
| `KIEMTRA_XE_TAXI` | `Ref_Xe` | `XE` | `ID_Xe` | `BienSo`, `MaDam` | Đã xác minh qua schema |
| `KIEMTRA_XE_TAXI` | `Ref_LaiXe`, `CanBoKT`, `NguoiChot` | `NHANSU` | `ID_NhanSu` | `HoTen`, dự phòng `Display` | Đã xác minh qua schema |
| `KIEMTRA_XE_TAXI_CHITIET` | `Ref_KiemTra` | `KIEMTRA_XE_TAXI` | `ID_KiemTra` | `SoPhieuKiemTra`, `Ref_Xe`, `NgayKiemTra` | Đã xác minh qua schema |
| `PHAN_ANH_KHIEU_NAI` | `Ref_Xe` | `XE` | `ID_Xe` | `BienSo`, `MaDam` | Đã xác minh qua schema |
| `PHAN_ANH_KHIEU_NAI` | `Ref_NhanSuBiPhanAnh`, `Ref_CanBoXuLy` | `NHANSU` | `ID_NhanSu` | `HoTen`, dự phòng `Display` | Đã xác minh qua schema |

Dashboard QLVT không hiển thị trực tiếp mã Ref trong KPI, bảng chi tiết hoặc Excel. Nếu một bảng liên kết bị thiếu do Google quota, endpoint phải trả `missingSources` và để trống trường hiển thị liên quan kèm `Ghi chú cảnh báo`, không tự đoán tên từ mã Ref.

## Nghiệp vụ thỏa thuận trách nhiệm dân sự

| Bảng chính | Cột lưu mã Ref | Bảng cần gọi thêm | Khóa bảng Ref | Cột nên hiển thị |
| --- | --- | --- | --- | --- |
| `XE_THOATHUAN_DANSU` | `Ref_DonViBenA` | `DONVI` | `ID_DonVi` | `TenDonVi`, `DiaChi`, `SoDienThoai`, `NguoiDaiDien`, `ChucVuNguoiDaiDien`, `MaSoThue` |
| `XE_THOATHUAN_DANSU` | `Ref_LaiXe` | `NHANSU` | `ID_NhanSu` | `HoTen`, `Dia_Chi_Day_Du`, `Address`, `NgaySinh`, `CCCD`, `NgayCapCCCD`, `NoiCapCCCD`, `SoDienThoai` |
| `XE_THOATHUAN_DANSU` | `Ref_LaiXe` | `LAIXE_GPLX` | `Ref_NhanSu` | `SoGPLX`, `NgayCap`, `NgayHetHan`, `HangGPLX`; ưu tiên dòng đang hiệu lực hoặc mới nhất |
| `XE_THOATHUAN_DANSU` | `Ref_Xe` | `XE` | `ID_Xe` | `BienSo`, `MaDam`, `NhanHieu`, `SoKhung`, `SoMay`, `NamSanXuat`, `MauSon`, `NgayDangKyXeLanDau` |

Khi render preview, HTML standalone hoặc xuất Word thỏa thuận trách nhiệm dân sự, không hiển thị trực tiếp `Ref_DonViBenA`, `Ref_LaiXe` hoặc `Ref_Xe`. Nếu chưa resolve được dữ liệu liên kết thì để trống trường hiển thị và báo cảnh báo, không đưa mã Ref vào chứng từ.

## Nghiệp vụ HĐLĐ nhân viên lái xe

| Bảng chính | Cột lưu mã Ref | Bảng cần gọi thêm | Khóa bảng Ref | Cột nên hiển thị |
| --- | --- | --- | --- | --- |
| `NHANSU_HOPDONG_LAODONG` | `Ref_NhanSu` | `NHANSU` | `ID_NhanSu` | `HoTen`, dự phòng `Display`; lấy thêm `NgaySinh`, `CCCD`, `NgayCapCCCD`, `NoiCapCCCD`, `Dia_Chi_Day_Du` |
| `NHANSU_HOPDONG_LAODONG` | `Ref_DonViLamViec` | `DONVI` | `ID_DonVi` | `TenDonVi`, `DiaChi`, `MaSoThue`, `NguoiDaiDien`, `ChucVuNguoiDaiDien` |
| `NHANSU_HOPDONG_LAODONG` | `Ref_NguoiKy` | `NHANSU` | `ID_NhanSu` | `HoTen`, dự phòng `Display`; nếu trống thì dùng `DONVI.NguoiDaiDien` và `DONVI.ChucVuNguoiDaiDien` |
| `NHANSU_HOPDONG_LAODONG` | `Ref_BoPhan` | `DM_CHUCDANH`, `DM_BOPHAN` | `ID_ChucDanh`, `ID_BoPhan` | `TenChucDanh`, `TenBoPhan` |
| `NHANSU_HOPDONG_LAODONG` | `MucLuongCoBan` | `DM_MUCLUONG_DONGBHXH` | `ID_MucLuong` | `MucLuong`; nếu không tìm thấy thì để trống, không tự đoán |
| `NHANSU.ID_NhanSu` | `ID_NhanSu` | `LAIXE_GPLX` | `Ref_NhanSu` | `SoGPLX`, `HangGPLX`, `NgayHetHan`; ưu tiên dòng `TrangThai = Đang hiệu lực` |

Khi render HĐLĐ nhân viên lái xe hoặc xuất Word, không lấy `SoGPLX`, `HangGPLX`, `HanGPLX` từ `NHANSU` vì đây có thể là cột ảo từ hệ thống cũ. Phải lấy giấy phép lái xe từ bảng `LAIXE_GPLX` theo `Ref_NhanSu`; nếu không resolve được thì để trống, không tự điền hạng bằng mặc định như `B2`.

## Nghiệp vụ chấm dứt hợp đồng lao động

| Bảng chính | Cột lưu mã Ref | Bảng cần gọi thêm | Khóa bảng Ref | Cột nên hiển thị |
| --- | --- | --- | --- | --- |
| `NHANSU_CHAMDUT_HOPDONG` | `Ref_NhanSu` | `NHANSU` | `ID_NhanSu` | `HoTen`, dự phòng `Display`; lấy thêm `NgaySinh`, `CCCD`, `NgayCapCCCD`, `NoiCapCCCD`, `Dia_Chi_Day_Du` |
| `NHANSU_CHAMDUT_HOPDONG` | `Ref_HopDongLD` | `NHANSU_HOPDONG_LAODONG` | `ID_HopDongLaoDong` | `SoHopDong`, `NgayKy`, `Ref_DonViLamViec`, `Ref_BoPhan` |
| `NHANSU_CHAMDUT_HOPDONG` | `Ref_NguoiKy` | `NHANSU` | `ID_NhanSu` | `HoTen`, dự phòng `Display`; nếu trống thì dùng `DONVI.NguoiDaiDien` và `DONVI.ChucVuNguoiDaiDien` |

Khi render quyết định chấm dứt HĐLĐ hoặc xuất Word, không hiển thị trực tiếp mã Ref như `Ref_NhanSu`, `Ref_HopDongLD`, `Ref_NguoiKy`. Phải resolve sang thông tin thật của nhân sự, hợp đồng lao động, đơn vị, chức danh và người ký trước khi đưa vào chứng từ.

## Nghiệp vụ thanh lý hợp đồng lao động

| Bảng chính | Cột lưu mã Ref | Bảng cần gọi thêm | Khóa bảng Ref | Cột nên hiển thị |
| --- | --- | --- | --- | --- |
| `NHANSU_THANHLY_HOPDONG` | `Ref_NhanSu` | `NHANSU` | `ID_NhanSu` | `HoTen`, dự phòng `Display`; lấy thêm `CCCD`, `NgayCapCCCD`, `NoiCapCCCD`, `Dia_Chi_Day_Du` |
| `NHANSU_THANHLY_HOPDONG` | `Ref_HopDongLD` | `NHANSU_HOPDONG_LAODONG` | `ID_HopDongLaoDong` | `SoHopDong`, `NgayKy`, `Ref_DonViLamViec` |
| `NHANSU_THANHLY_HOPDONG` | `Ref_ChamDutHD` | `NHANSU_CHAMDUT_HOPDONG` | `ID_ChamDutHD` | `NgayChamDut`, `LyDoChamDut`, `TrangThaiChamDut` |
| `NHANSU_HOPDONG_LAODONG` | `Ref_DonViLamViec` | `DONVI` | `ID_DonVi` | `TenDonVi`, `DiaChi`, `MaSoThue`, `NguoiDaiDien`, `ChucVuNguoiDaiDien` |

Khi render biên bản thanh lý HĐLĐ hoặc xuất Word, không hiển thị trực tiếp mã Ref như `Ref_NhanSu`, `Ref_HopDongLD`, `Ref_ChamDutHD`. Chỉ dùng dòng `NHANSU_HOPDONG_LAODONG` khi `Ref_NhanSu` của hợp đồng khớp với `Ref_NhanSu` của biên bản thanh lý. Số hợp đồng lao động chỉ lấy từ `NHANSU_HOPDONG_LAODONG.SoHopDong`; nếu cột này trống thì để trống, không dùng `CCCD`, không dùng mã Ref, không tự ghép thêm năm hoặc hậu tố `HĐLĐ`.

## Nghiệp vụ đề nghị đào tạo lái xe

| Bảng chính | Cột lưu mã Ref | Bảng cần gọi thêm | Khóa bảng Ref | Cột nên hiển thị |
| --- | --- | --- | --- | --- |
| `HS_DAOTAO` | `Ref_DonViDeNghi` | `DONVI` | `ID_DonVi` | `TenDonVi`, dự phòng `Display`; lấy thêm `DiaChi`, `NguoiDaiDien`, `ChucVuNguoiDaiDien` |
| `CT_HS_DAOTAO` | `Ref_HoSoDaoTao` | `HS_DAOTAO` | `ID_HoSoDaoTao` | Dùng để lọc danh sách chi tiết của hồ sơ đào tạo |
| `CT_HS_DAOTAO` | `Ref_NhanSu` | `NHANSU` | `ID_NhanSu` | `HoTen`, `NgaySinh`, `Dia_Chi_Day_Du`, `CCCD`, `NgayCapCCCD` |

Khi render giao diện, HTML standalone hoặc xuất Excel danh sách lái xe đề nghị đào tạo, không hiển thị trực tiếp `Ref_DonViDeNghi`, `Ref_HoSoDaoTao`, `Ref_NhanSu`. Danh sách Excel phải lấy tên và thông tin cá nhân thật từ `NHANSU`; nếu không resolve được nhân sự thì để trống thông tin cá nhân, không đưa mã Ref vào cột họ tên hoặc các cột người dùng đọc.

## Nghiệp vụ đề nghị cấp bảo hiểm

| Bảng chính | Cột lưu mã Ref | Bảng cần gọi thêm | Khóa bảng Ref | Cột nên hiển thị |
| --- | --- | --- | --- | --- |
| `HS_DE_NGHI_BAOHIEM` | `Ref_CongTyBaoHiem` | `DM_CTY_BAOHIEM` | `ID_CongTyBaoHiem` | `TenCongTyBaoHiem`, dự phòng `TenVietTat`, `Display` |
| `CT_HS_DE_NGHI_BAOHIEM` | `Ref_HoSoBaoHiem` | `HS_DE_NGHI_BAOHIEM` | `ID_HoSoBaoHiem` | Dùng để lọc danh sách chi tiết của hồ sơ bảo hiểm |
| `CT_HS_DE_NGHI_BAOHIEM` | `Ref_Xe` | `XE` | `ID_Xe` | `BienSo`, dự phòng `Display` |

Khi render giao diện, HTML standalone hoặc xuất Excel danh sách xe đề nghị cấp bảo hiểm, không hiển thị trực tiếp `Ref_CongTyBaoHiem`, `Ref_HoSoBaoHiem`, `Ref_Xe`. Danh sách Excel chỉ dùng 4 cột người dùng đọc: `STT`, `Biển số xe`, `Ngày hết hạn cũ`, `Ghi chú`. Schema hiện tại của nghiệp vụ này không có `Ref_NhanSu`, vì vậy không gọi hoặc hiển thị `NHANSU` cho trang đề nghị cấp bảo hiểm; nếu không resolve được xe thì để trống biển số thay vì đưa mã Ref vào chứng từ.

## Nghiệp vụ đề nghị kiểm định taximet

| Bảng chính | Cột lưu mã Ref | Bảng cần gọi thêm | Khóa bảng Ref | Cột nên hiển thị |
| --- | --- | --- | --- | --- |
| `HS_DE_NGHI_KIEMDINH_TAXIMET` | `Ref_DonViKiemDinh` | `DM_CQKD_TAXIMET` | `ID_CQKD` | `TenDonVI`, dự phòng `Display` |
| `CT_HS_KIEMDINH_TAXIMET` | `Ref_HoSoTaximet` | `HS_DE_NGHI_KIEMDINH_TAXIMET` | `ID_HoSoTaximet` | Dùng để lọc danh sách chi tiết của hồ sơ kiểm định taximet |
| `CT_HS_KIEMDINH_TAXIMET` | `Ref_Xe` | `XE` | `ID_Xe` | `BienSo`, dự phòng `Display` |

Khi render giao diện, HTML standalone hoặc xuất Excel danh sách xe đề nghị kiểm định taximet, không hiển thị trực tiếp `Ref_DonViKiemDinh`, `Ref_HoSoTaximet`, `Ref_Xe`. `Ref_DonViKiemDinh` liên kết tới danh mục cơ quan kiểm định taximet `DM_CQKD_TAXIMET`, không phải `DONVI`. Danh sách Excel chỉ dùng 4 cột người dùng đọc: `STT`, `Biển số`, `Ngày hết hạn cũ`, `Ghi chú`. Schema hiện tại của nghiệp vụ này không có `Ref_NhanSu`, vì vậy không gọi hoặc hiển thị `NHANSU` cho trang đề nghị kiểm định taximet; nếu không resolve được xe thì để trống biển số thay vì đưa mã Ref vào chứng từ.

## Nghiệp vụ đề nghị thế chấp

| Bảng chính | Cột lưu mã Ref | Bảng cần gọi thêm | Khóa bảng Ref | Cột nên hiển thị |
| --- | --- | --- | --- | --- |
| `XE_THECHAP_HOSO_CHITIET` | `Ref_HoSoTheChap` | `XE_THECHAP_HOSO` | `ID_HoSoTheChap` | Dùng để lọc danh sách chi tiết của hồ sơ thế chấp |
| `XE_THECHAP_HOSO_CHITIET` | `Ref_Xe` | `XE` | `ID_Xe` | `BienSo`, dự phòng `Display` |
| `XE_THECHAP_HOSO_CHITIET` | `Ref_NganHangMoi` | `DM_NGANHANG` | `ID_NganHang` | Chỉ gọi khi cần mẫu cũ có tên ngân hàng; mẫu báo cáo hết hạn mới không hiển thị ngân hàng |
| `XE_THECHAP_HOSO_CHITIET` | `Ref_XeTheChapNganHang` | `XE_THECHAP_NGANHANG` | `ID_TheChap` | Lấy `TrangThaiKhoanVay`, không hiển thị mã Ref |
| `XE` | `Ref_DonViQuanLyHienTai`, `Ref_DonViChuQuan` | `DONVI` | `ID_DonVi` | Chỉ gọi khi nghiệp vụ cũ cần thông tin đơn vị, mẫu báo cáo hết hạn mới không cần |
| `NHANSU` | `Ref_XeHienTai` | `XE` | `ID_Xe` | Chỉ gọi khi nghiệp vụ cũ cần tài xế hiện tại, mẫu báo cáo hết hạn mới không cần |

Khi render giao diện, HTML standalone hoặc xuất Excel danh sách xe đề nghị thế chấp, không hiển thị trực tiếp `Ref_HoSoTheChap`, `Ref_Xe`, `Ref_NganHangMoi`, `Ref_XeTheChapNganHang`, `Ref_DonViQuanLyHienTai`, `Ref_DonViChuQuan` hoặc `Ref_XeHienTai`. Mẫu báo cáo hết hạn thế chấp mới dùng 15 cột người dùng đọc: `STT`, `BIỂN SỐ`, `MÃ ĐÀM`, `TRẠNG THÁI KHOAN VAY`, `THỜI HẠN`, `SỐ ĐĂNG KÝ`, `SỐ KHUNG`, `SỐ MÁY`, `NHÃN HIỆU`, `NĂM SX`, `SỐ CHỖ`, `NƯỚC SX`, `NGÀY ĐĂNG KÝ XE LẦN ĐẦU`, `TÊN ĐĂNG KÝ XE`, `GHI CHÚ`. Cột `THỜI HẠN` lấy từ `XE_THECHAP_HOSO_CHITIET.HanTheChapCu`, cột `TRẠNG THÁI KHOAN VAY` lấy từ `XE_THECHAP_NGANHANG.TrangThaiKhoanVay`, các thông tin xe còn lại lấy từ bảng `XE`. Với mẫu mới, request frontend nên chỉ resolve `XE` và `XE_THECHAP_NGANHANG`; không gọi `DM_NGANHANG`, `DONVI`, `NHANSU` nếu không có nhu cầu khác.
