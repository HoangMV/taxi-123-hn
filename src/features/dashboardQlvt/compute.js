import { parseDateValue } from '../../lib/dateFormat';
import {
  NGUONG_SAP_HET_HAN_NGAY,
  NHOM_HOSO_NHAN_SU,
  NHOM_HOSO_PHUONG_TIEN,
  SO_THANG_BIEN_DONG
} from './constants';
import { cleanValue, normalizeText, warningDaysLeft } from './filters';

/* ============================================================
 * compute.js — Bộ máy tổng hợp cho các màn (port logic từ .gs).
 *   Tính hoàn toàn ở client trên data.reports.xe/nhanSu.
 *   Mỗi row đã có warningItems[{ name, date, level, days }]
 *   với level = 'do' (quá hạn) | 'vang' (sắp hết) | 'xanh' (còn hạn).
 * ============================================================ */

const pct = (a, b) => {
  const total = Number(b) || 0;
  if (!total) return 0;
  return Math.round((Number(a) / total) * 1000) / 10;
};

// Phân loại trạng thái nhân sự rạch ròi để không đếm trùng:
//   - Tạm nghỉ  : trạng thái chứa "tam nghi"
//   - Đã nghỉ   : chứa "nghi" nhưng KHÔNG phải tạm nghỉ
//   - Đang làm  : có trạng thái và không chứa "nghi"
const isTamNghi = (row) => normalizeText(row.trangThaiLamViec).includes('tam nghi');
const isNghiViec = (row) => normalizeText(row.trangThaiLamViec).includes('nghi') && !isTamNghi(row);
const isActiveNhanSu = (row) => Boolean(cleanValue(row.trangThaiLamViec)) && !normalizeText(row.trangThaiLamViec).includes('nghi');
const isActiveXe = (row) => Boolean(cleanValue(row.trangThaiXe)) && !normalizeText(row.trangThaiXe).includes('ngung');
const isNgungXe = (row) => normalizeText(row.trangThaiXe).includes('ngung');

const warningItems = (row) => (Array.isArray(row.warningItems) ? row.warningItems : []);

// Row có ít nhất 1 hồ sơ quá hạn / sắp hết trong danh mục cho trước.
function itemFor(row, name) {
  return warningItems(row).find((item) => normalizeText(item.name) === normalizeText(name));
}

/* ---------- KPI PHƯƠNG TIỆN ---------- */
export function buildKpiPhuongTien(xeRows) {
  const rows = Array.isArray(xeRows) ? xeRows : [];
  const tong = rows.length;
  const dangHoatDong = rows.filter(isActiveXe).length;
  const ngung = rows.filter(isNgungXe).length;
  const xuatHang = rows.filter((row) => normalizeText(row.trangThaiXe).includes('xuat hang')).length;
  const chuaPhanCong = rows.filter((row) => isActiveXe(row) && !cleanValue(row.laiXeDangLai)).length;
  const nhieuLaiXe = rows.filter((row) => isActiveXe(row) && Number(row.soLaiXe) >= 2).length;
  return {
    tong,
    dangHoatDong,
    tlDangHoatDong: pct(dangHoatDong, tong),
    xuatHang,
    tlXuatHang: pct(xuatHang, tong),
    ngung,
    tlNgung: pct(ngung, tong),
    chuaPhanCong,
    tlChuaPhanCong: pct(chuaPhanCong, tong),
    nhieuLaiXe,
    tlNhieuLaiXe: pct(nhieuLaiXe, tong)
  };
}

/* ---------- Thống kê xe theo đơn vị (Màn Phương tiện) ---------- */
export function buildThongKeDonVi(xeRows) {
  const map = new Map();
  (Array.isArray(xeRows) ? xeRows : []).forEach((row) => {
    const ten = cleanValue(row.donViChuQuan) || 'Chưa gán đơn vị';
    if (!map.has(ten)) map.set(ten, { donVi: ten, tong: 0, dangHD: 0, xuatHang: 0, ngung: 0, chuaPC: 0 });
    const o = map.get(ten);
    o.tong += 1;
    if (isActiveXe(row)) { o.dangHD += 1; if (!cleanValue(row.laiXeDangLai)) o.chuaPC += 1; }
    if (isNgungXe(row)) o.ngung += 1;
    if (normalizeText(row.trangThaiXe).includes('xuat hang')) o.xuatHang += 1;
  });
  return [...map.values()].sort((a, b) => b.tong - a.tong);
}

/* ---------- Cơ cấu nhân sự: giới tính / độ tuổi / thâm niên / loại ---------- */
function tuoiTu(ngayStr, now) {
  const d = parseDateValue(ngayStr);
  if (!d) return null;
  let t = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) t -= 1;
  return (t >= 0 && t <= 100) ? t : null;
}
function thamNienTu(ngayStr, now) {
  const t = tuoiTu(ngayStr, now);
  return t; // cùng công thức năm chênh lệch
}

export function buildCoCauNhanSu(nhanSuRows, now = new Date()) {
  const rows = Array.isArray(nhanSuRows) ? nhanSuRows : [];

  // Giới tính
  const gt = { Nam: 0, 'Nữ': 0, 'Khác/chưa rõ': 0 };
  rows.forEach((r) => {
    const g = normalizeText(r.gioiTinh);
    if (g === 'nam') gt.Nam += 1;
    else if (g === 'nu') gt['Nữ'] += 1;
    else gt['Khác/chưa rõ'] += 1;
  });
  const gioiTinh = Object.keys(gt).filter((k) => gt[k] > 0).map((k) => ({ label: k, value: gt[k] }));

  // Độ tuổi + tuổi bình quân
  const buckets = [['<25', 0, 24], ['25–30', 25, 30], ['31–40', 31, 40], ['41–50', 41, 50], ['>50', 51, 200]];
  const tuoiArr = rows.map((r) => tuoiTu(r.ngaySinh, now)).filter((t) => t != null);
  const doTuoi = buckets.map(([label, lo, hi]) => ({ label, value: tuoiArr.filter((t) => t >= lo && t <= hi).length }));
  const tuoiBinhQuan = tuoiArr.length ? Math.round((tuoiArr.reduce((a, b) => a + b, 0) / tuoiArr.length) * 10) / 10 : 0;

  // Thâm niên (theo ngày nhận việc)
  const tnBuckets = [['Dưới 1 năm', 0, 0], ['1–3 năm', 1, 3], ['3–5 năm', 4, 5], ['5–10 năm', 6, 10], ['Trên 10 năm', 11, 200]];
  const tnArr = rows.map((r) => thamNienTu(r.ngayNhanViec, now)).filter((t) => t != null);
  const thamNien = tnBuckets.map(([label, lo, hi]) => ({ label, value: tnArr.filter((t) => t >= lo && t <= hi).length }));

  // Loại nhân sự
  const cLoai = {};
  rows.forEach((r) => { const k = cleanValue(r.loaiNhanSu) || 'Chưa rõ'; cLoai[k] = (cLoai[k] || 0) + 1; });
  const loaiNhanSu = Object.keys(cLoai).map((k) => ({ label: k, value: cLoai[k] }));

  return { gioiTinh, doTuoi, tuoiBinhQuan, thamNien, loaiNhanSu };
}

/* ---------- KPI NHÂN SỰ ---------- */
export function buildKpiNhanSu(nhanSuRows) {
  const rows = Array.isArray(nhanSuRows) ? nhanSuRows : [];
  const tong = rows.length;
  const dangLam = rows.filter(isActiveNhanSu);
  const tamNghi = rows.filter(isTamNghi).length;
  const nghiViec = rows.filter(isNghiViec).length;
  const chuaCoXe = dangLam.filter((row) => !cleanValue(row.bienSoXe) && !cleanValue(row.xeDangLai)).length;
  const chuaBHXH = dangLam.filter((row) => !normalizeText(row.trangThaiBhxh).includes('dang tham gia')).length;
  return {
    tong,
    dangLam: dangLam.length,
    tlDangLam: pct(dangLam.length, tong),
    tamNghi,
    tlTamNghi: pct(tamNghi, tong),
    nghiViec,
    tlNghiViec: pct(nghiViec, tong),
    chuaCoXe,
    tlChuaCoXe: pct(chuaCoXe, tong),
    chuaBHXH,
    tlChuaBHXH: pct(chuaBHXH, tong)
  };
}

/* ---------- Tổng hợp 1 nhóm hồ sơ (tuân thủ theo đối tượng) ---------- */
// activeRows = đối tượng đang hoạt động (cần có hồ sơ).
function tichHopHoSo(activeRows, nhom) {
  let conHan = 0;
  let sapHet = 0;
  let quaHan = 0;
  let thieu = 0;
  let dtConHan = 0; // đối tượng có hồ sơ còn/sắp hết (vẫn hiệu lực)
  activeRows.forEach((row) => {
    const item = itemFor(row, nhom.name);
    if (!item || !cleanValue(item.date)) {
      thieu += 1;
      return;
    }
    const level = normalizeText(item.level);
    if (level === 'do') quaHan += 1;
    else if (level === 'vang') { sapHet += 1; dtConHan += 1; }
    else { conHan += 1; dtConHan += 1; }
  });
  const canCo = activeRows.length;
  return {
    nhom: nhom.nhan,
    name: nhom.name,
    conHan,
    sapHet,
    quaHan,
    thieu,
    canCo,
    dtConHan,
    tyLe: pct(dtConHan, canCo)
  };
}

/* ---------- TUÂN THỦ (Màn 4) ----------
 * Ưu tiên hoSoSummary từ backend (đếm toàn bộ 10 bảng, khớp .gs).
 * Fallback: tính gần đúng từ warningItems khi backend chưa trả. */
export function buildTuanThu(nhanSuRows, xeRows, hoSoSummary) {
  if (hoSoSummary && Array.isArray(hoSoSummary.nhom) && hoSoSummary.nhom.length) {
    const map = (scope) => hoSoSummary.nhom.filter((n) => n.scope === scope);
    return { phuongTien: map('xe'), nhanSu: map('ns') };
  }
  const activeXe = (Array.isArray(xeRows) ? xeRows : []).filter(isActiveXe);
  const activeNs = (Array.isArray(nhanSuRows) ? nhanSuRows : []).filter(isActiveNhanSu);
  return {
    phuongTien: NHOM_HOSO_PHUONG_TIEN.map((nhom) => tichHopHoSo(activeXe, nhom)),
    nhanSu: NHOM_HOSO_NHAN_SU.map((nhom) => tichHopHoSo(activeNs, nhom))
  };
}

/* ---------- KPI HỒ SƠ + tỷ lệ tuân thủ tổng (Màn 1) ---------- */
export function buildKpiHoSo(nhanSuRows, xeRows, hoSoSummary) {
  // Nếu backend đã trả tổng hợp toàn cục thì dùng thẳng (khớp .gs).
  if (hoSoSummary && Number.isFinite(hoSoSummary.tong)) {
    const s = hoSoSummary;
    const tong = s.tong || (s.conHan + s.sapHet + s.quaHan);
    const tt = buildTuanThu(nhanSuRows, xeRows, hoSoSummary);
    const all = [...tt.phuongTien, ...tt.nhanSu];
    return {
      kpi: {
        tong,
        conHieuLuc: s.conHan,
        tlConHieuLuc: pct(s.conHan, tong),
        sapHetHan: s.sapHet,
        tlSapHetHan: pct(s.sapHet, tong),
        quaHan: s.quaHan,
        tlQuaHan: pct(s.quaHan, tong),
        thieuHoSo: s.thieuHoSo
      },
      tyLeTuanThu: all.map((x) => ({ nhom: x.nhom, tyLe: x.tyLe, conHan: x.dtConHan, canCo: x.canCo })),
      canhBaoNhom: all
        .map((x) => ({ nhom: x.nhom, quaHan: x.quaHan, sapHet: x.sapHet }))
        .filter((x) => x.quaHan || x.sapHet)
        .sort((a, b) => b.quaHan - a.quaHan),
      tongQuaHan: s.quaHan,
      tongSapHet: s.sapHet
    };
  }
  const tt = buildTuanThu(nhanSuRows, xeRows);
  const all = [...tt.phuongTien, ...tt.nhanSu];
  const conHieuLuc = all.reduce((sum, x) => sum + x.conHan, 0);
  const sapHetHan = all.reduce((sum, x) => sum + x.sapHet, 0);
  const quaHan = all.reduce((sum, x) => sum + x.quaHan, 0);
  const thieuHoSo = all.reduce((sum, x) => sum + x.thieu, 0);
  const tong = conHieuLuc + sapHetHan + quaHan;
  return {
    kpi: {
      tong,
      conHieuLuc,
      tlConHieuLuc: pct(conHieuLuc, tong),
      sapHetHan,
      tlSapHetHan: pct(sapHetHan, tong),
      quaHan,
      tlQuaHan: pct(quaHan, tong),
      thieuHoSo
    },
    tyLeTuanThu: all.map((x) => ({ nhom: x.nhom, tyLe: x.tyLe, conHan: x.dtConHan, canCo: x.canCo })),
    canhBaoNhom: all
      .map((x) => ({ nhom: x.nhom, quaHan: x.quaHan, sapHet: x.sapHet }))
      .filter((x) => x.quaHan || x.sapHet)
      .sort((a, b) => b.quaHan - a.quaHan),
    tongQuaHan: quaHan,
    tongSapHet: sapHetHan
  };
}

/* ---------- Danh sách cảnh báo chi tiết (quá hạn + sắp hết) ---------- */
export function buildCanhBaoList(rows, { hoTenKey, phuKey, doiKey = 'doiXe', trangThaiKey } = {}) {
  const out = [];
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    warningItems(row).forEach((item) => {
      const level = normalizeText(item.level);
      if (level !== 'do' && level !== 'vang') return;
      out.push({
        ten: cleanValue(row[hoTenKey]),
        doiXe: cleanValue(row[doiKey]),
        phu: cleanValue(row[phuKey]),
        trangThai: cleanValue(row[trangThaiKey]),
        hangMuc: item.name,
        ngayHetHan: item.date,
        soNgayConLai: warningDaysLeft(item)
      });
    });
  });
  out.sort((a, b) => (a.soNgayConLai ?? 9999) - (b.soNgayConLai ?? 9999));
  return out;
}

/* ---------- BIẾN ĐỘNG theo tháng (Màn 5) ---------- */
function thangGanNhat(n, now) {
  const list = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    list.push({
      label: `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
      start,
      end
    });
  }
  return list;
}

function ngayHopLe(value) {
  const d = parseDateValue(value);
  if (!d) return null;
  const y = d.getFullYear();
  if (y < 1990 || y > new Date().getFullYear() + 1) return null;
  return d;
}

function cotNgay(rows, key) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ngayHopLe(row[key]))
    .filter(Boolean);
}

const demTrongThang = (dates, m) => dates.filter((d) => d >= m.start && d <= m.end).length;
const demTruoc = (dates, mocEnd) => dates.filter((d) => d <= mocEnd).length;

export function buildBienDong(nhanSuRows, xeRows, now = new Date()) {
  const months = thangGanNhat(SO_THANG_BIEN_DONG, now);
  const xeNhap = cotNgay(xeRows, 'ngayDuaVaoHoatDong');
  const xeXuat = cotNgay(xeRows, 'ngayNgungHoatDong');
  const nsTuyen = cotNgay(nhanSuRows, 'ngayNhanViec');
  const nsNghi = cotNgay(nhanSuRows, 'ngayNghiViec');

  const series = (nhapArr, xuatArr) => months.map((m) => ({
    ky: m.label,
    nhap: demTrongThang(nhapArr, m),
    xuat: demTrongThang(xuatArr, m),
    cuoiKy: demTruoc(nhapArr, m.end) - demTruoc(xuatArr, m.end)
  }));

  const tong = (s, nhapArr, xuatArr) => {
    const dauKy = demTruoc(nhapArr, new Date(months[0].start.getTime() - 1)) - demTruoc(xuatArr, new Date(months[0].start.getTime() - 1));
    const nhap = s.reduce((a, x) => a + x.nhap, 0);
    const xuat = s.reduce((a, x) => a + x.xuat, 0);
    const cuoiKy = s.length ? s[s.length - 1].cuoiKy : dauKy;
    return { dauKy, nhap, xuat, cuoiKy, tangGiam: cuoiKy - dauKy };
  };

  const pt = series(xeNhap, xeXuat);
  const ns = series(nsTuyen, nsNghi);
  const cur = months[months.length - 1];

  return {
    soThang: SO_THANG_BIEN_DONG,
    kyLabel: cur.label,
    phuongTien: { series: pt, tong: tong(pt, xeNhap, xeXuat) },
    nhanSu: { series: ns, tong: tong(ns, nsTuyen, nsNghi) },
    // biến động tháng này (dùng cho thẻ ở Màn 1)
    thangNay: {
      xeNhap: demTrongThang(xeNhap, cur),
      xeXuat: demTrongThang(xeXuat, cur),
      nsTuyen: demTrongThang(nsTuyen, cur),
      nsNghi: demTrongThang(nsNghi, cur)
    }
  };
}

export { pct };
