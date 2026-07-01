/**
 * DashboardService.gs — Engine tổng hợp Màn 1 "Tổng quan quản trị".
 *   Đọc dữ liệu theo TÊN CỘT, lọc dòng rỗng theo cột khóa,
 *   xử lý ngày kiểu Date lẫn chuỗi dd/MM/yyyy, có CacheService.
 */

/* ---------- Truy cập file & đọc sheet ---------- */
function qlvtSS_() {
  if (QLVT_SPREADSHEET_ID) return SpreadsheetApp.openById(QLVT_SPREADSHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

/* Đọc 1 sheet -> { headers, rows, idx(name) }. Trả rỗng nếu không có sheet. */
function readSheet_(name) {
  const sh = qlvtSS_().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return { headers: [], rows: [], idx: function () { return -1; } };
  const lastCol = sh.getLastColumn();
  const all = sh.getRange(1, 1, sh.getLastRow(), lastCol).getValues();
  const headers = all[0].map(String);
  const rows = all.slice(1);
  return { headers: headers, rows: rows, idx: function (n) { return findColByName_(headers, n); } };
}

/* ---------- Ngày & tiện ích ---------- */
function dateFromAny_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  const s = String(v == null ? '' : v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);   // dd/MM/yyyy
  if (m) { const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])); return isNaN(d.getTime()) ? null : d; }
  m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);        // yyyy-MM-dd
  if (m) { const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])); return isNaN(d.getTime()) ? null : d; }
  const d = new Date(s); return isNaN(d.getTime()) ? null : d;
}
function soNgayConLai_(v, now) {
  const d = dateFromAny_(v); if (!d) return null;
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}
function chuoiKhongDau_(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').trim();
}
function namTu_(v) {
  const s = String(v == null ? '' : v).trim();
  const m = s.match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

/* ---------- Phân loại hồ sơ theo ngày hết hạn ---------- */
/* Trả 'CON_HAN' | 'SAP_HET' | 'QUA_HAN' | 'KHONG_RO' */
function phanLoaiHan_(expiryVal, now) {
  const con = soNgayConLai_(expiryVal, now);
  if (con === null) return 'KHONG_RO';
  if (con < 0) return 'QUA_HAN';
  if (con <= NGUONG_SAP_HET_HAN_NGAY) return 'SAP_HET';
  return 'CON_HAN';
}

/* ============================================================
 * ENTRY: tổng hợp toàn bộ số liệu Màn 1.
 * ============================================================ */
function buildTongQuan_(bl) {
  bl = chuanBoLoc_(bl);
  const now = asOf_(bl);
  const coLoc = coLocMaster_(bl);

  /* ----- PHƯƠNG TIỆN ----- */
  const xeSh = readSheet_(CFG_XE.sheet);
  const iX = {
    key: xeSh.idx(CFG_XE.key), tt: xeSh.idx(CFG_XE.trangThai), loai: xeSh.idx(CFG_XE.loaiXe),
    nam: xeSh.idx(CFG_XE.namSX), doi: xeSh.idx(CFG_XE.refDoiXe), dv: xeSh.idx(CFG_XE.refDonVi)
  };
  let xeRecords = [];
  xeSh.rows.forEach(function (r) {
    const id = iX.key >= 0 ? String(r[iX.key] || '').trim() : '';
    if (!id) return;            // bỏ dòng rỗng
    xeRecords.push({
      id: id, tt: iX.tt >= 0 ? String(r[iX.tt] || '').trim() : '',
      namSX: iX.nam >= 0 ? namTu_(r[iX.nam]) : null, refDoi: iX.doi >= 0 ? String(r[iX.doi] || '').trim() : '',
      refDonVi: iX.dv >= 0 ? String(r[iX.dv] || '').trim() : ''
    });
  });
  // lọc đơn vị / đội xe / trạng thái
  const _doiSo = buildDoiInfo_().soMap;
  if (bl.donVi) xeRecords = xeRecords.filter(function (x) { return x.refDonVi === bl.donVi; });
  if (bl.doiXe) xeRecords = xeRecords.filter(function (x) { return _doiSo[x.refDoi] === bl.doiXe; });
  if (bl.trangThai) xeRecords = xeRecords.filter(function (x) { return x.tt === bl.trangThai; });
  const xeRestrict = coLoc ? toSet_(xeRecords.map(function (x) { return x.id; })) : null;

  const tongXe = xeRecords.length;
  const xeDangHoatDong = xeRecords.filter(function (x) { return x.tt === CFG_XE.TT_DANG_HOAT_DONG; });
  const xeNgung = xeRecords.filter(function (x) { return x.tt === CFG_XE.TT_NGUNG; }).length;

  const xuatHangSet = distinctRefSet_(CFG_XE_XUAT_HANG.sheet, CFG_XE_XUAT_HANG.refXe);
  const xeXuatHang = xeRecords.filter(function (x) { return xuatHangSet[x.id]; }).length;

  const phanCongCount = countActiveByRef_(CFG_PHANCONG_XE.sheet, CFG_PHANCONG_XE.refXe, CFG_PHANCONG_XE.trangThai, CFG_PHANCONG_XE.TT_ACTIVE);
  let xeChuaPhanCong = 0, xeNhieuLaiXe = 0;
  xeDangHoatDong.forEach(function (x) {
    const c = phanCongCount[x.id] || 0;
    if (c === 0) xeChuaPhanCong++;
    if (c >= 2) xeNhieuLaiXe++;
  });

  const kpiPhuongTien = {
    tong: tongXe,
    dangHoatDong: xeDangHoatDong.length, tlDangHoatDong: pct_(xeDangHoatDong.length, tongXe),
    xuatHang: xeXuatHang, tlXuatHang: pct_(xeXuatHang, tongXe),
    ngung: xeNgung, tlNgung: pct_(xeNgung, tongXe),
    chuaPhanCong: xeChuaPhanCong, tlChuaPhanCong: pct_(xeChuaPhanCong, tongXe),
    nhieuLaiXe: xeNhieuLaiXe, tlNhieuLaiXe: pct_(xeNhieuLaiXe, tongXe)
  };

  /* ----- NHÂN SỰ ----- */
  const nsSh = readSheet_(CFG_NHANSU.sheet);
  const iN = { key: nsSh.idx(CFG_NHANSU.key), tt: nsSh.idx(CFG_NHANSU.trangThai), refXe: nsSh.idx(CFG_NHANSU.refXe),
    doi: nsSh.idx(CFG_NHANSU.refDoiXe), dv: nsSh.idx(CFG_NHANSU.refDonVi), gt: nsSh.idx(CFG_NHANSU.gioiTinh) };
  let nsRecords = [];
  nsSh.rows.forEach(function (r) {
    const id = iN.key >= 0 ? String(r[iN.key] || '').trim() : '';
    if (!id) return;
    nsRecords.push({
      id: id, tt: iN.tt >= 0 ? String(r[iN.tt] || '').trim() : '',
      coXe: iN.refXe >= 0 ? !!String(r[iN.refXe] || '').trim() : false,
      refDoi: iN.doi >= 0 ? String(r[iN.doi] || '').trim() : '', refDonVi: iN.dv >= 0 ? String(r[iN.dv] || '').trim() : '',
      gt: iN.gt >= 0 ? String(r[iN.gt] || '').trim() : ''
    });
  });
  if (bl.donVi) nsRecords = nsRecords.filter(function (x) { return x.refDonVi === bl.donVi; });
  if (bl.doiXe) nsRecords = nsRecords.filter(function (x) { return _doiSo[x.refDoi] === bl.doiXe; });
  if (bl.gioiTinh) nsRecords = nsRecords.filter(function (x) { return x.gt === bl.gioiTinh; });
  const nsRestrict = coLoc ? toSet_(nsRecords.map(function (x) { return x.id; })) : null;

  const tongNS = nsRecords.length;
  const nsDangLam = nsRecords.filter(function (x) { return x.tt === CFG_NHANSU.TT_DANG_LAM; });
  const nsTamNghi = nsRecords.filter(function (x) { return x.tt === CFG_NHANSU.TT_TAM_NGHI; }).length;
  const nsNghiViec = nsRecords.filter(function (x) { return x.tt === CFG_NHANSU.TT_NGHI_VIEC; }).length;
  const nsChuaCoXe = nsDangLam.filter(function (x) { return !x.coXe; }).length;

  const bhxhSet = activeRefSet_('NHANSU_BHXH', 'Ref_NhanSu', 'TrangThaiBHXH', 'Đang tham gia');
  const nsChuaBHXH = nsDangLam.filter(function (x) { return !bhxhSet[x.id]; }).length;

  const kpiNhanSu = {
    tong: tongNS,
    dangLam: nsDangLam.length, tlDangLam: pct_(nsDangLam.length, tongNS),
    tamNghi: nsTamNghi, tlTamNghi: pct_(nsTamNghi, tongNS),
    nghiViec: nsNghiViec, tlNghiViec: pct_(nsNghiViec, tongNS),
    chuaCoXe: nsChuaCoXe, tlChuaCoXe: pct_(nsChuaCoXe, tongNS),
    chuaBHXH: nsChuaBHXH, tlChuaBHXH: pct_(nsChuaBHXH, tongNS)
  };

  /* ----- HỒ SƠ PHÁP LÝ (gộp 10 loại) ----- */
  const soXeCanHoSo = xeDangHoatDong.length;
  const soNSCanHoSo = nsDangLam.length;
  const xeActiveIds = toSet_(xeDangHoatDong.map(function (x) { return x.id; }));
  const nsActiveIds = toSet_(nsDangLam.map(function (x) { return x.id; }));

  const nhomHoSo = [];
  let tongHoSo = 0, conHan = 0, sapHet = 0, quaHan = 0, thieuHoSo = 0;
  const canhBao = {};   // nhom -> {quaHan, sapHet}

  HOSO_PHUONG_TIEN.forEach(function (h) { tichHopHoSo_(h, now, xeActiveIds, soXeCanHoSo, nhomHoSo, canhBao, agg, xeRestrict); });
  HOSO_NHAN_SU.forEach(function (h) { tichHopHoSo_(h, now, nsActiveIds, soNSCanHoSo, nhomHoSo, canhBao, agg, nsRestrict); });
  function agg(t, c, s, q, thieu) { tongHoSo += t; conHan += c; sapHet += s; quaHan += q; thieuHoSo += thieu; }

  const kpiHoSo = {
    tong: tongHoSo,
    conHieuLuc: conHan, tlConHieuLuc: pct_(conHan, tongHoSo),
    sapHetHan: sapHet, tlSapHetHan: pct_(sapHet, tongHoSo),
    quaHan: quaHan, tlQuaHan: pct_(quaHan, tongHoSo),
    thieuHoSo: thieuHoSo, tlThieuHoSo: pct_(thieuHoSo, tongHoSo + thieuHoSo)
  };

  /* ----- Cảnh báo gom nhóm ----- */
  const canhBaoList = Object.keys(canhBao).map(function (k) {
    return { nhom: k, quaHan: canhBao[k].quaHan, sapHet: canhBao[k].sapHet };
  });
  const tongQuaHan = canhBaoList.reduce(function (a, x) { return a + x.quaHan; }, 0);
  const tongSapHet = canhBaoList.reduce(function (a, x) { return a + x.sapHet; }, 0);

  /* ----- Tỷ lệ tuân thủ từng loại = số ĐỐI TƯỢNG có hồ sơ còn hạn / số cần có (≤100%) ----- */
  const tyLeTuanThu = nhomHoSo.map(function (h) {
    return { nhom: h.nhom, tyLe: pct_(h.dtConHan, h.canCo), conHan: h.dtConHan, canCo: h.canCo };
  });

  /* ----- Biến động tháng này + chuỗi 6 tháng (cho Màn 1) ----- */
  const _months = thangGanNhat_(SO_THANG_BIEN_DONG, now);
  const _xeNhap = cotNgay_(CFG_XE.sheet, CFG_XE.ngayHoatDong);
  const _xeXuat = cotNgay_(CFG_XE_XUAT_HANG.sheet, CFG_XE_XUAT_HANG.ngayXuat);
  const _nsTuyen = cotNgay_(CFG_NHANSU.sheet, CFG_NHANSU.ngayNhan);
  const _nsNghi = cotNgay_(CFG_NHANSU.sheet, CFG_NHANSU.ngayNghi);
  const _cur = _months[_months.length - 1];
  const bienDongThang = {
    kyLabel: _cur.label,
    xeNhap: demTrongThang_(_xeNhap, _cur), xeXuat: demTrongThang_(_xeXuat, _cur),
    nsTuyen: demTrongThang_(_nsTuyen, _cur), nsNghi: demTrongThang_(_nsNghi, _cur),
    series: _months.map(function (m) {
      return { ky: m.label, xe: demTruoc_(_xeNhap, m.end) - demTruoc_(_xeXuat, m.end), ns: demTruoc_(_nsTuyen, m.end) - demTruoc_(_nsNghi, m.end) };
    })
  };

  return {
    capNhat: Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'),
    kpiPhuongTien: kpiPhuongTien,
    kpiNhanSu: kpiNhanSu,
    kpiHoSo: kpiHoSo,
    canhBao: { tongQuaHan: tongQuaHan, tongSapHet: tongSapHet, chiTiet: canhBaoList.sort(function (a, b) { return b.quaHan - a.quaHan; }) },
    tyLeTuanThu: tyLeTuanThu,
    bienDongThang: bienDongThang,
    nhomHoSo: nhomHoSo
  };
}

/* Tích hợp 1 loại hồ sơ vào tổng + cảnh báo + nhomHoSo.
 * Phân loại 1 bản ghi:
 *   - Có ngày hết hạn  -> theo ngày (CON_HAN / SAP_HET / QUA_HAN).
 *   - Không có ngày     -> theo trạng thái: đúng giá trị active => CON_HAN, ngược lại KHONG_RO.
 *     (vd BHXH "Đang tham gia" / Thế chấp "Đang thế chấp" không có ngày kết thúc = vẫn hiệu lực)
 * Tuân thủ tính theo ĐỐI TƯỢNG: xe/nhân sự có >=1 hồ sơ CON_HAN. */
function tichHopHoSo_(h, now, masterActiveSet, soCanCo, nhomHoSo, canhBao, agg, restrictSet) {
  const sh = readSheet_(h.sheet);
  const iRef = sh.idx(h.ref), iExp = sh.idx(h.expiry), iSt = sh.idx(h.status);
  let tong = 0, con = 0, sap = 0, qua = 0;
  const coHoSoSet = {};       // đối tượng có bản ghi (để tính thiếu)
  const conHanDoiTuong = {};  // đối tượng có >=1 hồ sơ còn hạn (để tính tuân thủ, <=100%)
  sh.rows.forEach(function (r) {
    const ref = iRef >= 0 ? String(r[iRef] || '').trim() : '';
    if (!ref) return;                         // bỏ dòng rỗng
    if (restrictSet && !restrictSet[ref]) return;   // giới hạn theo master đã lọc
    coHoSoSet[ref] = true;
    tong++;
    const expVal = iExp >= 0 ? r[iExp] : '';
    const hasExp = dateFromAny_(expVal) !== null;
    let loai;
    if (hasExp) {
      loai = phanLoaiHan_(expVal, now);
    } else {
      const st = iSt >= 0 ? String(r[iSt] || '').trim() : '';
      loai = (h.active && st === h.active) ? 'CON_HAN' : 'KHONG_RO';
    }
    if (loai === 'QUA_HAN') qua++;
    else if (loai === 'SAP_HET') { sap++; conHanDoiTuong[ref] = true; }   // sắp hết vẫn còn hiệu lực
    else if (loai === 'CON_HAN') { con++; conHanDoiTuong[ref] = true; }
  });
  // thiếu hồ sơ = đối tượng đang hoạt động nhưng không có bản ghi nào ở bảng này
  let thieu = 0;
  Object.keys(masterActiveSet).forEach(function (id) { if (!coHoSoSet[id]) thieu++; });

  // số đối tượng đang hoạt động có hồ sơ còn hạn (giới hạn trong tập cần có)
  let dtConHan = 0;
  Object.keys(conHanDoiTuong).forEach(function (id) { if (masterActiveSet[id]) dtConHan++; });

  nhomHoSo.push({ nhom: h.nhom, tong: tong, conHan: con, sapHet: sap, quaHan: qua, thieu: thieu, canCo: soCanCo, dtConHan: dtConHan });
  if (!canhBao[h.nhom]) canhBao[h.nhom] = { quaHan: 0, sapHet: 0 };
  canhBao[h.nhom].quaHan += qua; canhBao[h.nhom].sapHet += sap;
  agg(tong, con, sap, qua, thieu);
}

/* ---------- Helpers tập hợp ---------- */
function distinctRefSet_(sheet, refCol) {
  const sh = readSheet_(sheet); const i = sh.idx(refCol); const set = {};
  if (i < 0) return set;
  sh.rows.forEach(function (r) { const v = String(r[i] || '').trim(); if (v) set[v] = true; });
  return set;
}
function countActiveByRef_(sheet, refCol, statusCol, activeVal) {
  const sh = readSheet_(sheet); const iR = sh.idx(refCol), iS = sh.idx(statusCol); const map = {};
  if (iR < 0) return map;
  sh.rows.forEach(function (r) {
    const ref = String(r[iR] || '').trim(); if (!ref) return;
    const st = iS >= 0 ? String(r[iS] || '').trim() : activeVal;
    if (st === activeVal) map[ref] = (map[ref] || 0) + 1;
  });
  return map;
}
function activeRefSet_(sheet, refCol, statusCol, activeVal) {
  const m = countActiveByRef_(sheet, refCol, statusCol, activeVal); const set = {};
  Object.keys(m).forEach(function (k) { set[k] = true; }); return set;
}
function toSet_(arr) { const s = {}; arr.forEach(function (x) { if (x) s[x] = true; }); return s; }
function pct_(a, b) { b = Number(b) || 0; if (!b) return 0; return Math.round((Number(a) / b) * 1000) / 10; }
function findColByName_(headers, name) {
  const norm = function (s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ''); };
  const t = norm(name);
  for (let i = 0; i < headers.length; i++) if (norm(headers[i]) === t) return i;
  return -1;
}

/* ============================================================
 * GIAI ĐOẠN 2 — Engine Màn 2 (Phương tiện) & Màn 3 (Nhân sự)
 * ============================================================ */

/* Bản đồ danh mục: ID -> Tên. */
function buildDanhMucMap_(cfg) {
  const sh = readSheet_(cfg.sheet); const iK = sh.idx(cfg.key), iT = sh.idx(cfg.ten); const map = {};
  if (iK < 0) return map;
  sh.rows.forEach(function (r) { const id = String(r[iK] || '').trim(); if (id) map[id] = iT >= 0 ? String(r[iT] || '').trim() : ''; });
  return map;
}
function tuoiTu_(ngaySinh, now) {
  const d = dateFromAny_(ngaySinh); if (!d) return null;
  let t = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) t--;
  return (t >= 0 && t <= 100) ? t : null;
}
function topN_(counter, n, nhanKhac) {
  const arr = Object.keys(counter).map(function (k) { return { nhan: k, soLuong: counter[k] }; }).sort(function (a, b) { return b.soLuong - a.soLuong; });
  if (arr.length <= n) return arr;
  const top = arr.slice(0, n); const con = arr.slice(n).reduce(function (a, x) { return a + x.soLuong; }, 0);
  if (con > 0) top.push({ nhan: nhanKhac || 'Khác', soLuong: con });
  return top;
}

/* Danh sách cảnh báo (quá hạn + sắp hết) cho 1 nhóm hồ sơ, join về master. */
function danhSachCanhBao_(hoSoList, now, masterMap, restrict, tuNgay) {
  const out = [];
  hoSoList.forEach(function (h) {
    const sh = readSheet_(h.sheet);
    const iRef = sh.idx(h.ref), iExp = sh.idx(h.expiry);
    if (iRef < 0) return;
    sh.rows.forEach(function (r) {
      const ref = String(r[iRef] || '').trim(); if (!ref) return;
      if (restrict && !restrict[ref]) return;                    // giới hạn theo master đã lọc
      const expVal = iExp >= 0 ? r[iExp] : '';
      const exp = dateFromAny_(expVal);
      if (tuNgay && exp && exp < tuNgay) return;                  // khoảng thời gian: bỏ mục hết hạn trước "từ ngày"
      const loai = phanLoaiHan_(expVal, now);
      if (loai !== 'QUA_HAN' && loai !== 'SAP_HET') return;     // chỉ lấy rủi ro
      const m = masterMap[ref]; if (!m) return;                  // chỉ đối tượng còn trong danh sách
      out.push({
        ten: m.ten, doiXe: m.doiXe, phu: m.phu, trangThai: m.trangThai,
        hangMuc: h.nhom, ngayHetHan: Utilities.formatDate(exp, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
        soNgayConLai: soNgayConLai_(expVal, now)
      });
    });
  });
  out.sort(function (a, b) { return a.soNgayConLai - b.soNgayConLai; });   // quá hạn nặng nhất trước
  return { ds: out.slice(0, GIOI_HAN_CANH_BAO), tong: out.length };
}

/* ---------------- MÀN 2: PHƯƠNG TIỆN ---------------- */
function buildPhuongTien_(bl) {
  bl = chuanBoLoc_(bl);
  const now = asOf_(bl);
  const coLoc = coLocMaster_(bl);
  const doiInfo = buildDoiInfo_();
  const dvMap = buildDanhMucMap_(CFG_DONVI);
  const sh = readSheet_(CFG_XE.sheet);
  const i = {
    key: sh.idx(CFG_XE.key), bien: sh.idx(CFG_XE.bienSo), tt: sh.idx(CFG_XE.trangThai),
    nhan: sh.idx(CFG_XE.nhanHieu), nam: sh.idx(CFG_XE.namSX), doi: sh.idx(CFG_XE.refDoiXe), dv: sh.idx(CFG_XE.refDonVi)
  };
  let xe = [];
  sh.rows.forEach(function (r) {
    const id = i.key >= 0 ? String(r[i.key] || '').trim() : ''; if (!id) return;
    xe.push({
      id: id, bien: i.bien >= 0 ? String(r[i.bien] || '').trim() : '',
      tt: i.tt >= 0 ? String(r[i.tt] || '').trim() : '',
      nhan: i.nhan >= 0 ? String(r[i.nhan] || '').trim() : '',
      nam: i.nam >= 0 ? namTu_(r[i.nam]) : null,
      doi: i.doi >= 0 ? String(r[i.doi] || '').trim() : '',
      dv: i.dv >= 0 ? String(r[i.dv] || '').trim() : ''
    });
  });
  if (bl.donVi) xe = xe.filter(function (x) { return x.dv === bl.donVi; });
  if (bl.doiXe) { const _ds = buildDoiInfo_().soMap; xe = xe.filter(function (x) { return _ds[x.doi] === bl.doiXe; }); }
  if (bl.trangThai) xe = xe.filter(function (x) { return x.tt === bl.trangThai; });
  const restrict = coLoc ? toSet_(xe.map(function (x) { return x.id; })) : null;

  const tong = xe.length;
  const dhd = xe.filter(function (x) { return x.tt === CFG_XE.TT_DANG_HOAT_DONG; });
  const ngung = xe.filter(function (x) { return x.tt === CFG_XE.TT_NGUNG; }).length;
  const xhSet = distinctRefSet_(CFG_XE_XUAT_HANG.sheet, CFG_XE_XUAT_HANG.refXe);
  const xuatHang = xe.filter(function (x) { return xhSet[x.id]; }).length;
  const pc = countActiveByRef_(CFG_PHANCONG_XE.sheet, CFG_PHANCONG_XE.refXe, CFG_PHANCONG_XE.trangThai, CFG_PHANCONG_XE.TT_ACTIVE);
  let chuaPC = 0, nhieuLX = 0;
  dhd.forEach(function (x) { const c = pc[x.id] || 0; if (c === 0) chuaPC++; if (c >= 2) nhieuLX++; });

  // cơ cấu nhãn hiệu
  const cNhan = {}; xe.forEach(function (x) { if (x.nhan) cNhan[x.nhan] = (cNhan[x.nhan] || 0) + 1; });
  // theo năm SX
  const cNam = {}; xe.forEach(function (x) { if (x.nam) cNam[x.nam] = (cNam[x.nam] || 0) + 1; });
  const theoNam = Object.keys(cNam).sort().map(function (k) { return { nam: k, soLuong: cNam[k] }; });
  // phân bố đội xe
  const cDoi = {}; xe.forEach(function (x) { const t = tenDoi_(x.doi, doiInfo); cDoi[t] = (cDoi[t] || 0) + 1; });
  const phanBoDoi = Object.keys(cDoi).map(function (k) { return { nhan: k, soLuong: cDoi[k] }; }).sort(function (a, b) { return b.soLuong - a.soLuong; }).slice(0, 12);

  // THỐNG KÊ THEO ĐƠN VỊ
  const tkDV = {};
  xe.forEach(function (x) {
    const ten = dvMap[x.dv] || 'Chưa gán đơn vị';
    if (!tkDV[ten]) tkDV[ten] = { donVi: ten, tong: 0, dangHD: 0, xuatHang: 0, ngung: 0, chuaPC: 0 };
    const o = tkDV[ten]; o.tong++;
    if (x.tt === CFG_XE.TT_DANG_HOAT_DONG) { o.dangHD++; if (!(pc[x.id] > 0)) o.chuaPC++; }
    if (x.tt === CFG_XE.TT_NGUNG) o.ngung++;
    if (xhSet[x.id]) o.xuatHang++;
  });
  const thongKeDonVi = Object.keys(tkDV).map(function (k) { return tkDV[k]; }).sort(function (a, b) { return b.tong - a.tong; });

  // map cho cảnh báo
  const masterMap = {};
  xe.forEach(function (x) { masterMap[x.id] = { ten: x.bien, doiXe: tenDoi_(x.doi, doiInfo), phu: x.nhan, trangThai: x.tt }; });
  const canhBao = danhSachCanhBao_(HOSO_PHUONG_TIEN, now, masterMap, restrict, tuNgay_(bl));
  const topCK = topChuyenKm_(xe);

  return {
    capNhat: Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'),
    kpi: {
      tong: tong, dangHoatDong: dhd.length, tlDangHoatDong: pct_(dhd.length, tong),
      xuatHang: xuatHang, tlXuatHang: pct_(xuatHang, tong), ngung: ngung, tlNgung: pct_(ngung, tong),
      chuaPhanCong: chuaPC, tlChuaPhanCong: pct_(chuaPC, tong), nhieuLaiXe: nhieuLX, tlNhieuLaiXe: pct_(nhieuLX, tong)
    },
    coCauNhanHieu: topN_(cNhan, TOP_NHAN_HIEU, 'Khác'),
    theoNam: theoNam,
    tinhTrang: [
      { nhan: 'Đang hoạt động', soLuong: dhd.length }, { nhan: 'Ngừng hoạt động', soLuong: ngung },
      { nhan: 'Xuất hãng', soLuong: xuatHang }
    ],
    phanBoDoi: phanBoDoi,
    thongKeDonVi: thongKeDonVi,
    topChuyen: topCK.topChuyen,
    topKm: topCK.topKm,
    canhBao: canhBao.ds,
    canhBaoTong: canhBao.tong
  };
}

/* Top 10 xe theo tổng số chuyến và tổng km (cộng theo tháng, trong tập xe đã lọc). */
function topChuyenKm_(xeArr) {
  const bien = {}; xeArr.forEach(function (x) { bien[x.id] = x.bien; });
  const sh = readSheet_(CFG_KM_THANG.sheet);
  const iRef = sh.idx(CFG_KM_THANG.refXe), iCh = sh.idx(CFG_KM_THANG.chuyen), iKm = sh.idx(CFG_KM_THANG.km);
  const chuyen = {}, km = {};
  sh.rows.forEach(function (r) {
    const ref = iRef >= 0 ? String(r[iRef] || '').trim() : ''; if (!ref || !(ref in bien)) return;
    const c = iCh >= 0 ? parseFloat(r[iCh]) : 0; if (!isNaN(c)) chuyen[ref] = (chuyen[ref] || 0) + c;
    const k = iKm >= 0 ? parseFloat(r[iKm]) : 0; if (!isNaN(k)) km[ref] = (km[ref] || 0) + k;
  });
  const top = function (obj) {
    return Object.keys(obj).map(function (id) { return { nhan: bien[id] || id, soLuong: Math.round(obj[id]) }; })
      .sort(function (a, b) { return b.soLuong - a.soLuong; }).slice(0, 10);
  };
  return { topChuyen: top(chuyen), topKm: top(km) };
}

/* ---------------- MÀN 3: NHÂN SỰ ---------------- */
function buildNhanSu_(bl) {
  bl = chuanBoLoc_(bl);
  const now = asOf_(bl);
  const coLoc = coLocMaster_(bl);
  const doiInfo = buildDoiInfo_();
  const cdMap = buildDanhMucMap_(CFG_CHUCDANH);
  const sh = readSheet_(CFG_NHANSU.sheet);
  const i = {
    key: sh.idx(CFG_NHANSU.key), ten: sh.idx(CFG_NHANSU.hoTen), gt: sh.idx(CFG_NHANSU.gioiTinh),
    ns: sh.idx(CFG_NHANSU.ngaySinh), loai: sh.idx(CFG_NHANSU.loaiNhanSu), tt: sh.idx(CFG_NHANSU.trangThai),
    refXe: sh.idx(CFG_NHANSU.refXe), doi: sh.idx(CFG_NHANSU.refDoiXe), cd: sh.idx(CFG_NHANSU.refChucDanh),
    dv: sh.idx(CFG_NHANSU.refDonVi), nhan: sh.idx(CFG_NHANSU.ngayNhan)
  };
  let ns = [];
  sh.rows.forEach(function (r) {
    const id = i.key >= 0 ? String(r[i.key] || '').trim() : ''; if (!id) return;
    ns.push({
      id: id, ten: i.ten >= 0 ? String(r[i.ten] || '').trim() : '',
      gt: i.gt >= 0 ? String(r[i.gt] || '').trim() : '', tuoi: i.ns >= 0 ? tuoiTu_(r[i.ns], now) : null,
      loai: i.loai >= 0 ? String(r[i.loai] || '').trim() : '', tt: i.tt >= 0 ? String(r[i.tt] || '').trim() : '',
      coXe: i.refXe >= 0 ? !!String(r[i.refXe] || '').trim() : false,
      doi: i.doi >= 0 ? String(r[i.doi] || '').trim() : '', cd: i.cd >= 0 ? String(r[i.cd] || '').trim() : '',
      dv: i.dv >= 0 ? String(r[i.dv] || '').trim() : '', namLam: i.nhan >= 0 ? thamNienNam_(r[i.nhan], now) : null
    });
  });
  if (bl.donVi) ns = ns.filter(function (x) { return x.dv === bl.donVi; });
  if (bl.doiXe) { const _ds = buildDoiInfo_().soMap; ns = ns.filter(function (x) { return _ds[x.doi] === bl.doiXe; }); }
  if (bl.gioiTinh) ns = ns.filter(function (x) { return x.gt === bl.gioiTinh; });
  if (bl.trangThai) ns = ns.filter(function (x) { return x.tt === bl.trangThai; });
  const restrict = coLoc ? toSet_(ns.map(function (x) { return x.id; })) : null;

  const tong = ns.length;
  const dl = ns.filter(function (x) { return x.tt === CFG_NHANSU.TT_DANG_LAM; });
  const tamNghi = ns.filter(function (x) { return x.tt === CFG_NHANSU.TT_TAM_NGHI; }).length;
  const nghiViec = ns.filter(function (x) { return x.tt === CFG_NHANSU.TT_NGHI_VIEC; }).length;
  const chuaCoXe = dl.filter(function (x) { return !x.coXe; }).length;
  const bhxhSet = activeRefSet_('NHANSU_BHXH', 'Ref_NhanSu', 'TrangThaiBHXH', 'Đang tham gia');
  const chuaBHXH = dl.filter(function (x) { return !bhxhSet[x.id]; }).length;

  // giới tính
  const cGT = { 'Nam': 0, 'Nữ': 0, 'Khác/chưa rõ': 0 };
  ns.forEach(function (x) { if (x.gt === 'Nam') cGT['Nam']++; else if (x.gt === 'Nữ') cGT['Nữ']++; else cGT['Khác/chưa rõ']++; });
  const gioiTinh = Object.keys(cGT).filter(function (k) { return cGT[k] > 0; }).map(function (k) { return { nhan: k, soLuong: cGT[k] }; });
  // độ tuổi + tuổi bình quân
  const buckets = [['<25', 0, 24], ['25–30', 25, 30], ['31–40', 31, 40], ['41–50', 41, 50], ['>50', 51, 200]];
  const doTuoi = buckets.map(function (b) {
    const c = ns.filter(function (x) { return x.tuoi != null && x.tuoi >= b[1] && x.tuoi <= b[2]; }).length;
    return { nhan: b[0], soLuong: c };
  });
  const tuoiArr = ns.map(function (x) { return x.tuoi; }).filter(function (t) { return t != null; });
  const tuoiBinhQuan = tuoiArr.length ? Math.round(tuoiArr.reduce(function (a, b) { return a + b; }, 0) / tuoiArr.length * 10) / 10 : 0;
  // loại nhân sự (thay cho học vấn — dữ liệu thật không có học vấn)
  const cLoai = {}; ns.forEach(function (x) { const k = x.loai || 'Chưa rõ'; cLoai[k] = (cLoai[k] || 0) + 1; });
  const loaiNhanSu = Object.keys(cLoai).map(function (k) { return { nhan: k, soLuong: cLoai[k] }; });
  // THÂM NIÊN LÀM VIỆC (theo NgayNhanViec)
  const tnBuckets = [['Dưới 1 năm', 0, 0], ['1 - 3 năm', 1, 3], ['3 - 5 năm', 4, 5], ['5 - 10 năm', 6, 10], ['Trên 10 năm', 11, 200]];
  const thamNien = tnBuckets.map(function (b) {
    const c = ns.filter(function (x) { return x.namLam != null && x.namLam >= b[1] && x.namLam <= b[2]; }).length;
    return { nhan: b[0], soLuong: c };
  });
  // phân bố đội xe (lái xe đang làm)
  const cDoi = {}; dl.forEach(function (x) { const t = tenDoi_(x.doi, doiInfo); cDoi[t] = (cDoi[t] || 0) + 1; });
  const phanBoDoi = Object.keys(cDoi).map(function (k) { return { nhan: k, soLuong: cDoi[k] }; }).sort(function (a, b) { return b.soLuong - a.soLuong; }).slice(0, 12);

  const masterMap = {};
  ns.forEach(function (x) { masterMap[x.id] = { ten: x.ten, doiXe: tenDoi_(x.doi, doiInfo), phu: cdMap[x.cd] || '', trangThai: x.tt }; });
  const canhBao = danhSachCanhBao_(HOSO_NHAN_SU, now, masterMap, restrict, tuNgay_(bl));

  return {
    capNhat: Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'),
    kpi: {
      tong: tong, dangLam: dl.length, tlDangLam: pct_(dl.length, tong),
      tamNghi: tamNghi, tlTamNghi: pct_(tamNghi, tong), nghiViec: nghiViec, tlNghiViec: pct_(nghiViec, tong),
      chuaCoXe: chuaCoXe, tlChuaCoXe: pct_(chuaCoXe, tong), chuaBHXH: chuaBHXH, tlChuaBHXH: pct_(chuaBHXH, tong)
    },
    gioiTinh: gioiTinh, doTuoi: doTuoi, tuoiBinhQuan: tuoiBinhQuan, loaiNhanSu: loaiNhanSu,
    thamNien: thamNien, phanBoDoi: phanBoDoi, canhBao: canhBao.ds, canhBaoTong: canhBao.tong
  };
}
/* Số năm thâm niên từ ngày vào làm. */
function thamNienNam_(v, now) {
  const d = dateFromAny_(v); if (!d) return null;
  let t = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) t--;
  return (t >= 0 && t <= 60) ? t : null;
}

/* ============================================================
 * GIAI ĐOẠN 3 — MÀN 4: TUÂN THỦ PHÁP LÝ
 *   Tách nhomHoSo của buildTongQuan_ thành 2 bảng PT / NS.
 * ============================================================ */
function buildTuanThu_() {
  const tq = buildTongQuan_();
  const nPT = HOSO_PHUONG_TIEN.length;
  const map = function (h) {
    return { nhom: h.nhom, duDieuKien: h.conHan, sapHet: h.sapHet, quaHan: h.quaHan, thieu: h.thieu, canCo: h.canCo, tyLe: pct_(h.dtConHan, h.canCo) };
  };
  return {
    capNhat: tq.capNhat,
    phuongTien: tq.nhomHoSo.slice(0, nPT).map(map),
    nhanSu: tq.nhomHoSo.slice(nPT).map(map)
  };
}

/* ============================================================
 * GIAI ĐOẠN 4 — MÀN 5: BIẾN ĐỘNG (theo tháng)
 * ============================================================ */
function thangGanNhat_(n, now) {
  const list = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    list.push({ key: d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2), label: ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(), start: start, end: end });
  }
  return list;
}
function ngayHopLe_(v) {
  const d = dateFromAny_(v);
  if (!d) return null;
  const y = d.getFullYear();
  if (y < 1990 || y > new Date().getFullYear() + 1) return null;   // loại ngày rác (vd 2107)
  return d;
}
/* Đọc 1 cột ngày của 1 sheet -> mảng Date hợp lệ. */
function cotNgay_(sheet, col) {
  const sh = readSheet_(sheet); const i = sh.idx(col); const out = [];
  if (i < 0) return out;
  sh.rows.forEach(function (r) { const d = ngayHopLe_(r[i]); if (d) out.push(d); });
  return out;
}
function demTrongThang_(dates, m) { return dates.filter(function (d) { return d >= m.start && d <= m.end; }).length; }
function demTruoc_(dates, mocEnd) { return dates.filter(function (d) { return d <= mocEnd; }).length; }

function buildBienDong_() {
  const now = new Date();
  const months = thangGanNhat_(SO_THANG_BIEN_DONG, now);

  const xeNhap = cotNgay_(CFG_XE.sheet, CFG_XE.ngayHoatDong);
  const xeXuat = cotNgay_(CFG_XE_XUAT_HANG.sheet, CFG_XE_XUAT_HANG.ngayXuat);
  const nsTuyen = cotNgay_(CFG_NHANSU.sheet, CFG_NHANSU.ngayNhan);
  const nsNghi = cotNgay_(CFG_NHANSU.sheet, CFG_NHANSU.ngayNghi);
  // hồ sơ: gộp ngày cấp & ngày hết hạn của 10 bảng
  let hsMoi = [], hsHet = [];
  HOSO_PHUONG_TIEN.concat(HOSO_NHAN_SU).forEach(function (h) {
    hsMoi = hsMoi.concat(cotNgay_(h.sheet, 'NgayCap'));
    hsHet = hsHet.concat(cotNgay_(h.sheet, h.expiry));
  });

  const series = function (nhapArr, xuatArr) {
    return months.map(function (m) {
      const nhap = demTrongThang_(nhapArr, m);
      const xuat = demTrongThang_(xuatArr, m);
      const cuoiKy = demTruoc_(nhapArr, m.end) - demTruoc_(xuatArr, m.end);
      return { ky: m.label, nhap: nhap, xuat: xuat, cuoiKy: cuoiKy };
    });
  };
  const pt = series(xeNhap, xeXuat);
  const ns = series(nsTuyen, nsNghi);
  const hs = series(hsMoi, hsHet);

  const bang = function (s, nhapArr, xuatArr) {
    const dauKy = demTruoc_(nhapArr, new Date(months[0].start.getTime() - 1)) - demTruoc_(xuatArr, new Date(months[0].start.getTime() - 1));
    const nhap = s.reduce(function (a, x) { return a + x.nhap; }, 0);
    const xuat = s.reduce(function (a, x) { return a + x.xuat; }, 0);
    const cuoiKy = s.length ? s[s.length - 1].cuoiKy : dauKy;
    return { dauKy: dauKy, nhap: nhap, xuat: xuat, cuoiKy: cuoiKy, tangGiam: cuoiKy - dauKy };
  };

  return {
    capNhat: Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'),
    soThang: SO_THANG_BIEN_DONG,
    phuongTien: { series: pt, tong: bang(pt, xeNhap, xeXuat) },
    nhanSu: { series: ns, tong: bang(ns, nsTuyen, nsNghi) },
    hoSo: { series: hs, tong: bang(hs, hsMoi, hsHet) }
  };
}

/* ============================================================
 * GIAI ĐOẠN 4 — MÀN 6: BÁO CÁO QUẢN TRỊ
 * ============================================================ */
function danhMucBaoCao_() {
  return [
    { nhom: 'Báo cáo phương tiện', items: [
      { key: 'xe_dang_hoatdong', ten: 'Danh sách xe đang hoạt động' },
      { key: 'xe_xuat_hang', ten: 'Danh sách xe xuất hãng' },
      { key: 'xe_ngung', ten: 'Danh sách xe ngừng hoạt động' },
      { key: 'xe_chua_laixe', ten: 'Danh sách xe chưa có lái xe' }
    ]},
    { nhom: 'Báo cáo nhân sự', items: [
      { key: 'ns_dang_lam', ten: 'Danh sách nhân sự đang làm việc' },
      { key: 'ns_chua_xe', ten: 'Nhân sự chưa được phân công xe' },
      { key: 'ns_chua_bhxh', ten: 'Nhân sự chưa tham gia BHXH' }
    ]},
    { nhom: 'Báo cáo hồ sơ pháp lý', items: [
      { key: 'sap_het_dangkiem', ten: 'Xe sắp/đã hết hạn đăng kiểm' },
      { key: 'sap_het_phuhieu', ten: 'Xe sắp/đã hết hạn phù hiệu' },
      { key: 'sap_het_baohiem', ten: 'Xe sắp/đã hết hạn bảo hiểm' },
      { key: 'sap_het_taximet', ten: 'Xe sắp/đã hết hạn kiểm định taximet' },
      { key: 'xe_thechap', ten: 'Danh sách xe đang thế chấp' },
      { key: 'xe_thoathuan_tnds', ten: 'Thỏa thuận dân sự (TNDS) lái xe' },
      { key: 'ns_sap_het_gplx', ten: 'Lái xe sắp/đã hết hạn GPLX' },
      { key: 'ns_sap_het_skhoe', ten: 'Lái xe sắp/đã hết hạn khám sức khỏe' },
      { key: 'ns_sap_het_daotao', ten: 'Lái xe sắp/đã hết hạn đào tạo/tập huấn' },
      { key: 'ns_sap_het_hdld', ten: 'Hợp đồng lao động sắp/đã hết hạn' },
      { key: 'ns_khenthuong_kyluat', ten: 'Danh sách khen thưởng / kỷ luật' },
      { key: 'lx_vipham_atgt', ten: 'Danh sách vi phạm ATGT' },
      { key: 'lx_vipham_noibo', ten: 'Danh sách vi phạm nội bộ' },
      { key: 'phan_anh', ten: 'Danh sách phản ánh / kiến nghị' }
    ]},
    { nhom: 'Báo cáo tuân thủ', items: [
      { key: 'tt_tong_hop', ten: 'Tổng hợp tuân thủ pháp lý' }
    ]},
    { nhom: 'Báo cáo biến động', items: [
      { key: 'bd_tong_hop', ten: 'Tổng hợp biến động (6 tháng)' }
    ]},
    { nhom: 'Báo cáo tổng hợp', items: [
      { key: 'kpi_tong_hop', ten: 'Bảng chỉ số tổng quan toàn hệ thống' }
    ]}
  ];
}

/* Với mỗi Ref_NhanSu, chọn bản ghi MỚI NHẤT (theo ngayCol) và lấy các trường trong colMap.
 * Trả: { ref -> { outKey: rawValue } } */
function hoSoMoiNhatTheoNS_(sheet, refCol, ngayCol, colMap) {
  const sh = readSheet_(sheet);
  const iRef = sh.idx(refCol), iNgay = ngayCol ? sh.idx(ngayCol) : -1;
  const idxMap = {}; Object.keys(colMap).forEach(function (k) { idxMap[k] = sh.idx(colMap[k]); });
  const best = {};
  sh.rows.forEach(function (r) {
    const ref = iRef >= 0 ? String(r[iRef] || '').trim() : ''; if (!ref) return;
    const d = iNgay >= 0 ? dateFromAny_(r[iNgay]) : null;
    const score = d ? d.getTime() : 1;     // có ngày -> ưu tiên muộn nhất; không ngày -> điểm thấp
    if (!best[ref] || score >= best[ref].score) best[ref] = { score: score, row: r };
  });
  const out = {};
  Object.keys(best).forEach(function (ref) {
    const r = best[ref].row; const o = {};
    Object.keys(idxMap).forEach(function (k) { o[k] = idxMap[k] >= 0 ? r[idxMap[k]] : ''; });
    out[ref] = o;
  });
  return out;
}

/* BÁO CÁO NHÂN SỰ ĐẦY ĐỦ 35 CỘT (đúng định dạng file mẫu của Sở). */
function baoCaoNhanSu35_(now) {
  const doiInfo = buildDoiInfo_();
  const bpMap = buildDanhMucMap_({ sheet: 'DM_BOPHAN', key: 'ID_BoPhan', ten: 'TenBoPhan' });
  const cdMap = buildDanhMucMap_(CFG_CHUCDANH);
  const xsh = readSheet_(CFG_XE.sheet); const xk = xsh.idx(CFG_XE.key), xb = xsh.idx(CFG_XE.bienSo);
  const bienXe = {}; xsh.rows.forEach(function (r) { const id = xk >= 0 ? String(r[xk] || '').trim() : ''; if (id) bienXe[id] = xb >= 0 ? String(r[xb] || '') : ''; });
  // hồ sơ con — bản ghi mới nhất theo từng nhân sự
  const hd = hoSoMoiNhatTheoNS_('NHANSU_HOPDONG_LAODONG', 'Ref_NhanSu', 'NgayKetThuc', { loai: 'LoaiHopDong', so: 'SoHopDong', ky: 'NgayKy', bd: 'NgayBatDau', kt: 'NgayKetThuc', tt: 'TrangThai' });
  const gp = hoSoMoiNhatTheoNS_('LAIXE_GPLX', 'Ref_NhanSu', 'NgayHetHan', { so: 'SoGPLX', hang: 'HangGPLX', cap: 'NgayCap', han: 'NgayHetHan' });
  const sk = hoSoMoiNhatTheoNS_('NHANSU_SUCKHOE', 'Ref_NhanSu', 'NgayHetHan', { kham: 'NgayKham', han: 'NgayHetHan' });
  const dt = hoSoMoiNhatTheoNS_('LAIXE_DAOTAO', 'Ref_NhanSu', 'NgayHetHan', { bd: 'NgayBatDauDaoTao', cap: 'NgayCapChungChi', han: 'NgayHetHan' });
  const tt = hoSoMoiNhatTheoNS_('XE_THOATHUAN_DANSU', 'Ref_LaiXe', 'NgayHetHan', { ky: 'NgayKy', han: 'NgayHetHan' });
  const bh = hoSoMoiNhatTheoNS_('NHANSU_BHXH', 'Ref_NhanSu', 'NgayBatDauThamGia', { so: 'SoSoBHXH', ma: 'MaSoBHXH', tt: 'TrangThaiBHXH', luong: 'MucLuongDongBHXH' });

  const nsh = readSheet_(CFG_NHANSU.sheet);
  const c = {
    key: nsh.idx(CFG_NHANSU.key), ten: nsh.idx(CFG_NHANSU.hoTen), cccd: nsh.idx('CCCD'), ns: nsh.idx(CFG_NHANSU.ngaySinh),
    sdt: nsh.idx('SoDienThoai'), doi: nsh.idx(CFG_NHANSU.refDoiXe), bp: nsh.idx('Ref_BoPhan'), cd: nsh.idx(CFG_NHANSU.refChucDanh),
    tt: nsh.idx(CFG_NHANSU.trangThai), xe: nsh.idx(CFG_NHANSU.refXe)
  };
  const cols = ['STT', 'Họ tên', 'CCCD', 'Ngày sinh', 'Số điện thoại', 'Đội xe', 'Bộ phận', 'Chức danh', 'Trạng thái làm việc',
    'Xe đang lái', 'Biển số xe', 'Loại hợp đồng', 'Số hợp đồng', 'Ngày ký hợp đồng', 'Ngày bắt đầu', 'Ngày kết thúc', 'Trạng thái hợp đồng',
    'Số GPLX', 'Hạng GPLX', 'Ngày cấp GPLX', 'Hạn GPLX', 'Ngày cấp GKSK', 'Hạn sức khỏe', 'Thời gian tập huấn', 'Ngày cấp GCN tập huấn',
    'Ngày hết hạn GCN', 'Ngày ký thoả thuận', 'Ngày kết thúc thoả thuận', 'Số sổ BHXH', 'Mã số BHXH', 'Trạng thái BHXH', 'Mức lương đóng BHXH',
    'Họ tên người bảo lãnh', 'SĐT người bảo lãnh', 'Ghi chú cảnh báo'];
  const S = function (v) { return v == null ? '' : String(v); };
  const D = formatDateVnSafe_;
  const rows = []; let stt = 0;
  nsh.rows.forEach(function (r) {
    const id = c.key >= 0 ? String(r[c.key] || '').trim() : ''; if (!id) return;
    const ttLam = c.tt >= 0 ? String(r[c.tt] || '').trim() : '';
    if (ttLam !== CFG_NHANSU.TT_DANG_LAM) return;     // chỉ nhân sự đang làm việc
    stt++;
    const refXe = c.xe >= 0 ? String(r[c.xe] || '').trim() : '';
    const bien = bienXe[refXe] || (refXe ? '(không tìm thấy xe)' : '');
    const h = hd[id] || {}, g = gp[id] || {}, s = sk[id] || {}, d = dt[id] || {}, th = tt[id] || {}, b = bh[id] || {};
    const thieu = [];
    if (!hd[id]) thieu.push('Hợp đồng lao động');
    if (!gp[id]) thieu.push('GPLX');
    if (!sk[id]) thieu.push('Khám sức khỏe');
    if (!dt[id]) thieu.push('Tập huấn');
    if (!bh[id]) thieu.push('BHXH');
    const ghiChu = thieu.length ? ('Thiếu dữ liệu: ' + thieu.join(', ')) : '';
    rows.push([
      stt, S(c.ten >= 0 ? r[c.ten] : ''), S(c.cccd >= 0 ? r[c.cccd] : ''), D(c.ns >= 0 ? r[c.ns] : ''), S(c.sdt >= 0 ? r[c.sdt] : ''),
      tenDoi_(c.doi >= 0 ? r[c.doi] : '', doiInfo), bpMap[c.bp >= 0 ? String(r[c.bp] || '').trim() : ''] || '', cdMap[c.cd >= 0 ? String(r[c.cd] || '').trim() : ''] || '', ttLam,
      bien, bien,
      S(h.loai), S(h.so), D(h.ky), D(h.bd), D(h.kt), S(h.tt),
      S(g.so), S(g.hang), D(g.cap), D(g.han),
      D(s.kham), D(s.han),
      D(d.bd), D(d.cap), D(d.han),
      D(th.ky), D(th.han),
      S(b.so), S(b.ma), S(b.tt), S(b.luong),
      '', '', ghiChu
    ]);
  });
  return baoCao_('Danh sách nhân sự đang làm việc (đầy đủ 35 cột)', cols, rows);
}

/* Quyết định 1 bản ghi hồ sơ có vào báo cáo không.
 *  - Nếu có khoảng [tu,den]: lấy mọi bản ghi có ngày hết hạn trong khoảng.
 *  - Nếu không: lấy bản ghi QUÁ HẠN hoặc SẮP HẾT tại "now" (như cũ).
 * Trả {con} nếu lấy, null nếu bỏ. */
function locHan_(expVal, now, tu, den) {
  const d = dateFromAny_(expVal);
  if (tu || den) {
    if (!d) return null;
    if (tu && d < tu) return null;
    if (den && d > den) return null;
    return { con: soNgayConLai_(expVal, now) };
  }
  const loai = phanLoaiHan_(expVal, now);
  if (loai !== 'QUA_HAN' && loai !== 'SAP_HET') return null;
  return { con: soNgayConLai_(expVal, now) };
}
function conLaiTxt_(con) { return con < 0 ? ('Quá ' + (-con) + ' ngày') : (con + ' ngày'); }

/* Lọc 1 mốc ngày bất kỳ theo khoảng [tu,den].
 * Không nhập khoảng -> luôn nhận. Có khoảng nhưng ngày trống/ngoài khoảng -> loại. */
function trongKhoangNgay_(v, tu, den) {
  if (!tu && !den) return true;
  const d = dateFromAny_(v);
  if (!d) return false;
  if (tu && d < tu) return false;
  if (den && d > den) return false;
  return true;
}

function buildBaoCao_(key, bl) {
  bl = chuanBoLoc_(bl);
  const now = asOf_(bl);
  const tuHan = tuNgay_(bl);                         // từ ngày (giới hạn dưới ngày hết hạn)
  const denHan = dateFromAny_(bl.denNgay);           // đến ngày (giới hạn trên ngày hết hạn)
  const doiInfo = buildDoiInfo_();
  const xe = docXeKemPhuTro_(doiInfo);                 // map id -> thông tin xe
  const xeArr = Object.keys(xe).map(function (k) { return xe[k]; });

  if (key === 'xe_dang_hoatdong') {
    const rows = xeArr.filter(function (x) { return x.tt === CFG_XE.TT_DANG_HOAT_DONG; })
      .map(function (x) { return [x.bien, x.nhan, x.soCho, x.nam, x.doi, x.tt]; });
    return baoCao_('Danh sách xe đang hoạt động', ['Biển số', 'Nhãn hiệu', 'Số chỗ', 'Năm SX', 'Đội xe', 'Trạng thái'], rows);
  }
  if (key === 'xe_ngung') {
    const rows = xeArr.filter(function (x) { return x.tt === CFG_XE.TT_NGUNG; })
      .filter(function (x) { return trongKhoangNgay_(x.ngayNgung, tuHan, denHan); })
      .map(function (x) { return [x.bien, x.nhan, x.doi, formatDateVnSafe_(x.ngayNgung), x.lyDoNgung]; });
    return baoCao_('Danh sách xe ngừng hoạt động', ['Biển số', 'Nhãn hiệu', 'Đội xe', 'Ngày ngừng', 'Lý do ngừng'], rows);
  }
  if (key === 'xe_xuat_hang') {
    const xh = readSheet_(CFG_XE_XUAT_HANG.sheet); const iR = xh.idx(CFG_XE_XUAT_HANG.refXe), iN = xh.idx(CFG_XE_XUAT_HANG.ngayXuat);
    const rows = [];
    xh.rows.forEach(function (r) {
      const id = String(r[iR] || '').trim(); if (!id || !xe[id]) return;
      if (!trongKhoangNgay_(iN >= 0 ? r[iN] : '', tuHan, denHan)) return;
      rows.push([xe[id].bien, xe[id].nhan, formatDateVnSafe_(iN >= 0 ? r[iN] : '')]);
    });
    return baoCao_('Danh sách xe xuất hãng', ['Biển số', 'Nhãn hiệu', 'Ngày xuất hãng'], rows);
  }
  if (key === 'xe_chua_laixe') {
    const pc = countActiveByRef_(CFG_PHANCONG_XE.sheet, CFG_PHANCONG_XE.refXe, CFG_PHANCONG_XE.trangThai, CFG_PHANCONG_XE.TT_ACTIVE);
    const rows = xeArr.filter(function (x) { return x.tt === CFG_XE.TT_DANG_HOAT_DONG && !(pc[x.id] > 0); })
      .map(function (x) { return [x.bien, x.nhan, x.doi]; });
    return baoCao_('Danh sách xe đang hoạt động chưa có lái xe', ['Biển số', 'Nhãn hiệu', 'Đội xe'], rows);
  }
  if (key === 'xe_thechap') {
    const tc = readSheet_('XE_THECHAP_NGANHANG');
    const iR = tc.idx('Ref_Xe'), iSo = tc.idx('SoHopDongTheChap'), iHan = tc.idx('NgayHetHan'), iSt = tc.idx('TrangThaiTheChap');
    const rows = [];
    tc.rows.forEach(function (r) {
      const id = String(r[iR] || '').trim(); if (!id || !xe[id]) return;
      if (iSt >= 0 && String(r[iSt] || '').trim() !== 'Đang thế chấp') return;
      if (!trongKhoangNgay_(iHan >= 0 ? r[iHan] : '', tuHan, denHan)) return;
      rows.push([xe[id].bien, xe[id].nhan, iSo >= 0 ? r[iSo] : '', formatDateVnSafe_(iHan >= 0 ? r[iHan] : '')]);
    });
    return baoCao_('Danh sách xe đang thế chấp', ['Biển số', 'Nhãn hiệu', 'Số HĐ thế chấp', 'Ngày hết hạn'], rows);
  }
  // báo cáo sắp/đã hết hạn theo hồ sơ phương tiện
  const mapHoSo = { sap_het_dangkiem: 'XE_DANGKIEM', sap_het_phuhieu: 'XE_PHUHIEU', sap_het_baohiem: 'XE_BAOHIEM' };
  if (mapHoSo[key]) {
    const cfg = HOSO_PHUONG_TIEN.filter(function (h) { return h.sheet === mapHoSo[key]; })[0];
    const sh = readSheet_(cfg.sheet); const iR = sh.idx(cfg.ref), iExp = sh.idx(cfg.expiry), iSo = sh.idx('SoDangKiem') >= 0 ? sh.idx('SoDangKiem') : sh.idx('SoPhuHieu');
    const rows = [];
    sh.rows.forEach(function (r) {
      const id = String(r[iR] || '').trim(); if (!id || !xe[id]) return;
      const h = locHan_(iExp >= 0 ? r[iExp] : '', now, tuHan, denHan); if (!h) return;
      rows.push([xe[id].bien, xe[id].doi, iSo >= 0 ? r[iSo] : '', formatDateVnSafe_(iExp >= 0 ? r[iExp] : ''), conLaiTxt_(h.con)]);
    });
    return baoCao_('Xe sắp/đã hết hạn ' + cfg.nhom.toLowerCase(), ['Biển số', 'Đội xe', 'Số hiệu', 'Ngày hết hạn', 'Còn lại'], rows);
  }
  // ----- Báo cáo NHÂN SỰ -----
  if (key === 'ns_dang_lam' || key === 'ns_chua_xe' || key === 'ns_chua_bhxh' || key === 'ns_sap_het_gplx') {
    const cdMap = buildDanhMucMap_(CFG_CHUCDANH);
    const nsh = readSheet_(CFG_NHANSU.sheet);
    const j = { key: nsh.idx(CFG_NHANSU.key), ten: nsh.idx(CFG_NHANSU.hoTen), tt: nsh.idx(CFG_NHANSU.trangThai), refXe: nsh.idx(CFG_NHANSU.refXe), doi: nsh.idx(CFG_NHANSU.refDoiXe), cd: nsh.idx(CFG_NHANSU.refChucDanh) };
    const ns = {};
    nsh.rows.forEach(function (r) {
      const id = j.key >= 0 ? String(r[j.key] || '').trim() : ''; if (!id) return;
      ns[id] = { id: id, ten: j.ten >= 0 ? String(r[j.ten] || '') : '', tt: j.tt >= 0 ? String(r[j.tt] || '').trim() : '',
        coXe: j.refXe >= 0 ? !!String(r[j.refXe] || '').trim() : false, doi: tenDoi_(j.doi >= 0 ? r[j.doi] : '', doiInfo), cd: cdMap[j.cd >= 0 ? String(r[j.cd] || '').trim() : ''] || '' };
    });
    const arr = Object.keys(ns).map(function (k) { return ns[k]; });
    const dl = arr.filter(function (x) { return x.tt === CFG_NHANSU.TT_DANG_LAM; });
    if (key === 'ns_dang_lam') return baoCaoNhanSu35_(now);
    if (key === 'ns_chua_xe') return baoCao_('Nhân sự chưa được phân công xe', ['Họ và tên', 'Đội xe', 'Chức danh'], dl.filter(function (x) { return !x.coXe; }).map(function (x) { return [x.ten, x.doi, x.cd]; }));
    if (key === 'ns_chua_bhxh') {
      const bh = activeRefSet_('NHANSU_BHXH', 'Ref_NhanSu', 'TrangThaiBHXH', 'Đang tham gia');
      return baoCao_('Nhân sự chưa tham gia BHXH', ['Họ và tên', 'Đội xe', 'Chức danh'], dl.filter(function (x) { return !bh[x.id]; }).map(function (x) { return [x.ten, x.doi, x.cd]; }));
    }
    // ns_sap_het_gplx
    const g = readSheet_('LAIXE_GPLX'); const iR = g.idx('Ref_NhanSu'), iSo = g.idx('SoGPLX'), iHan = g.idx('NgayHetHan');
    const rows = [];
    g.rows.forEach(function (r) {
      const id = String(r[iR] || '').trim(); if (!id || !ns[id]) return;
      const h = locHan_(iHan >= 0 ? r[iHan] : '', now, tuHan, denHan); if (!h) return;
      rows.push([ns[id].ten, ns[id].doi, iSo >= 0 ? r[iSo] : '', formatDateVnSafe_(iHan >= 0 ? r[iHan] : ''), conLaiTxt_(h.con)]);
    });
    return baoCao_('Lái xe sắp/đã hết hạn GPLX', ['Họ và tên', 'Đội xe', 'Số GPLX', 'Ngày hết hạn', 'Còn lại'], rows);
  }
  // ----- Báo cáo TUÂN THỦ -----
  if (key === 'tt_tong_hop') {
    const tt = buildTuanThu_();
    const rows = [];
    tt.phuongTien.forEach(function (h) { rows.push(['Phương tiện', h.nhom, h.duDieuKien, h.sapHet, h.quaHan, h.tyLe + '%']); });
    tt.nhanSu.forEach(function (h) { rows.push(['Nhân sự', h.nhom, h.duDieuKien, h.sapHet, h.quaHan, h.tyLe + '%']); });
    return baoCao_('Tổng hợp tuân thủ pháp lý', ['Đối tượng', 'Hạng mục', 'Đủ điều kiện', 'Sắp hết hạn', 'Quá hạn', 'Tỷ lệ tuân thủ'], rows);
  }
  // ----- Báo cáo BIẾN ĐỘNG -----
  if (key === 'bd_tong_hop') {
    const bd = buildBienDong_();
    const r = function (ten, t, l1, l2) { return [ten, t.dauKy, '+' + t.nhap + ' (' + l1 + ')', '-' + t.xuat + ' (' + l2 + ')', t.cuoiKy, (t.tangGiam >= 0 ? '+' : '') + t.tangGiam]; };
    return baoCao_('Tổng hợp biến động ' + bd.soThang + ' tháng gần nhất',
      ['Đối tượng', 'Đầu kỳ', 'Tăng', 'Giảm', 'Cuối kỳ', 'Tăng/giảm'],
      [r('Phương tiện', bd.phuongTien.tong, 'nhập', 'xuất'), r('Nhân sự', bd.nhanSu.tong, 'tuyển', 'nghỉ'), r('Hồ sơ', bd.hoSo.tong, 'mới', 'hết hạn')]);
  }
  // ----- Báo cáo TỔNG HỢP -----
  if (key === 'kpi_tong_hop') {
    const tq = buildTongQuan_();
    const p = tq.kpiPhuongTien, n = tq.kpiNhanSu, h = tq.kpiHoSo;
    return baoCao_('Bảng chỉ số tổng quan toàn hệ thống', ['Chỉ tiêu', 'Giá trị', 'Tỷ lệ'], [
      ['Tổng số xe', p.tong, ''], ['Xe đang hoạt động', p.dangHoatDong, p.tlDangHoatDong + '%'], ['Xe ngừng hoạt động', p.ngung, p.tlNgung + '%'],
      ['Tổng nhân sự', n.tong, ''], ['Nhân sự đang làm việc', n.dangLam, n.tlDangLam + '%'], ['Chưa tham gia BHXH', n.chuaBHXH, n.tlChuaBHXH + '%'],
      ['Tổng hồ sơ pháp lý', h.tong, ''], ['Hồ sơ còn hiệu lực', h.conHieuLuc, h.tlConHieuLuc + '%'], ['Hồ sơ sắp hết hạn', h.sapHetHan, h.tlSapHetHan + '%'], ['Hồ sơ quá hạn', h.quaHan, h.tlQuaHan + '%']
    ]);
  }
  // ===== BÁO CÁO HỒ SƠ PHÁP LÝ BỔ SUNG =====
  // Taximet (hết hạn theo xe)
  if (key === 'sap_het_taximet') {
    return lapBaoCaoHetHan_('Xe sắp/đã hết hạn kiểm định taximet', 'XE_TAXIMET', 'Ref_Xe', 'NgayHetHanKiemDinh',
      _masterXe_(xe), 'Biển số', [{ col: 'SoThietBi', label: 'Số thiết bị' }], now, tuHan, denHan);
  }
  if (key === 'xe_thoathuan_tnds') {
    const m = _masterXe_(xe);
    return lapBaoCaoDanhSach_('Thỏa thuận dân sự (TNDS) lái xe', 'XE_THOATHUAN_DANSU', 'Ref_Xe', m, 'Biển số', [
      { col: 'SoThoaThuan', label: 'Số thỏa thuận' }, { col: 'NgayKy', label: 'Ngày ký', date: true },
      { col: 'NgayHetHan', label: 'Ngày hết hạn', date: true }, { col: 'HinhThucKhoan', label: 'Hình thức khoán' },
      { col: 'TrangThaiThoaThuan', label: 'Trạng thái' }
    ], 'NgayKy', tuHan, denHan);
  }
  // Nhân sự: cần map nhân sự
  if (['ns_sap_het_skhoe', 'ns_sap_het_daotao', 'ns_sap_het_hdld', 'ns_khenthuong_kyluat', 'lx_vipham_atgt', 'lx_vipham_noibo', 'phan_anh'].indexOf(key) >= 0) {
    const cdMap = buildDanhMucMap_(CFG_CHUCDANH);
    const ns = docNhanSuMap_(doiInfo, cdMap);
    if (key === 'ns_sap_het_skhoe')
      return lapBaoCaoHetHan_('Lái xe sắp/đã hết hạn khám sức khỏe', 'NHANSU_SUCKHOE', 'Ref_NhanSu', 'NgayHetHan', ns, 'Họ và tên', [{ col: 'LoaiKhamSucKhoe', label: 'Loại khám' }], now, tuHan, denHan);
    if (key === 'ns_sap_het_daotao')
      return lapBaoCaoHetHan_('Lái xe sắp/đã hết hạn đào tạo/tập huấn', 'LAIXE_DAOTAO', 'Ref_NhanSu', 'NgayHetHan', ns, 'Họ và tên', [{ col: 'NoiDungDaoTao', label: 'Nội dung' }, { col: 'SoChungChi', label: 'Số chứng chỉ' }], now, tuHan, denHan);
    if (key === 'ns_sap_het_hdld')
      return lapBaoCaoHetHan_('Hợp đồng lao động sắp/đã hết hạn', 'NHANSU_HOPDONG_LAODONG', 'Ref_NhanSu', 'NgayKetThuc', ns, 'Họ và tên', [{ col: 'SoHopDong', label: 'Số HĐ' }, { col: 'LoaiHopDong', label: 'Loại HĐ' }], now, tuHan, denHan);
    if (key === 'ns_khenthuong_kyluat')
      return lapBaoCaoDanhSach_('Danh sách khen thưởng / kỷ luật', 'LAIXE_KHENTHUONG_KYLUAT', 'Ref_NhanSu', ns, 'Họ và tên', [
        { col: 'Loai', label: 'Loại' }, { col: 'NgayApDung', label: 'Ngày áp dụng', date: true }, { col: 'NoiDung', label: 'Nội dung' },
        { col: 'HinhThuc', label: 'Hình thức' }, { col: 'MucDo', label: 'Mức độ' }, { col: 'TrangThai', label: 'Trạng thái' }], 'NgayApDung', tuHan, denHan);
    if (key === 'lx_vipham_atgt')
      return lapBaoCaoDanhSach_('Danh sách vi phạm ATGT', 'LAIXE_VIPHAM_ATGT', 'Ref_NhanSu', ns, 'Họ và tên', [
        { col: 'NgayViPham', label: 'Ngày vi phạm', date: true }, { col: 'HanhViViPham', label: 'Hành vi' }, { col: 'SoBienBan', label: 'Số biên bản' },
        { col: 'HinhThucXuLy', label: 'Hình thức xử lý' }, { col: 'SoTienPhat', label: 'Tiền phạt' }, { col: 'TrangThaiXuLy', label: 'Trạng thái' }], 'NgayViPham', tuHan, denHan);
    if (key === 'lx_vipham_noibo')
      return lapBaoCaoDanhSach_('Danh sách vi phạm nội bộ', 'LAIXE_VIPHAM_NOIBO', 'Ref_NhanSu', ns, 'Họ và tên', [
        { col: 'NgayViPham', label: 'Ngày vi phạm', date: true }, { col: 'NoiDungViPham', label: 'Nội dung' }, { col: 'MucDoViPham', label: 'Mức độ' },
        { col: 'HinhThucXuLy', label: 'Hình thức xử lý' }, { col: 'TrangThaiXuLy', label: 'Trạng thái' }], 'NgayViPham', tuHan, denHan);
    if (key === 'phan_anh')
      return lapBaoCaoDanhSach_('Danh sách phản ánh / kiến nghị', 'PHAN_ANH_KHIEU_NAI', 'Ref_NhanSuBiPhanAnh', ns, 'NS bị phản ánh', [
        { col: 'SoVuViec', label: 'Số vụ việc' }, { col: 'NgayPhanAnh', label: 'Ngày phản ánh', date: true }, { col: 'NoiDungPhanAnh', label: 'Nội dung' },
        { col: 'MucDo', label: 'Mức độ' }, { col: 'TrangThaiXuLy', label: 'Trạng thái xử lý' }], 'NgayPhanAnh', tuHan, denHan);
  }
  return baoCao_('Không rõ báo cáo', ['Thông báo'], [['Mã báo cáo không hợp lệ: ' + key]]);
}

function docXeKemPhuTro_(doiInfo) {
  const sh = readSheet_(CFG_XE.sheet);
  const i = {
    key: sh.idx(CFG_XE.key), bien: sh.idx(CFG_XE.bienSo), nhan: sh.idx(CFG_XE.nhanHieu), soCho: sh.idx(CFG_XE.soCho),
    nam: sh.idx(CFG_XE.namSX), tt: sh.idx(CFG_XE.trangThai), doi: sh.idx(CFG_XE.refDoiXe),
    ngayNgung: sh.idx(CFG_XE.ngayNgung), lyDo: sh.idx(CFG_XE.lyDoNgung)
  };
  const map = {};
  sh.rows.forEach(function (r) {
    const id = i.key >= 0 ? String(r[i.key] || '').trim() : ''; if (!id) return;
    map[id] = {
      id: id, bien: i.bien >= 0 ? String(r[i.bien] || '') : '', nhan: i.nhan >= 0 ? String(r[i.nhan] || '') : '',
      soCho: i.soCho >= 0 ? String(r[i.soCho] || '').replace(/\.0+$/, '') : '', nam: i.nam >= 0 ? (namTu_(r[i.nam]) || '') : '',
      tt: i.tt >= 0 ? String(r[i.tt] || '') : '', doi: tenDoi_(i.doi >= 0 ? r[i.doi] : '', doiInfo),
      ngayNgung: i.ngayNgung >= 0 ? r[i.ngayNgung] : '', lyDoNgung: i.lyDo >= 0 ? String(r[i.lyDo] || '') : ''
    };
  });
  return map;
}
/* Chuyển map xe (docXeKemPhuTro_) sang dạng {id->{ten:biển số, doi}} cho báo cáo hết hạn. */
function _masterXe_(xeMap) {
  const out = {};
  Object.keys(xeMap).forEach(function (id) { out[id] = { ten: xeMap[id].bien, doi: xeMap[id].doi }; });
  return out;
}
function formatDateVnSafe_(v) { const d = dateFromAny_(v); return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy') : ''; }

/* Map nhân sự: id -> {ten, doi, cd, tt}. */
function docNhanSuMap_(doiInfo, cdMap) {
  const sh = readSheet_(CFG_NHANSU.sheet);
  const j = { key: sh.idx(CFG_NHANSU.key), ten: sh.idx(CFG_NHANSU.hoTen), tt: sh.idx(CFG_NHANSU.trangThai), doi: sh.idx(CFG_NHANSU.refDoiXe), cd: sh.idx(CFG_NHANSU.refChucDanh) };
  const map = {};
  sh.rows.forEach(function (r) {
    const id = j.key >= 0 ? String(r[j.key] || '').trim() : ''; if (!id) return;
    map[id] = { id: id, ten: j.ten >= 0 ? String(r[j.ten] || '') : '', tt: j.tt >= 0 ? String(r[j.tt] || '').trim() : '',
      doi: tenDoi_(j.doi >= 0 ? r[j.doi] : '', doiInfo), cd: cdMap[j.cd >= 0 ? String(r[j.cd] || '').trim() : ''] || '' };
  });
  return map;
}

/* Báo cáo "sắp/đã hết hạn" tổng quát.
 * sheet+expiry: bảng hồ sơ; refCol: cột tham chiếu; master: map id->{ten,doi}; extra: [{col, label}] cột phụ chèn sau "đối tượng". */
function lapBaoCaoHetHan_(tieuDe, sheet, refCol, expiryCol, master, labelDoiTuong, extra, now, tu, den) {
  const sh = readSheet_(sheet); const iRef = sh.idx(refCol), iExp = sh.idx(expiryCol);
  const exCols = (extra || []).map(function (e) { return e.label; });
  const exIdx = (extra || []).map(function (e) { return sh.idx(e.col); });
  const rows = [];
  sh.rows.forEach(function (r) {
    const ref = iRef >= 0 ? String(r[iRef] || '').trim() : ''; if (!ref) return;
    const m = master[ref]; if (!m) return;
    const h = locHan_(iExp >= 0 ? r[iExp] : '', now, tu, den); if (!h) return;
    const base = [m.ten, m.doi];
    const ex = exIdx.map(function (ci) { return ci >= 0 ? r[ci] : ''; });
    rows.push(base.concat(ex).concat([formatDateVnSafe_(iExp >= 0 ? r[iExp] : ''), conLaiTxt_(h.con)]));
  });
  return baoCao_(tieuDe, [labelDoiTuong, 'Đội xe'].concat(exCols).concat(['Ngày hết hạn', 'Còn lại']), rows);
}

/* Báo cáo "danh sách sự kiện" tổng quát (không theo hạn). cols: [{col,label}]; refCol/master để gắn tên đối tượng (tùy chọn). */
function lapBaoCaoDanhSach_(tieuDe, sheet, refCol, master, labelDoiTuong, cols, rangeCol, tu, den) {
  const sh = readSheet_(sheet);
  const iRef = refCol ? sh.idx(refCol) : -1;
  const iRange = rangeCol ? sh.idx(rangeCol) : -1;
  const idx = cols.map(function (c) { return sh.idx(c.col); });
  const rows = [];
  sh.rows.forEach(function (r) {
    // bỏ dòng rỗng: cần ít nhất 1 ô có dữ liệu trong các cột chọn hoặc cột tham chiếu
    const ref = iRef >= 0 ? String(r[iRef] || '').trim() : '';
    const vals = idx.map(function (ci, k) {
      if (ci < 0) return '';
      const v = r[ci];
      return (cols[k].date) ? formatDateVnSafe_(v) : (v == null ? '' : String(v));
    });
    const coData = ref || vals.some(function (v) { return String(v).trim(); });
    if (!coData) return;
    if ((tu || den) && iRange >= 0 && !trongKhoangNgay_(r[iRange], tu, den)) return;  // lọc theo mốc ngày báo cáo
    const tenDt = (iRef >= 0 && master && master[ref]) ? master[ref].ten : (iRef >= 0 ? ref : '');
    rows.push((labelDoiTuong ? [tenDt] : []).concat(vals));
  });
  const head = (labelDoiTuong ? [labelDoiTuong] : []).concat(cols.map(function (c) { return c.label; }));
  return baoCao_(tieuDe, head, rows);
}

function baoCao_(tieuDe, cols, rows) { return { tieuDe: tieuDe, cols: cols, rows: rows, soDong: rows.length, capNhat: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') }; }

/* ============================================================
 * GIAI ĐOẠN 5 — TẦNG BỘ LỌC + KHOẢNG THỜI GIAN + THỐNG KÊ
 *   bl = { donVi, doiXe, trangThai, gioiTinh, denNgay }
 *   Mọi trường rỗng => KHÔNG lọc (số liệu y hệt trước khi có bộ lọc).
 * ============================================================ */
function chuanBoLoc_(bl) {
  bl = bl || {};
  return {
    donVi: String(bl.donVi || '').trim(), doiXe: String(bl.doiXe || '').trim(),
    trangThai: String(bl.trangThai || '').trim(), gioiTinh: String(bl.gioiTinh || '').trim(),
    tuNgay: String(bl.tuNgay || '').trim(), denNgay: String(bl.denNgay || '').trim()
  };
}
/* Ngày "tra cứu tại thời điểm" (đến ngày) — mặc định hôm nay. */
function asOf_(bl) { const d = dateFromAny_(chuanBoLoc_(bl).denNgay); return d || new Date(); }
/* Giới hạn dưới (từ ngày) cho danh sách tra cứu — null nếu không nhập. */
function tuNgay_(bl) { return dateFromAny_(chuanBoLoc_(bl).tuNgay); }
/* Có áp bất kỳ lọc master nào không (để quyết định có giới hạn hồ sơ). */
function coLocMaster_(bl) { bl = chuanBoLoc_(bl); return !!(bl.donVi || bl.doiXe || bl.trangThai || bl.gioiTinh); }

/* Thông tin đội xe HỢP NHẤT 2 bảng:
 *   - DM_DOIXE_MOI: nhân sự trỏ vào (ID -> SoDoiXe số, TenDoiXe = tên khu vực "Nam Hồng")
 *   - DM_DOIXE (cũ): xe trỏ vào (ID -> TenDoiXe = SỐ đội)
 * Trả: { soMap:{ID->"2"}, tenBySo:{"2"->"Đội 2 - Nam Hồng"}, list:[{id:"2",ten:"Đội 2 - Nam Hồng"}] } */
function buildDoiInfo_() {
  const soMap = {}; const tenBySo = {};
  // Bảng MỚI (nhân sự)
  const m = readSheet_(CFG_DOIXE_MOI.sheet);
  const mId = m.idx(CFG_DOIXE_MOI.key), mSo = m.idx(CFG_DOIXE_MOI.so), mTen = m.idx(CFG_DOIXE_MOI.ten);
  m.rows.forEach(function (r) {
    const id = mId >= 0 ? String(r[mId] || '').trim() : ''; if (!id) return;
    const so = mSo >= 0 ? String(r[mSo] || '').replace(/\.0+$/, '').trim() : '';
    const ten = mTen >= 0 ? String(r[mTen] || '').trim() : '';
    if (so) { soMap[id] = so; if (so && !tenBySo[so]) tenBySo[so] = 'Đội ' + so + (ten ? ' - ' + ten : ''); }
  });
  // Bảng CŨ (xe): TenDoiXe = số; KhuVucHoatDong = tên
  const c = readSheet_(CFG_DOIXE.sheet);
  const cId = c.idx(CFG_DOIXE.key), cTen = c.idx(CFG_DOIXE.ten), cKv = c.idx('KhuVucHoatDong');
  c.rows.forEach(function (r) {
    const id = cId >= 0 ? String(r[cId] || '').trim() : ''; if (!id) return;
    const so = cTen >= 0 ? String(r[cTen] || '').replace(/\.0+$/, '').trim() : '';
    if (!so) return;
    if (!soMap[id]) soMap[id] = so;
    if (!tenBySo[so]) { const kv = cKv >= 0 && r[cKv] ? String(r[cKv]).trim() : ''; tenBySo[so] = 'Đội ' + so + (kv ? ' - ' + kv : ''); }
  });
  const list = Object.keys(tenBySo).sort(function (a, b) {
    const na = parseInt(a, 10), nb = parseInt(b, 10);
    return (isNaN(na) ? 9999 : na) - (isNaN(nb) ? 9999 : nb);
  }).map(function (so) { return { id: so, ten: tenBySo[so] }; });
  return { soMap: soMap, tenBySo: tenBySo, list: list };
}
/* Tên đội từ Ref_DoiXe qua thông tin hợp nhất. */
function tenDoi_(refId, doiInfo) {
  const id = String(refId || '').trim();
  if (!id) return 'Chưa gán đội';
  const so = doiInfo.soMap[id];
  if (!so) return 'Chưa gán đội';
  return doiInfo.tenBySo[so] || ('Đội ' + so);
}

/* Danh mục cho thanh bộ lọc. */
function getDanhMucBoLoc() {
  try {
    const dv = buildDanhMucMap_(CFG_DONVI);
    const donVi = Object.keys(dv).map(function (id) { return { id: id, ten: dv[id] }; }).filter(function (x) { return x.ten; });
    const doi = buildDoiInfo_();
    return { ok: true, data: {
      donVi: donVi,
      doiXe: doi.list,
      trangThaiXe: [CFG_XE.TT_DANG_HOAT_DONG, CFG_XE.TT_NGUNG],
      trangThaiNS: [CFG_NHANSU.TT_DANG_LAM, CFG_NHANSU.TT_TAM_NGHI, CFG_NHANSU.TT_NGHI_VIEC],
      gioiTinh: ['Nam', 'Nữ']
    }};
  } catch (e) { return { ok: false, message: e.message }; }
}
