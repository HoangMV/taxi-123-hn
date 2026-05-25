# Quan hệ bảng AppSheet

Tài liệu này giúp AI hiểu cách xử lý dữ liệu Ref trong các nghiệp vụ. Khi một cột lưu mã khóa như `V3B3GM6D`, không hiển thị trực tiếp mã đó nếu người dùng cần tên thật; hãy gọi bảng được tham chiếu và lấy cột hiển thị phù hợp như `HoTen`, `Display`, `Ten...` hoặc cột nghiệp vụ tương ứng.

## Quy tắc đọc Ref

- Cột bắt đầu bằng `Ref_` hoặc cột nghiệp vụ đang chứa ID bảng khác là cột kết nối xuôi.
- Cột bắt đầu bằng `Related ` là cột kết nối ngược do AppSheet tự sinh, cho biết bảng hiện tại đang được bảng nào tham chiếu.
- Khi render chứng từ, email, Word hoặc giao diện người dùng, phải resolve mã Ref sang dữ liệu thật trước khi hiển thị.
- Luôn dùng `src/services/appSheetService.js` để gọi AppSheet trong React.
- Không đoán tên từ mã Ref. Nếu chưa có dữ liệu hiển thị trong bảng chính, phải gọi bảng Ref.

## Nghiệp vụ bàn giao xe

| Bảng chính | Cột lưu mã Ref | Bảng cần gọi thêm | Khóa bảng Ref | Cột nên hiển thị |
| --- | --- | --- | --- | --- |
| `XE_BANGIAO` | `DaiDienBenGiao1` | `NHANSU` | `ID_NhanSu` | `HoTen`, dự phòng `Display` |
| `XE_BANGIAO` | `DaiDienBenGiao2` | `NHANSU` | `ID_NhanSu` | `HoTen`, dự phòng `Display` |
| `XE_BANGIAO` | `Ref_LaiXe` | `NHANSU` | `ID_NhanSu` | `HoTen`, `CCCD`, `SoGPLX`, `HanGPLX` |

Ví dụ: nếu `XE_BANGIAO.DaiDienBenGiao1 = V3B3GM6D`, phải gọi `NHANSU` với điều kiện `[ID_NhanSu] = "V3B3GM6D"` rồi hiển thị `NHANSU.HoTen`, không hiển thị mã `V3B3GM6D` trong biên bản.

## Quan hệ đã phát hiện

| Bảng đang được tham chiếu | Khóa chính dự đoán | Bảng liên kết tới bảng này | Cột Related trong bảng hiện tại | Cột Ref có khả năng dùng ở bảng liên kết |
| --- | --- | --- | --- | --- |
| `NHANSU` | `ID_NhanSu` | `XE_BANGIAO` | `Related XE_BANGIAOs` | `Ref_LaiXe`, `DaiDienBenGiao1`, `DaiDienBenGiao2` |
| `NHANSU` | `ID_NhanSu` | `XE_BANGIAO` | `Related XE_BANGIAOs By DaiDienBenGiao1` | `DaiDienBenGiao1` |
| `NHANSU` | `ID_NhanSu` | `XE_BANGIAO` | `Related XE_BANGIAOs By DaiDienBenGiao2` | `DaiDienBenGiao2` |
| `XE_BANGIAO` | `ID_BienBanXe` | `XE_BANGIAO_HINHANH` | `Related XE_BANGIAO_HINHANHs` | Cần kiểm tra thêm trong AppSheet |
| `NHANSU` | `ID_NhanSu` | `NHANSU_BHXH` | `Related NHANSU_BHXHs` | `Ref_NhanSu` |
| `NHANSU` | `ID_NhanSu` | `NHANSU_NGUOITHAN` | `Related NHANSU_NGUOITHANs` | Cần kiểm tra thêm trong AppSheet |
| `NHANSU` | `ID_NhanSu` | `NHANSU_HOSO_CANHAN` | `Related NHANSU_HOSO_CANHANs` | Cần kiểm tra thêm trong AppSheet |
| `NHANSU` | `ID_NhanSu` | `NHANSU_QUATRINH_CONGTAC` | `Related NHANSU_QUATRINH_CONGTACs` | Cần kiểm tra thêm trong AppSheet |
| `NHANSU` | `ID_NhanSu` | `NHANSU_SUCKHOE` | `Related NHANSU_SUCKHOEs` | Cần kiểm tra thêm trong AppSheet |
| `NHANSU` | `ID_NhanSu` | `NHANSU_HOPDONG_LAODONG` | `Related NHANSU_HOPDONG_LAODONGs` | `Ref_NhanSu`, `Ref_NguoiKy` |
| `NHANSU` | `ID_NhanSu` | `LAIXE_DAOTAO` | `Related LAIXE_DAOTAOs` | `Ref_NhanSu` |
| `NHANSU` | `ID_NhanSu` | `LAIXE_TAINAN` | `Related LAIXE_TAINANs` | Cần kiểm tra thêm trong AppSheet |
| `NHANSU` | `ID_NhanSu` | `NHANSU_BHXH_BANGIAO_SO` | `Related NHANSU_BHXH_BANGIAO_SOs By NguoiGiao` | `NguoiGiao` |
| `NHANSU` | `ID_NhanSu` | `NHANSU_BHXH_BANGIAO_SO` | `Related NHANSU_BHXH_BANGIAO_SOs By NguoiNhan` | `NguoiNhan` |
| `NHANSU` | `ID_NhanSu` | `DM_DOIXE` | `Related DM_DOIXEs` | Cần kiểm tra thêm trong AppSheet |
| `NHANSU` | `ID_NhanSu` | `NHANSU_KYQUY` | `Related NHANSU_KYQUYs` | `Ref_NhanSu` |
| `NHANSU` | `ID_NhanSu` | `NHANSU_KYQUY_GIAODICH` | `Related NHANSU_KYQUY_GIAODICHs` | `Ref_NhanSu`, `Ref_KyQuy` |
| `NHANSU` | `ID_NhanSu` | `NHANSU_KYQUY_GIAODICH` | `Related NHANSU_KYQUY_GIAODICHs By Ref_NhanSu` | `Ref_NhanSu` |
| `NHANSU` | `ID_NhanSu` | `LAIXE_KHENTHUONG_KYLUAT` | `Related LAIXE_KHENTHUONG_KYLUATs` | `Ref_NhanSu` |
| `NHANSU` | `ID_NhanSu` | `LAIXE_VIPHAM_ATGT` | `Related LAIXE_VIPHAM_ATGTs` | Cần kiểm tra thêm trong AppSheet |
| `NHANSU` | `ID_NhanSu` | `LAIXE_PHANCONG_XE` | `Related LAIXE_PHANCONG_XEs` | `Ref_NhanSu`, `Ref_Xe` |
| `NHANSU` | `ID_NhanSu` | `NHANSU_CHAMDUT_HOPDONG` | `Related NHANSU_CHAMDUT_HOPDONGs` | Cần kiểm tra thêm trong AppSheet |
| `NHANSU` | `ID_NhanSu` | `LAIXE_GPLX` | `Related LAIXE_GPLXs` | `Ref_NhanSu` |
| `NHANSU` | `ID_NhanSu` | `KIEMTRA_XE_TAXI` | `Related KIEMTRA_XE_TAXIs By Ref_LaiXe` | `Ref_LaiXe` |
| `NHANSU` | `ID_NhanSu` | `KIEMTRA_XE_TAXI` | `Related KIEMTRA_XE_TAXIs By NguoiChot` | `NguoiChot` |
| `NHANSU` | `ID_NhanSu` | `KIEMTRA_XE_TAXI` | `Related KIEMTRA_XE_TAXIs By CanBoKT` | `CanBoKT` |
| `NHANSU` | `ID_NhanSu` | `PHAN_ANH_KHIEU_NAI` | `Related PHAN_ANH_KHIEU_NAIs` | `Ref_NhanSuBiPhanAnh` |
| `NHANSU` | `ID_NhanSu` | `PHAN_ANH_KHIEU_NAI` | `Related PHAN_ANH_KHIEU_NAIs By Ref_CanBoXuLy` | `Ref_CanBoXuLy` |
| `NHANSU_BHXH` | `ID_BHXH` | `NHANSU_BHXH_BANGIAO_SO` | `Related NHANSU_BHXH_BANGIAO_SOs` | `Ref_BHXH` |
| `NHANSU_HOPDONG_LAODONG` | `ID_HopDongLaoDong` | `NHANSU_CHAMDUT_HOPDONG` | `Related NHANSU_CHAMDUT_HOPDONGs` | Cần kiểm tra thêm trong AppSheet |
| `NHANSU_KYQUY` | `ID_KyQuy` | `NHANSU_KYQUY_GIAODICH` | `Related NHANSU_KYQUY_GIAODICHs` | `Ref_KyQuy` |
| `NHANSU_KYQUY` | `ID_KyQuy` | `NHANSU_KYQUY_MUC` | `Related NHANSU_KYQUY_MUCs` | Cần kiểm tra thêm trong AppSheet |
| `NHANSU_KYQUY` | `ID_KyQuy` | `NHANSU_KYQUY_THANHLY` | `Related NHANSU_KYQUY_THANHLYs` | Cần kiểm tra thêm trong AppSheet |
| `KIEMTRA_XE_TAXI` | `ID_KiemTra` | `KIEMTRA_XE_TAXI_CHITIET` | `Related KIEMTRA_XE_TAXI_CHITIETs` | `Ref_KiemTra` |

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
| `DM_DOIXE` | Bảng danh mục đội xe |
| `NHANSU_KYQUY` | Bảng con ký quỹ |
| `NHANSU_KYQUY_GIAODICH` | Bảng con giao dịch ký quỹ |
| `LAIXE_KHENTHUONG_KYLUAT` | Bảng con khen thưởng, kỷ luật |
| `LAIXE_VIPHAM_ATGT` | Bảng con vi phạm an toàn giao thông |
| `LAIXE_PHANCONG_XE` | Bảng con phân công xe |
| `NHANSU_CHAMDUT_HOPDONG` | Bảng con chấm dứt hợp đồng |
| `LAIXE_GPLX` | Bảng con giấy phép lái xe |
| `KIEMTRA_XE_TAXI` | Bảng kiểm tra xe taxi |
| `PHAN_ANH_KHIEU_NAI` | Bảng phản ánh, khiếu nại |
| `NHANSU_KYQUY_MUC` | Bảng con mức ký quỹ |
| `NHANSU_KYQUY_THANHLY` | Bảng con thanh lý ký quỹ |
| `KIEMTRA_XE_TAXI_CHITIET` | Bảng chi tiết kiểm tra xe taxi |
