/****************************************************
 * HỒ SƠ NHÂN SỰ ĐIỆN TỬ - BACKEND BUILDER
 *
 * Port logic từ Apps Script HoSoNhanSu.gs (buildProfileDataV9_ và các hàm phụ)
 * sang Node để phục vụ trang public/nhan_su_profile_standalone.html.
 *
 * Cách dùng giống vehicle-profile-builder.cjs: đọc các bảng Google Sheets,
 * chọn bản ghi hiện hành theo vòng đời giấy tờ, dựng object profile cho frontend.
 ****************************************************/

const { cleanValue, readGoogleSheetTables } = require('./google-sheets-service.cjs');

const WARNING_DAYS = 30;

// Các bảng cần đọc. Tên lấy theo CONFIG_HS_NS.SHEETS trong HoSoNhanSu.gs.
// Mỗi phần tử là 1 tên bảng, hoặc mảng tên thay thế (đọc bảng đầu tiên có dữ liệu).
const NHAN_SU_PROFILE_TABLES = [
  'NHANSU',
  'NHANSU_QUATRINH_CONGTAC',
  'NHANSU_HOPDONG_LAODONG',
  'LAIXE_GPLX',
  'NHANSU_SUCKHOE',
  'NHANSU_BHXH',
  'LAIXE_PHANCONG_XE',
  'XE_THOATHUAN_DANSU',
  'NHANSU_HOSO_CANHAN',
  'NHANSU_NGUOITHAN',
  'LAIXE_DAOTAO',
  'HS_DAOTAO',
  'CT_HS_DAOTAO',
  'LAIXE_KHENTHUONG_KYLUAT',
  'LAIXE_TAINAN',
  'LAIXE_VIPHAM_ATGT',
  'LAIXE_VIPHAM_NOIBO',
  ['PHUHIEUXE', 'XE_PHUHIEU', 'XE_PHU_HIEU', 'PHU_HIEU_XE'],
  'XE',
  'DONVI',
  'DM_DOIXE',
  'DM_DOIXE_MOI',
  'DM_BOPHAN',
  'DM_CHUCDANH',
  'DM_MUCLUONG_DONGBHXH',
  'DM_BENHVIEN',
  'DM_LOAI_GIAYTO',
  'DM_LOAI_VIPHAM',
  ['DM_DONVI_DAOTAO', 'DM_CO_SO_DAOTAO', 'DM_COSO_DAOTAO', 'DM_TRUNGTAM_DAOTAO'],
  ['DM_HINHTHUC_XULY', 'DM_HINHTHUC_XULY_VIPHAM', 'DM_HINH_THUC_XU_LY', 'DM_XULY_VIPHAM']
];

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

// Đọc các bảng, chấp nhận tên thay thế. Trả về object keyed theo tên chuẩn (phần tử [0]).
async function readNhanSuTables(tableSpecs, env) {
  const profileEnv = {
    ...env,
    GOOGLE_SHEETS_DEFAULT_RANGE: env.GOOGLE_SHEETS_DEFAULT_RANGE || 'A:ZZ'
  };

  // Gom toàn bộ tên thực tế để đọc theo lô, sau đó ánh xạ về tên chuẩn.
  const allNames = [];
  tableSpecs.forEach((spec) => {
    (Array.isArray(spec) ? spec : [spec]).forEach((name) => {
      if (!allNames.includes(name)) allNames.push(name);
    });
  });

  const raw = {};
  const missingSources = [];

  for (const chunk of chunkArray(allNames, 4)) {
    try {
      Object.assign(raw, await readGoogleSheetTables(chunk, profileEnv));
    } catch (chunkError) {
      for (const tableName of chunk) {
        try {
          Object.assign(raw, await readGoogleSheetTables([tableName], profileEnv));
        } catch (tableError) {
          raw[tableName] = [];
          missingSources.push({
            table: tableName,
            message: tableError.message || chunkError.message || 'Không đọc được bảng Google Sheets.'
          });
        }
      }
    }
  }

  const tables = {};
  tableSpecs.forEach((spec) => {
    const names = Array.isArray(spec) ? spec : [spec];
    const canonical = names[0];
    const chosen = names.find((name) => Array.isArray(raw[name]) && raw[name].length > 0);
    tables[canonical] = chosen ? raw[chosen] : (raw[names[0]] || []);
  });

  // Bảng đội xe có 2 nguồn, gộp lại.
  const onlyMissing = missingSources.filter((item) => {
    if (item.table === 'DM_DOIXE' || item.table === 'DM_DOIXE_MOI') {
      const hasAny = (tables.DM_DOIXE || []).length > 0 || (tables.DM_DOIXE_MOI || []).length > 0;
      return !hasAny;
    }
    // Bỏ qua báo thiếu với các bảng có tên thay thế đã đọc được từ tên khác.
    const spec = tableSpecs.find((s) => (Array.isArray(s) ? s : [s]).includes(item.table));
    if (spec) {
      const canonical = Array.isArray(spec) ? spec[0] : spec;
      if ((tables[canonical] || []).length > 0) return false;
    }
    return true;
  });

  return { tables, missingSources: onlyMissing };
}

/* ===================== HELPER CHUẨN HÓA / NGÀY ===================== */

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalize(value) {
  return text(value)
    .replace(/Đ/g, 'D')
    .replace(/đ/g, 'd')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function firstNotBlank(values) {
  for (const value of Array.isArray(values) ? values : []) {
    const cleaned = text(value);
    if (cleaned) return cleaned;
  }
  return '';
}

function get(row, key) {
  if (!row || !key) return '';
  const value = row[key];
  return value === null || value === undefined ? '' : value;
}

// Parse ngày: ưu tiên ISO yyyy-MM-dd, sau đó dd/MM/yyyy (heuristic giống dateNumberV9_).
function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const raw = text(value);
  if (!raw) return null;
  const datePart = raw.split(/\s+/)[0];

  let match = datePart.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (match) {
    return validDate(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  match = datePart.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (match) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    const year = Number(match[3]);
    let day;
    let month;
    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      month = a;
      day = b;
    } else {
      day = a;
      month = b; // DMY mặc định theo dữ liệu Việt Nam.
    }
    return validDate(year, month, day);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function validDate(year, month, day) {
  if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function dateNumber(value) {
  const date = parseDate(value);
  return date ? date.getTime() : 0;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return '';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function formatDateTime(value) {
  const date = value instanceof Date ? value : (parseDate(value) || new Date());
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatDateRange(fromValue, toValue) {
  const from = formatDate(fromValue);
  const to = formatDate(toValue);
  if (from && to) return `${from} - ${to}`;
  return from || to || '';
}

function daysDiff(value) {
  const target = dateNumber(value);
  if (!target) return 0;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.ceil((target - today) / 86400000);
}

function money(value) {
  const raw = text(value);
  if (!raw) return '';
  const number = Number(raw.replace(/\./g, '').replace(',', '.'));
  return !Number.isNaN(number) && number > 0 ? number.toLocaleString('vi-VN') : raw;
}

function isTechnicalId(value) {
  const raw = text(value);
  if (!raw) return false;
  return /^[A-Za-z0-9_-]{6,16}$/.test(raw) && raw.indexOf(' ') < 0;
}

/* ===================== MAP DANH MỤC ===================== */

function nameMap(rows, keyCandidates, nameCandidates) {
  const map = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = firstNotBlank(keyCandidates.map((k) => get(row, k)));
    const name = firstNotBlank(nameCandidates.map((k) => get(row, k)));
    if (key && name) map[key] = name;
  });
  return map;
}

function indexByCandidates(rows, keyCandidates) {
  const map = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = firstNotBlank(keyCandidates.map((k) => get(row, k)));
    if (key && !map[key]) map[key] = row;
  });
  return map;
}

function buildMaps(tables) {
  const doiXeRows = [...(tables.DM_DOIXE || []), ...(tables.DM_DOIXE_MOI || [])];
  return {
    nhanSuName: nameMap(tables.NHANSU, ['ID_NhanSu'], ['HoTen']),
    xeById: indexByCandidates(tables.XE, ['ID_Xe', 'IDXe']),
    xeName: nameMap(tables.XE, ['ID_Xe', 'IDXe'], ['BienSo', 'Biển số', 'BienSoXe']),
    donViName: nameMap(tables.DONVI, ['ID_DonVi', 'ID_DonViQuanLy', 'ID_DonViVanTai'], ['TenDonVi', 'Tên đơn vị']),
    doiXeName: nameMap(doiXeRows, ['ID_DoiXe'], ['TenDoiXe', 'Đội xe']),
    boPhanName: nameMap(tables.DM_BOPHAN, ['ID_BoPhan'], ['TenBoPhan', 'Bộ phận']),
    chucDanhName: nameMap(tables.DM_CHUCDANH, ['ID_ChucDanh'], ['TenChucDanh', 'Chức danh']),
    mucLuongName: nameMap(tables.DM_MUCLUONG_DONGBHXH, ['ID_MucLuong'], ['MucLuong', 'Mức lương']),
    benhVienName: nameMap(tables.DM_BENHVIEN, ['ID_BenhVien'], ['TenBenhVien', 'Tên bệnh viện', 'TenCoSoKham']),
    loaiGiayToName: nameMap(tables.DM_LOAI_GIAYTO, ['ID_LoaiGiayTo', 'MaLoaiGiayTo'], ['TenLoaiGiayTo', 'Tên loại giấy tờ']),
    loaiViPhamName: nameMap(tables.DM_LOAI_VIPHAM, ['ID_LoaiViPham', 'MaLoaiViPham'], ['TenLoaiViPham', 'Tên loại vi phạm']),
    hinhThucXuLyName: nameMap(
      tables.DM_HINHTHUC_XULY,
      ['ID_HinhThucXuLy', 'ID_HinhThuc', 'MaHinhThucXuLy', 'MaHinhThuc', 'Ref_HinhThucXuLy', 'ID'],
      ['TenHinhThucXuLy', 'TenHinhThuc', 'HinhThucXuLy', 'Tên hình thức xử lý', 'Ten', 'Tên', 'Name']
    ),
    donViDaoTaoName: {
      ...nameMap(
        tables.DM_DONVI_DAOTAO,
        ['ID_DonViDaoTao', 'ID_CoSoDaoTao', 'ID_TrungTamDaoTao', 'MaDonViDaoTao', 'Ref_DonViDaoTao', 'ID'],
        ['TenDonViDaoTao', 'TenCoSoDaoTao', 'TenTrungTamDaoTao', 'DonViDaoTao', 'Tên đơn vị đào tạo', 'Ten', 'Tên', 'Name']
      ),
      ...nameMap(
        tables.DONVI,
        ['ID_DonVi', 'ID_DonViQuanLy', 'ID_DonViVanTai', 'ID'],
        ['TenDonVi', 'Tên đơn vị', 'Ten', 'Tên', 'Name']
      )
    }
  };
}

const DICT_BY_TYPE = {
  nhanSu: 'nhanSuName',
  donVi: 'donViName',
  doiXe: 'doiXeName',
  boPhan: 'boPhanName',
  chucDanh: 'chucDanhName',
  xe: 'xeName',
  benhVien: 'benhVienName',
  loaiGiayTo: 'loaiGiayToName',
  loaiViPham: 'loaiViPhamName',
  hinhThucXuLy: 'hinhThucXuLyName',
  donViDaoTao: 'donViDaoTaoName',
  mucLuong: 'mucLuongName'
};

function displayQuanHe(value) {
  const map = {
    NBL: 'Người bảo lãnh', 'NGUOI BAO LANH': 'Người bảo lãnh', BO: 'Bố', CHA: 'Cha', ME: 'Mẹ',
    VO: 'Vợ', CHONG: 'Chồng', CON: 'Con', ANH: 'Anh', CHI: 'Chị', EM: 'Em', ONG: 'Ông', BA: 'Bà'
  };
  return map[normalize(value)] || text(value);
}

function display(value, type, maps) {
  if (type === 'date') return formatDate(value);
  const raw = text(value);
  if (!raw) return '';
  if (type === 'quanHeNguoiThan') return displayQuanHe(raw);
  if (type === 'money') return money(raw);
  const dict = DICT_BY_TYPE[type] ? maps[DICT_BY_TYPE[type]] : null;
  const out = dict && dict[raw] ? dict[raw] : raw;
  return type === 'mucLuong' ? money(out) : out;
}

/* ===================== CHỌN BẢN GHI HIỆN HÀNH (V68) ===================== */

function todayNumber() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function firstDateNumInRow(row, keys) {
  for (const key of keys || []) {
    const number = dateNumber(get(row, key));
    if (number > 0) return number;
  }
  return 0;
}

function isLifecycleActive(row, statusKeys, activeStatuses) {
  const statuses = (statusKeys || ['TrangThai']).map((k) => normalize(get(row, k))).filter(Boolean);
  if (!statuses.length) return false;
  const active = (activeStatuses || ['Đang hiệu lực']).map(normalize);
  return statuses.some((s) => active.some((a) => s === a || s.indexOf(a) >= 0));
}

function lifecycleScore(row, opt) {
  const active = isLifecycleActive(row, opt.statusKeys, opt.activeStatuses) ? 1e15 : 0;
  const eff = firstDateNumInRow(row, opt.effectiveDateKeys || []);
  const any = firstDateNumInRow(row, opt.dateKeys || []);
  return active + Math.max(eff || 0, any || 0);
}

function selectCurrentLifecycleRow(rows, refKey, refValue, opt) {
  const list = (rows || []).filter((row) => {
    if (!refKey) return true;
    return text(get(row, refKey)) === text(refValue);
  });
  if (!list.length) return null;

  const today = todayNumber();
  const activeRows = list.filter((row) => isLifecycleActive(row, opt.statusKeys, opt.activeStatuses));
  const activeNow = activeRows.filter((row) => {
    const eff = firstDateNumInRow(row, opt.effectiveDateKeys || []);
    const actualEnd = firstDateNumInRow(row, ['NgayKetThucThucTe', 'NgayKetThuc', 'DenNgay', 'NgayChamDut', 'NgayTraXe', 'NgayThuHoiXe']);
    if (eff && eff > today) return false;
    if (actualEnd && actualEnd < today) return false;
    return true;
  });

  const source = (activeNow.length ? activeNow : (activeRows.length ? activeRows : list)).slice().sort((a, b) => {
    const diff = lifecycleScore(b, opt) - lifecycleScore(a, opt);
    if (diff) return diff;
    const ia = firstNotBlank((opt.idKeys || ['ID']).map((k) => get(a, k)));
    const ib = firstNotBlank((opt.idKeys || ['ID']).map((k) => get(b, k)));
    return String(ib).localeCompare(String(ia), 'vi');
  });

  const selected = { ...source[0] };
  if (activeNow.length > 1) {
    selected.__OVERRIDE = `Dữ liệu không hợp lệ: Có nhiều ${opt.label || 'bản ghi'} đang hiệu lực`;
  } else if (!activeNow.length && activeRows.length) {
    selected.__OVERRIDE = 'Chờ hiệu lực';
  }
  return selected;
}

function lifecycleOverride(row) {
  return row && row.__OVERRIDE ? text(row.__OVERRIDE) : '';
}

function layHopDongHienHanh(rows, id) {
  return selectCurrentLifecycleRow(rows, 'Ref_NhanSu', id, {
    label: 'HĐLĐ', statusKeys: ['TrangThai', 'TrangThaiHopDong', 'Trạng thái'], activeStatuses: ['Đang hiệu lực'],
    dateKeys: ['NgayHieuLuc', 'NgayBatDau', 'TuNgay', 'NgayKy', 'NgayLap', 'NgayKetThuc', 'DenNgay'],
    effectiveDateKeys: ['NgayHieuLuc', 'NgayBatDau', 'TuNgay', 'NgayKy'], expireDateKeys: ['NgayKetThuc', 'DenNgay'],
    idKeys: ['ID_HopDong', 'ID_HDLD', 'ID_HopDongLaoDong', 'ID']
  });
}

function layGplxHienHanh(rows, id) {
  return selectCurrentLifecycleRow(rows, 'Ref_NhanSu', id, {
    label: 'GPLX', statusKeys: ['TrangThai', 'TrangThaiGPLX', 'Trạng thái'], activeStatuses: ['Đang hiệu lực', 'Đang sử dụng', 'Còn hiệu lực'],
    dateKeys: ['NgayCap', 'NgayCapGPLX', 'NgayHetHan'], effectiveDateKeys: ['NgayCap', 'NgayCapGPLX'], expireDateKeys: ['NgayHetHan'],
    idKeys: ['ID_GPLX', 'ID_LaiXeGPLX', 'ID']
  });
}

function laySucKhoeHienHanh(rows, id) {
  return selectCurrentLifecycleRow(rows, 'Ref_NhanSu', id, {
    label: 'Sức khỏe', statusKeys: ['TrangThai', 'TrangThaiSucKhoe', 'Trạng thái'], activeStatuses: ['Đang hiệu lực', 'Đang sử dụng', 'Còn hiệu lực', 'Đạt'],
    dateKeys: ['NgayKham', 'NgayCap', 'NgayHetHan'], effectiveDateKeys: ['NgayKham', 'NgayCap'], expireDateKeys: ['NgayHetHan'],
    idKeys: ['ID_SucKhoe', 'ID_SucKhoeLaiXe', 'ID']
  });
}

function layDaoTaoHienHanh(rows, id) {
  return selectCurrentLifecycleRow(rows, 'Ref_NhanSu', id, {
    label: 'Đào tạo / tập huấn', statusKeys: ['TrangThai', 'TrangThaiDaoTao', 'Trạng thái'], activeStatuses: ['Đang hiệu lực', 'Còn hiệu lực', 'Đạt'],
    dateKeys: ['NgayHetHan', 'NgayCapChungChi', 'NgayKetThucDaoTao', 'NgayBatDauDaoTao', 'NgayDaoTao'],
    effectiveDateKeys: ['NgayBatDauDaoTao', 'NgayDaoTao', 'NgayCapChungChi'], expireDateKeys: ['NgayHetHan', 'NgayHetHanDaoTao'],
    idKeys: ['ID_DaoTao', 'ID_LaiXeDaoTao', 'ID']
  });
}

function layBhxhHienHanh(rows, id) {
  return selectCurrentLifecycleRow(rows, 'Ref_NhanSu', id, {
    label: 'BHXH', statusKeys: ['TrangThaiBHXH', 'TrangThai', 'Trạng thái'], activeStatuses: ['Đang tham gia'],
    dateKeys: ['NgayBatDauThamGia', 'TuNgay', 'NgayKetThucThamGia', 'DenNgay', 'NgayCapNhat'],
    effectiveDateKeys: ['NgayBatDauThamGia', 'TuNgay'], expireDateKeys: ['NgayKetThucThamGia', 'DenNgay'],
    idKeys: ['ID_BHXH', 'ID_NhanSuBHXH', 'ID']
  });
}

function layPhanCongHienHanh(rows, id) {
  return selectCurrentLifecycleRow(rows, 'Ref_NhanSu', id, {
    label: 'Phân công xe', statusKeys: ['TrangThai', 'TrangThaiPhanCong', 'TrangThaiPhanCongXe', 'Trạng thái'], activeStatuses: ['Đang hiệu lực', 'Đang phân công'],
    dateKeys: ['NgayBatDau', 'TuNgay', 'NgayBanGiao', 'NgayKetThuc', 'DenNgay'],
    effectiveDateKeys: ['NgayBatDau', 'TuNgay', 'NgayBanGiao'], expireDateKeys: ['NgayKetThuc', 'DenNgay', 'NgayTraXe', 'NgayThuHoiXe'],
    idKeys: ['ID_PhanCong', 'ID_LaiXePhanCongXe', 'ID_PhanCongXe', 'ID']
  });
}

function layTtdsHienHanh(rows, id) {
  const matched = (rows || []).filter((r) => text(get(r, 'Ref_LaiXe')) === text(id) || text(get(r, 'Ref_NhanSu')) === text(id));
  if (!matched.length) return null;
  return selectCurrentLifecycleRow(matched, null, null, {
    label: 'TTDS', statusKeys: ['TrangThaiThoaThuan', 'TrangThai', 'Trạng thái'], activeStatuses: ['Đang hiệu lực'],
    dateKeys: ['NgayHieuLuc', 'NgayKy', 'NgayHetHan'], effectiveDateKeys: ['NgayHieuLuc', 'NgayKy'], expireDateKeys: ['NgayHetHan'],
    idKeys: ['ID_TTDS', 'ID_ThoaThuan', 'ID']
  });
}

/* ===================== STATUS / KẾT LUẬN ===================== */

function statusByExpireDate(row, dateKey) {
  const override = lifecycleOverride(row);
  if (override) return override;
  if (!row) return 'Chưa có dữ liệu';
  const value = get(row, dateKey);
  if (!text(value)) return 'Chưa có hạn';
  if (!dateNumber(value)) return 'Chưa xác định hạn';
  const diff = daysDiff(value);
  if (diff < 0) return `Quá hạn ${Math.abs(diff)} ngày`;
  if (diff <= WARNING_DAYS) return `Sắp hết hạn ${diff} ngày`;
  return 'Còn hiệu lực';
}

function statusHopDong(hopDong) {
  const override = lifecycleOverride(hopDong);
  if (override) return override;
  if (!hopDong) return 'Chưa có dữ liệu';
  const trangThai = text(get(hopDong, 'TrangThai'));
  if (normalize(trangThai) === normalize('Đang hiệu lực')) return 'Đang hiệu lực';
  if (text(get(hopDong, 'NgayKetThuc'))) return statusByExpireDate(hopDong, 'NgayKetThuc');
  return trangThai || 'Chưa xác định';
}

function statusBhxh(bhxh) {
  const override = lifecycleOverride(bhxh);
  if (override) return override;
  if (!bhxh) return 'Chưa có dữ liệu';
  return text(get(bhxh, 'TrangThaiBHXH')) || 'Chưa xác định';
}

function statusDaoTao(daoTao) {
  const override = lifecycleOverride(daoTao);
  if (override) return override;
  if (!daoTao) return 'Chưa có dữ liệu';
  const statusText = firstNotBlank([get(daoTao, 'TrangThai'), get(daoTao, 'KetQua')]);
  const expire = firstNotBlank([get(daoTao, 'NgayHetHan'), get(daoTao, 'NgayHetHanDaoTao')]);
  if (text(expire)) return statusByExpireDate(daoTao, get(daoTao, 'NgayHetHan') ? 'NgayHetHan' : 'NgayHetHanDaoTao');
  if (normalize(statusText).indexOf('DAT') >= 0 || normalize(statusText).indexOf('DANG HIEU LUC') >= 0) return 'Còn hiệu lực';
  return statusText || 'Có dữ liệu';
}

function buildStatus(gplx, sucKhoe, hopDong, bhxh, daoTao) {
  return {
    gplx: statusByExpireDate(gplx, 'NgayHetHan'),
    sucKhoe: statusByExpireDate(sucKhoe, 'NgayHetHan'),
    hopDong: statusHopDong(hopDong),
    bhxh: statusBhxh(bhxh),
    daoTao: statusDaoTao(daoTao)
  };
}

function buildOperation(phanCong, ttds, xeName) {
  let xePhanCong = 'Chưa phân công xe';
  let trangThaiPhanCong = 'Chưa phân công xe';
  if (phanCong) {
    xePhanCong = xeName || 'Có phân công xe';
    trangThaiPhanCong = lifecycleOverride(phanCong) || text(get(phanCong, 'TrangThai')) || 'Có phân công xe';
  }
  let ttdsText = 'Chưa có thỏa thuận';
  if (ttds) {
    ttdsText = lifecycleOverride(ttds) || text(get(ttds, 'TrangThaiThoaThuan')) || 'Có thỏa thuận';
  }
  return { xePhanCong, trangThaiPhanCong, ttds: ttdsText };
}

function buildKetLuan(status, operation) {
  const requiredOk =
    status.gplx === 'Còn hiệu lực' &&
    status.sucKhoe === 'Còn hiệu lực' &&
    status.daoTao === 'Còn hiệu lực' &&
    status.hopDong === 'Đang hiệu lực' &&
    status.bhxh === 'Đang tham gia' &&
    operation.xePhanCong !== 'Chưa phân công xe' &&
    normalize(operation.ttds || '').indexOf('DANG HIEU LUC') >= 0;
  return requiredOk ? 'ĐỦ ĐIỀU KIỆN THEO DỮ LIỆU HỆ THỐNG' : 'CẦN KIỂM TRA / BỔ SUNG DỮ LIỆU';
}

function buildKetLuanChiTiet(status, operation) {
  return [
    { nhom: 'Điều kiện hành nghề lái xe', noiDung: 'GPLX', trangThai: status.gplx || 'Chưa có dữ liệu' },
    { nhom: 'Điều kiện hành nghề lái xe', noiDung: 'Sức khỏe', trangThai: status.sucKhoe || 'Chưa có dữ liệu' },
    { nhom: 'Điều kiện hành nghề lái xe', noiDung: 'Đào tạo / tập huấn', trangThai: status.daoTao || 'Chưa có dữ liệu' },
    { nhom: 'Quản trị lao động - vận hành', noiDung: 'HĐLĐ', trangThai: status.hopDong || 'Chưa có dữ liệu' },
    { nhom: 'Quản trị lao động - vận hành', noiDung: 'BHXH', trangThai: status.bhxh || 'Chưa có dữ liệu' },
    { nhom: 'Quản trị lao động - vận hành', noiDung: 'Phân công xe', trangThai: operation.trangThaiPhanCong || 'Chưa phân công xe' },
    { nhom: 'Quản trị lao động - vận hành', noiDung: 'TTDS', trangThai: operation.ttds || 'Chưa có thỏa thuận' }
  ];
}

const MISSING_KEYWORDS = ['CHUA', 'KHONG', 'THIEU', 'CHUA PHAN CONG', 'CHUA XAC DINH', 'TAM DUNG', 'HET HIEU LUC', 'QUA HAN', 'HET HAN', 'DU LIEU KHONG HOP LE', 'KHONG KHOP', 'CHO HIEU LUC'];

function buildMissingItems(status, operation) {
  const checks = [
    { name: 'GPLX', value: status.gplx },
    { name: 'Sức khỏe', value: status.sucKhoe },
    { name: 'Đào tạo / tập huấn', value: status.daoTao },
    { name: 'HĐLĐ', value: status.hopDong },
    { name: 'BHXH', value: status.bhxh },
    { name: 'Phân công xe', value: operation.trangThaiPhanCong },
    { name: 'TTDS', value: operation.ttds }
  ];
  const out = [];
  checks.forEach((check) => {
    const s = normalize(check.value || '');
    if (!s) {
      out.push(check.name);
      return;
    }
    if (MISSING_KEYWORDS.some((keyword) => s.indexOf(keyword) >= 0)) out.push(check.name);
  });
  return out;
}

function buildKetLuanLevel(status, operation, ketLuan) {
  const allText = normalize(JSON.stringify({ status, operation, ketLuan: ketLuan || '' }));
  if (['QUA HAN', 'KHONG DU', 'HET HIEU LUC', 'DU LIEU KHONG HOP LE', 'KHONG KHOP'].some((k) => allText.indexOf(k) >= 0)) {
    return 'BAD';
  }
  if (buildMissingItems(status, operation).length) return 'WARN';
  const k = normalize(ketLuan || '');
  if (k.indexOf('DU DIEU KIEN') >= 0) return 'OK';
  return 'WARN';
}

function buildProfileCompleteness(status, operation) {
  const total = 7;
  const missing = buildMissingItems(status, operation);
  const ok = Math.max(0, total - missing.length);
  return {
    total, ok, missing: missing.length, percent: total ? Math.round((ok * 100) / total) : 0,
    text: `${ok}/${total} tiêu chí có dữ liệu hợp lệ`,
    missingText: missing.length ? missing.join('; ') : 'Không có nhóm dữ liệu thiếu'
  };
}

function stateClass(value) {
  const s = normalize(value || '');
  if (!s) return 'warn';
  if (['QUA HAN', 'HET HAN', 'DU LIEU KHONG HOP LE', 'KHONG KHOP', 'CHO HIEU LUC', 'HET HIEU LUC', 'KHONG DU', 'LOI'].some((k) => s.indexOf(k) >= 0)) return 'bad';
  if (['CHUA', 'KHONG', 'THIEU', 'TAM DUNG', 'SAP', 'CAN'].some((k) => s.indexOf(k) >= 0)) return 'warn';
  if (['CON', 'DANG', 'DU', 'CO DU LIEU', 'HIEU LUC'].some((k) => s.indexOf(k) >= 0)) return 'ok';
  return 'neutral';
}

function actionByState(statusText, okText, warnText, badText) {
  const cls = stateClass(statusText);
  if (cls === 'ok') return okText;
  if (cls === 'bad') return badText;
  return warnText;
}

function joinClean(parts) {
  return (parts || []).map(text).filter(Boolean).join('; ');
}

function buildConditionChecklist(status, operation, ctx, maps) {
  const displayRef = (value, type) => {
    const raw = text(value);
    if (!raw) return '';
    const displayed = display(raw, type, maps);
    if (displayed && displayed !== raw) return displayed;
    if (isTechnicalId(raw)) return '';
    return displayed || raw;
  };
  const firstRef = (values, type) => {
    for (const value of values) {
      const out = displayRef(value, type);
      if (text(out)) return out;
    }
    return '';
  };

  const g = ctx.gplx;
  const sk = ctx.sucKhoe;
  const dt = ctx.daoTao;
  const hd = ctx.hopDong;
  const bh = ctx.bhxh;
  const pc = ctx.phanCong;
  const tt = ctx.ttds;

  const hangGplx = firstNotBlank([get(g, 'HangGPLX'), get(g, 'Hang')]);
  const soGplx = firstNotBlank([get(g, 'SoGPLX'), get(g, 'SoGiayPhepLaiXe')]);
  const coSoKham = firstNotBlank([
    get(sk, 'TenCoSoKham'), get(sk, 'TenBenhVien'), get(sk, 'NoiKham'),
    firstRef([get(sk, 'Ref_BenhVien'), get(sk, 'Ref_CoSoKham'), get(sk, 'CoSoKham'), get(sk, 'ID_BenhVien')], 'benhVien')
  ]);
  const noiDungDaoTao = firstNotBlank([get(dt, 'NoiDungDaoTao'), get(dt, 'NoiDungTapHuan'), get(dt, 'TenKhoaDaoTao')]);
  const soHopDong = firstNotBlank([get(hd, 'SoHopDong'), get(hd, 'SoHDLD')]);
  const loaiHopDong = firstNotBlank([get(hd, 'LoaiHopDong'), get(hd, 'LoaiHDLD')]);
  const mucLuongBhxh = firstRef([
    get(bh, 'Ref_MucLuongDongBHXH'), get(bh, 'Ref_MucLuongBHXH'), get(bh, 'Ref_MucLuong'),
    get(bh, 'ID_MucLuong'), get(bh, 'MucLuongDongBHXH'), get(bh, 'MucLuongCoBan'), get(bh, 'MucLuong')
  ], 'mucLuong');

  const gplxStatus = status.gplx || 'Chưa có dữ liệu';
  const sucKhoeStatus = status.sucKhoe || 'Chưa có dữ liệu';
  const daoTaoStatus = status.daoTao || 'Chưa có dữ liệu';
  const hopDongStatus = status.hopDong || 'Chưa có dữ liệu';
  const bhxhStatus = status.bhxh || 'Chưa có dữ liệu';
  const phanCongStatus = operation.trangThaiPhanCong || 'Chưa phân công xe';
  const ttdsStatus = operation.ttds || 'Chưa có thỏa thuận';

  return [
    {
      group: 'Hành nghề', item: 'GPLX', status: gplxStatus, statusClass: stateClass(gplxStatus),
      info: joinClean([hangGplx ? `Hạng ${hangGplx}` : '', soGplx ? `Số ${soGplx}` : '', formatDate(get(g, 'NgayHetHan')) ? `Hạn ${formatDate(get(g, 'NgayHetHan'))}` : '']) || '—',
      action: actionByState(gplxStatus, 'Theo dõi hạn GPLX', 'Bổ sung/xác minh GPLX', 'Không phân công đến khi xử lý')
    },
    {
      group: 'Hành nghề', item: 'Sức khỏe', status: sucKhoeStatus, statusClass: stateClass(sucKhoeStatus),
      info: joinClean([formatDate(get(sk, 'NgayKham')) ? `Khám ${formatDate(get(sk, 'NgayKham'))}` : '', formatDate(get(sk, 'NgayHetHan')) ? `Hạn ${formatDate(get(sk, 'NgayHetHan'))}` : '', coSoKham]) || '—',
      action: actionByState(sucKhoeStatus, 'Theo dõi hạn sức khỏe', 'Bổ sung giấy khám sức khỏe', 'Tạm dừng phân công nếu quá hạn')
    },
    {
      group: 'Hành nghề', item: 'Đào tạo / tập huấn', status: daoTaoStatus, statusClass: stateClass(daoTaoStatus),
      info: joinClean([noiDungDaoTao, formatDate(firstNotBlank([get(dt, 'NgayCapChungChi'), get(dt, 'NgayDaoTao'), get(dt, 'NgayBatDauDaoTao')])) ? `Ngày ${formatDate(firstNotBlank([get(dt, 'NgayCapChungChi'), get(dt, 'NgayDaoTao'), get(dt, 'NgayBatDauDaoTao')]))}` : '', formatDate(firstNotBlank([get(dt, 'NgayHetHan'), get(dt, 'NgayHetHanDaoTao')])) ? `Hạn ${formatDate(firstNotBlank([get(dt, 'NgayHetHan'), get(dt, 'NgayHetHanDaoTao')]))}` : '']) || '—',
      action: actionByState(daoTaoStatus, 'Theo dõi đào tạo định kỳ', 'Bổ sung/tạo hồ sơ tập huấn', 'Không phân công nếu thiếu điều kiện bắt buộc')
    },
    {
      group: 'Lao động', item: 'HĐLĐ', status: hopDongStatus, statusClass: stateClass(hopDongStatus),
      info: joinClean([soHopDong ? `Số ${soHopDong}` : '', loaiHopDong, formatDateRange(firstNotBlank([get(hd, 'NgayBatDau'), get(hd, 'NgayKy')]), firstNotBlank([get(hd, 'NgayKetThuc'), get(hd, 'DenNgay')]))]) || '—',
      action: actionByState(hopDongStatus, 'Theo dõi hiệu lực HĐLĐ', 'Bổ sung/cập nhật HĐLĐ', 'Không sử dụng nếu HĐLĐ hết hiệu lực')
    },
    {
      group: 'Lao động', item: 'BHXH', status: bhxhStatus, statusClass: stateClass(bhxhStatus),
      info: joinClean([get(bh, 'MaSoBHXH') ? `Mã ${get(bh, 'MaSoBHXH')}` : '', get(bh, 'SoSoBHXH') ? `Sổ ${get(bh, 'SoSoBHXH')}` : '', mucLuongBhxh ? `Mức ${mucLuongBhxh}` : '']) || '—',
      action: actionByState(bhxhStatus, 'Theo dõi quá trình BHXH', 'Kiểm tra/bổ sung BHXH', 'Xử lý tình trạng BHXH')
    },
    {
      group: 'Vận hành', item: 'Phân công xe', status: phanCongStatus, statusClass: stateClass(phanCongStatus),
      info: joinClean([operation.xePhanCong && operation.xePhanCong.indexOf('Chưa') < 0 ? `Xe ${operation.xePhanCong}` : '', formatDate(firstNotBlank([get(pc, 'NgayBatDau'), get(pc, 'TuNgay')])) ? `Từ ${formatDate(firstNotBlank([get(pc, 'NgayBatDau'), get(pc, 'TuNgay')]))}` : '', formatDate(firstNotBlank([get(pc, 'NgayKetThuc'), get(pc, 'DenNgay')])) ? `Đến ${formatDate(firstNotBlank([get(pc, 'NgayKetThuc'), get(pc, 'DenNgay')]))}` : '']) || '—',
      action: actionByState(phanCongStatus, 'Theo dõi phân công xe', 'Phân công xe hoặc cập nhật trạng thái', 'Dừng khai thác bản ghi hết hiệu lực')
    },
    {
      group: 'Vận hành', item: 'TTDS', status: ttdsStatus, statusClass: stateClass(ttdsStatus),
      info: joinClean([get(tt, 'SoThoaThuan') ? `Số ${get(tt, 'SoThoaThuan')}` : '', formatDate(firstNotBlank([get(tt, 'NgayHieuLuc'), get(tt, 'NgayKy')])) ? `Hiệu lực ${formatDate(firstNotBlank([get(tt, 'NgayHieuLuc'), get(tt, 'NgayKy')]))}` : '', formatDate(get(tt, 'NgayHetHan')) ? `Hạn ${formatDate(get(tt, 'NgayHetHan'))}` : '']) || '—',
      action: actionByState(ttdsStatus, 'Theo dõi TTDS', 'Bổ sung thỏa thuận nếu nghiệp vụ yêu cầu', 'Xử lý TTDS hết hiệu lực')
    }
  ];
}

function isKhenThuong(row) {
  const loai = normalize(firstNotBlank([get(row, 'Loai'), get(row, 'LoaiKTKL'), get(row, 'LoaiKhenThuongKyLuat'), get(row, 'HinhThuc'), get(row, 'NoiDung')]));
  return loai.indexOf('KHEN') >= 0 || loai.indexOf('THUONG') >= 0 || loai.indexOf('TUYEN DUONG') >= 0;
}

function buildRiskItems(rows, id) {
  const ktklRows = rows.KTKL.filter((r) => text(get(r, 'Ref_NhanSu')) === text(id));
  const risk = {
    hoSo: rows.HOSO.filter((r) => text(get(r, 'Ref_NhanSu')) === text(id)).length,
    khenThuong: ktklRows.filter(isKhenThuong).length,
    kyLuat: ktklRows.filter((r) => !isKhenThuong(r)).length,
    taiNan: rows.TAINAN.filter((r) => text(get(r, 'Ref_NhanSu')) === text(id)).length,
    viPhamAtgt: rows.ATGT.filter((r) => text(get(r, 'Ref_NhanSu')) === text(id)).length,
    viPhamNoiBo: rows.NOIBO.filter((r) => text(get(r, 'Ref_NhanSu')) === text(id)).length
  };
  return [
    { label: 'Vi phạm ATGT', value: risk.viPhamAtgt, level: 'warn' },
    { label: 'Vi phạm nội bộ', value: risk.viPhamNoiBo, level: 'warn' },
    { label: 'Tai nạn / sự cố', value: risk.taiNan, level: 'warn' },
    { label: 'Khen thưởng', value: risk.khenThuong, level: 'good' },
    { label: 'Kỷ luật', value: risk.kyLuat, level: 'warn' },
    { label: 'Hồ sơ lưu trữ', value: risk.hoSo, level: 'record' }
  ].map((item) => ({ ...item, css: item.value > 0 ? `risk-${item.level}` : 'risk-zero' }));
}

/* ===================== BẢNG LỊCH SỬ (V70) ===================== */

function flex(row, keys) {
  for (const key of keys) {
    const value = get(row, key);
    if (text(value)) return value;
  }
  return '';
}

function isActiveLifecycle(row, statusKeys) {
  const s = normalize(flex(row, statusKeys || ['TrangThai', 'TrangThaiHopDong', 'TrangThaiBHXH', 'TrangThaiThoaThuan']));
  if (!s) return false;
  return ['DANG HIEU LUC', 'CON HIEU LUC', 'DANG SU DUNG', 'DANG THAM GIA'].some((k) => s.indexOf(k) >= 0) || s === 'DAT';
}

function sortLifecycleRows(rows, dateKeys, statusKeys) {
  return (rows || []).slice().sort((a, b) => {
    const aa = isActiveLifecycle(a, statusKeys) ? 1 : 0;
    const bb = isActiveLifecycle(b, statusKeys) ? 1 : 0;
    if (aa !== bb) return bb - aa;
    const da = firstDateNumInRow(a, dateKeys);
    const db = firstDateNumInRow(b, dateKeys);
    if (da !== db) return db - da;
    return JSON.stringify(b).localeCompare(JSON.stringify(a), 'vi');
  });
}

function makeRow(idx, cells) {
  return { stt: idx + 1, cells: cells.map(([label, value]) => ({ label, value: text(value) })) };
}

function filterByNhanSu(rows, id, refKeys = ['Ref_NhanSu']) {
  return (rows || []).filter((r) => refKeys.some((key) => text(get(r, key)) === text(id)));
}

function buildHopDongHistory(rows, id) {
  return sortLifecycleRows(filterByNhanSu(rows, id), ['NgayHieuLuc', 'NgayBatDau', 'NgayKy', 'NgayKetThuc', 'DenNgay'], ['TrangThai', 'TrangThaiHopDong']).map((r, idx) => makeRow(idx, [
    ['Số HĐLĐ', flex(r, ['SoHopDong', 'SoHDLD', 'SoHopDongLaoDong', 'Số hợp đồng'])],
    ['Loại HĐ', flex(r, ['LoaiHopDong', 'LoaiHDLD', 'LoaiHopDongLaoDong', 'Loại hợp đồng'])],
    ['Ngày ký', formatDate(flex(r, ['NgayKy', 'NgayLap', 'Ngày ký']))],
    ['Ngày hiệu lực', formatDate(flex(r, ['NgayHieuLuc', 'NgayBatDau', 'TuNgay', 'Từ ngày']))],
    ['Ngày hết hạn', formatDate(flex(r, ['NgayHetHan', 'NgayKetThuc', 'DenNgay', 'Đến ngày']))],
    ['Trạng thái', flex(r, ['TrangThai', 'TrangThaiHopDong', 'Trạng thái'])],
    ['Ghi chú', flex(r, ['GhiChu', 'LyDoChamDut', 'LyDo', 'Ghi chú'])]
  ]));
}

function buildTtdsHistory(rows, id, maps) {
  return sortLifecycleRows(filterByNhanSu(rows, id, ['Ref_LaiXe', 'Ref_NhanSu']), ['NgayHieuLuc', 'NgayKy', 'NgayHetHan'], ['TrangThaiThoaThuan', 'TrangThai']).map((r, idx) => makeRow(idx, [
    ['Số TTDS', flex(r, ['SoThoaThuan', 'SoHopDong', 'SoHDDS', 'SoTTDS'])],
    ['Xe', display(flex(r, ['Ref_Xe', 'IDXe', 'ID_Xe', 'BienSo', 'BienSoXe', 'Biển số']), 'xe', maps)],
    ['Ngày ký', formatDate(flex(r, ['NgayKy', 'NgayLap']))],
    ['Ngày hiệu lực', formatDate(flex(r, ['NgayHieuLuc', 'TuNgay', 'NgayBatDau']))],
    ['Ngày hết hạn', formatDate(flex(r, ['NgayHetHan', 'DenNgay', 'NgayKetThuc']))],
    ['Hình thức', flex(r, ['HinhThucKhoan', 'HinhThucThanhToan', 'HinhThuc'])],
    ['Đặt cọc', money(flex(r, ['SoTienDatCoc', 'TienDatCoc', 'DatCoc']))],
    ['Trạng thái', flex(r, ['TrangThaiThoaThuan', 'TrangThai'])]
  ]));
}

function buildGplxHistory(rows, id) {
  return sortLifecycleRows(filterByNhanSu(rows, id), ['NgayCap', 'NgayCapGPLX', 'NgayHetHan'], ['TrangThai', 'TrangThaiGPLX']).map((r, idx) => makeRow(idx, [
    ['Số GPLX', flex(r, ['SoGPLX', 'SoGiayPhepLaiXe', 'Số GPLX'])],
    ['Hạng', flex(r, ['HangGPLX', 'Hang', 'Hạng GPLX'])],
    ['Ngày cấp', formatDate(flex(r, ['NgayCap', 'NgayCapGPLX']))],
    ['Ngày hết hạn', formatDate(flex(r, ['NgayHetHan', 'HanGPLX']))],
    ['Trạng thái', flex(r, ['TrangThai', 'TrangThaiGPLX'])],
    ['Ghi chú', flex(r, ['GhiChu', 'LyDoCapLai', 'LyDo', 'Ghi chú'])]
  ]));
}

function buildSucKhoeHistory(rows, id, maps) {
  return sortLifecycleRows(filterByNhanSu(rows, id), ['NgayKham', 'NgayCap', 'NgayHetHan'], ['TrangThai']).map((r, idx) => makeRow(idx, [
    ['Ngày khám', formatDate(flex(r, ['NgayKham', 'NgayCap']))],
    ['Cơ sở khám', display(flex(r, ['TenCoSoKham', 'TenBenhVien', 'NoiKham', 'Ref_BenhVien', 'Ref_CoSoKham', 'CoSoKham', 'ID_BenhVien']), 'benhVien', maps)],
    ['Kết quả', flex(r, ['KetQua', 'Kết quả'])],
    ['Ngày hết hạn', formatDate(flex(r, ['NgayHetHan', 'HanSucKhoe']))],
    ['Số hồ sơ', flex(r, ['SoGiayKham', 'SoHoSo', 'SoGiayChungNhan'])],
    ['Trạng thái', flex(r, ['TrangThai'])]
  ]));
}

function buildBhxhHistory(rows, id, maps) {
  return sortLifecycleRows(filterByNhanSu(rows, id), ['NgayBatDauThamGia', 'TuNgay', 'NgayKetThucThamGia', 'DenNgay'], ['TrangThaiBHXH', 'TrangThai']).map((r, idx) => makeRow(idx, [
    ['Từ ngày', formatDate(flex(r, ['NgayBatDauThamGia', 'TuNgay', 'NgayBatDau']))],
    ['Đến ngày', formatDate(flex(r, ['NgayKetThucThamGia', 'DenNgay', 'NgayKetThuc']))],
    ['Mức đóng', display(flex(r, ['Ref_MucLuongDongBHXH', 'Ref_MucLuongBHXH', 'Ref_MucLuong', 'ID_MucLuong', 'MucLuongDongBHXH', 'MucLuongCoBan', 'MucLuong']), 'mucLuong', maps)],
    ['Số/Mã BHXH', flex(r, ['SoSoBHXH', 'MaSoBHXH'])],
    ['Trạng thái', flex(r, ['TrangThaiBHXH', 'TrangThai'])]
  ]));
}

/* ===================== BẢNG OFFICIAL RECORD ===================== */

function buildRowsForTemplate(rows, id, refKey, cols, maps) {
  return filterByNhanSu(rows, id, [refKey]).map((r, idx) => ({
    stt: idx + 1,
    cells: cols.map(([keySpec, label, type]) => {
      const keys = Array.isArray(keySpec) ? keySpec : [keySpec];
      const value = firstNotBlank(keys.map((k) => get(r, k)));
      return { label, value: display(value, type, maps) };
    })
  }));
}

function buildKhenThuongKyLuat(rows, id, wantKhenThuong, maps) {
  return filterByNhanSu(rows, id).filter((r) => isKhenThuong(r) === wantKhenThuong).map((r, idx) => ({
    stt: idx + 1,
    cells: [
      { label: 'Ngày áp dụng', value: formatDate(get(r, 'NgayApDung')) },
      { label: wantKhenThuong ? 'Nội dung khen thưởng' : 'Nội dung kỷ luật', value: firstNotBlank([get(r, 'NoiDung'), get(r, 'NoiDungKhenThuongKyLuat'), get(r, 'GhiChu')]) },
      { label: 'Hình thức', value: firstNotBlank([get(r, 'HinhThuc'), get(r, 'Loai'), get(r, 'LoaiKTKL')]) },
      { label: 'Số quyết định', value: text(get(r, 'SoQuyetDinh')) },
      { label: 'Số tiền', value: money(get(r, 'SoTienThuongPhat')) },
      { label: 'Trạng thái', value: text(get(r, 'TrangThai')) }
    ]
  }));
}

function buildDaoTaoRows(tables, id, maps) {
  return filterByNhanSu(tables.LAIXE_DAOTAO, id).map((r, idx) => ({
    stt: idx + 1,
    cells: [
      { label: 'Thời gian đào tạo', value: formatDateRange(firstNotBlank([get(r, 'NgayBatDauDaoTao'), get(r, 'NgayBatDau'), get(r, 'TuNgay'), get(r, 'NgayDaoTao')]), firstNotBlank([get(r, 'NgayKetThucDaoTao'), get(r, 'NgayKetThuc'), get(r, 'DenNgay')])) },
      { label: 'Đơn vị đào tạo', value: layTenDonViDaoTao(r, maps) },
      { label: 'Nội dung đào tạo', value: firstNotBlank([get(r, 'NoiDungDaoTao'), get(r, 'NoiDung'), get(r, 'NoiDungTapHuan'), get(r, 'TenKhoaDaoTao')]) },
      { label: 'Kết quả', value: text(get(r, 'KetQua')) },
      { label: 'Ngày hết hạn', value: formatDate(firstNotBlank([get(r, 'NgayHetHan'), get(r, 'NgayHetHanDaoTao'), get(r, 'NgayKetThucDaoTao'), get(r, 'NgayKetThuc')])) },
      { label: 'Trạng thái', value: text(get(r, 'TrangThai')) }
    ]
  }));
}

function layTenDonViDaoTao(r, maps) {
  const directName = firstNotBlank([get(r, 'TenDonViDaoTao'), get(r, 'Tên đơn vị đào tạo'), get(r, 'TenCoSoDaoTao'), get(r, 'TenTrungTamDaoTao')]);
  if (directName) return directName;
  const raw = firstNotBlank([get(r, 'DonViDaoTao'), get(r, 'Ref_DonViDaoTao'), get(r, 'ID_DonViDaoTao'), get(r, 'CoSoDaoTao'), get(r, 'Ref_CoSoDaoTao')]);
  const mapped = display(raw, 'donViDaoTao', maps);
  if (mapped && mapped !== raw) return mapped;
  if (isTechnicalId(raw)) return '';
  return raw;
}

function buildPhanCongRows(tables, id, maps) {
  const rows = filterByNhanSu(tables.LAIXE_PHANCONG_XE, id).sort((a, b) => {
    const aa = isActiveLifecycle(a, ['TrangThai', 'TrangThaiPhanCong', 'TrangThaiPhanCongXe']) ? 1 : 0;
    const bb = isActiveLifecycle(b, ['TrangThai', 'TrangThaiPhanCong', 'TrangThaiPhanCongXe']) ? 1 : 0;
    if (aa !== bb) return bb - aa;
    const da = dateNumber(firstNotBlank([get(a, 'NgayBatDau'), get(a, 'TuNgay'), get(a, 'NgayBanGiao')]));
    const db = dateNumber(firstNotBlank([get(b, 'NgayBatDau'), get(b, 'TuNgay'), get(b, 'NgayBanGiao')]));
    return db - da;
  });

  return rows.map((r, idx) => {
    const refXe = firstNotBlank([get(r, 'Ref_Xe'), get(r, 'IDXe'), get(r, 'ID_Xe'), get(r, 'Xe'), get(r, 'BienSo'), get(r, 'BienSoXe'), get(r, 'Biển số')]);
    return {
      stt: idx + 1,
      cells: [
        { label: 'Từ ngày', value: formatDate(firstNotBlank([get(r, 'NgayBatDau'), get(r, 'TuNgay')])) },
        { label: 'Đến ngày', value: formatDate(firstNotBlank([get(r, 'NgayKetThuc'), get(r, 'DenNgay'), get(r, 'NgayKetThucPhanCong')])) },
        { label: 'Đơn vị', value: display(firstNotBlank([get(r, 'Ref_DonViDuocCapPH'), get(r, 'Ref_DonViLamViecHienTai'), get(r, 'Ref_DonVi')]), 'donVi', maps) },
        { label: 'Bộ phận', value: display(firstNotBlank([get(r, 'Ref_BoPhan'), get(r, 'BoPhan')]), 'boPhan', maps) },
        { label: 'Chức danh', value: display(firstNotBlank([get(r, 'Ref_ChucDanh'), get(r, 'ChucDanh')]), 'chucDanh', maps) },
        { label: 'Xe', value: firstNotBlank([display(refXe, 'xe', maps), refXe]) },
        { label: 'Loại công việc', value: firstNotBlank([get(r, 'LoaiCongViec'), get(r, 'CongViec'), 'Lái xe']) },
        { label: 'Trạng thái', value: text(firstNotBlank([get(r, 'TrangThai'), get(r, 'TrangThaiPhanCong'), get(r, 'TrangThaiPhanCongXe')])) }
      ]
    };
  });
}

function buildHoSoPhapLyRows(tables, id, ctx, maps) {
  return filterByNhanSu(tables.NHANSU_HOSO_CANHAN, id).map((r, idx) => {
    const loaiHoSo = firstNotBlank([
      display(get(r, 'Ref_LoaiGiayTo'), 'loaiGiayTo', maps),
      get(r, 'LoaiHoSo'), get(r, 'LoaiGiayTo'), get(r, 'TenLoaiGiayTo'), get(r, 'MaLoaiGiayTo')
    ]);
    const extra = hoSoTheoLoai(loaiHoSo, ctx);
    return {
      stt: idx + 1,
      cells: [
        { label: 'Loại hồ sơ', value: loaiHoSo },
        { label: 'Số hiệu', value: firstNotBlank([get(r, 'SoHieu'), get(r, 'SoGiayTo'), get(r, 'SoHoSo'), get(r, 'SoVanBan'), extra.soHieu]) },
        { label: 'Ngày cấp', value: formatDate(firstNotBlank([get(r, 'NgayCap'), get(r, 'NgayLap'), get(r, 'NgayTao'), extra.ngayCap])) },
        { label: 'Ngày hết hạn', value: formatDate(firstNotBlank([get(r, 'NgayHetHan'), get(r, 'HanSuDung'), get(r, 'NgayKetThuc'), extra.ngayHetHan])) },
        { label: 'Trạng thái', value: firstNotBlank([get(r, 'TrangThai'), get(r, 'TrangThaiHoSo'), extra.trangThai, 'Đang sử dụng']) }
      ]
    };
  });
}

function hoSoTheoLoai(loaiHoSo, ctx) {
  const s = normalize(loaiHoSo);
  const { ns, gplx, sucKhoe, hopDong, bhxh } = ctx;
  if (s.indexOf('CAN CUOC') >= 0 || s.indexOf('CCCD') >= 0 || s.indexOf('CMND') >= 0) {
    return { soHieu: get(ns, 'CCCD'), ngayCap: get(ns, 'NgayCapCCCD'), ngayHetHan: firstNotBlank([get(ns, 'NgayHetHanCCCD'), get(ns, 'HanCCCD')]), trangThai: 'Đang sử dụng' };
  }
  if (s.indexOf('GPLX') >= 0 || s.indexOf('GIAY PHEP LAI XE') >= 0 || s.indexOf('BANG LAI') >= 0) {
    return { soHieu: firstNotBlank([get(gplx, 'SoGPLX'), get(gplx, 'SoGiayPhepLaiXe')]), ngayCap: get(gplx, 'NgayCap'), ngayHetHan: get(gplx, 'NgayHetHan'), trangThai: firstNotBlank([get(gplx, 'TrangThai'), statusByExpireDate(gplx, 'NgayHetHan')]) };
  }
  if (s.indexOf('SUC KHOE') >= 0 || s.indexOf('GIAY KHAM') >= 0) {
    return { soHieu: firstNotBlank([get(sucKhoe, 'SoGiayKham'), get(sucKhoe, 'SoHoSo'), get(sucKhoe, 'SoGiayChungNhan')]), ngayCap: firstNotBlank([get(sucKhoe, 'NgayCap'), get(sucKhoe, 'NgayKham')]), ngayHetHan: get(sucKhoe, 'NgayHetHan'), trangThai: firstNotBlank([get(sucKhoe, 'TrangThai'), statusByExpireDate(sucKhoe, 'NgayHetHan')]) };
  }
  if (s.indexOf('HOP DONG') >= 0 || s.indexOf('HDLD') >= 0) {
    return { soHieu: get(hopDong, 'SoHopDong'), ngayCap: firstNotBlank([get(hopDong, 'NgayKy'), get(hopDong, 'NgayBatDau')]), ngayHetHan: get(hopDong, 'NgayKetThuc'), trangThai: firstNotBlank([get(hopDong, 'TrangThai'), statusHopDong(hopDong)]) };
  }
  if (s.indexOf('BHXH') >= 0 || s.indexOf('BAO HIEM XA HOI') >= 0) {
    return { soHieu: firstNotBlank([get(bhxh, 'SoSoBHXH'), get(bhxh, 'MaSoBHXH')]), ngayCap: get(bhxh, 'NgayBatDauThamGia'), ngayHetHan: get(bhxh, 'NgayKetThucThamGia'), trangThai: get(bhxh, 'TrangThaiBHXH') };
  }
  return { soHieu: '', ngayCap: '', ngayHetHan: '', trangThai: '' };
}

/* ===================== ĐƠN VỊ THEO PHÙ HIỆU (V66) ===================== */

function normalizeBienSo(value) {
  return normalize(value).replace(/[^A-Z0-9]/g, '');
}

function layDonViHienThi(tables, maps, phanCong, xeRow, ns) {
  const refXe = firstNotBlank([
    get(phanCong, 'Ref_Xe'), get(phanCong, 'ID_Xe'), get(phanCong, 'IDXe'),
    get(xeRow, 'ID_Xe'), get(xeRow, 'IDXe')
  ]);
  const xeToken = normalizeBienSo(refXe);
  const phRows = (tables.PHUHIEUXE || []).filter((r) => {
    const token = normalizeBienSo(firstNotBlank([get(r, 'Ref_Xe'), get(r, 'ID_Xe'), get(r, 'BienSo')]));
    return token && token === xeToken;
  }).sort((a, b) => firstDateNumInRow(b, ['NgayCap', 'NgayHetHan']) - firstDateNumInRow(a, ['NgayCap', 'NgayHetHan']));
  const phRow = phRows[0];

  const fromPH = (row) => display(firstNotBlank([
    get(row, 'Ref_DonViDuocCapPH'), get(row, 'Ref_DonViDuocCapPhuHieu'), get(row, 'Ref_DonViCapPhuHieu'),
    get(row, 'DonViDuocCapPH'), get(row, 'TenDonViDuocCapPH')
  ]), 'donVi', maps);

  return firstNotBlank([
    phRow ? fromPH(phRow) : '',
    xeRow ? fromPH(xeRow) : '',
    display(firstNotBlank([get(xeRow, 'Ref_DonViQuanLyHienTai'), get(xeRow, 'Ref_DonViQuanLy'), get(xeRow, 'Ref_DonVi')]), 'donVi', maps),
    display(firstNotBlank([get(ns, 'Ref_DonViLamViecHienTai'), get(ns, 'Ref_DonVi'), get(ns, 'Ref_DonViQuanLy')]), 'donVi', maps)
  ]);
}

/* ===================== CÔNG TY ===================== */

function getCompany(tables, donViHienThiId) {
  const donViRows = tables.DONVI || [];
  const byId = donViHienThiId ? donViRows.find((r) => text(get(r, 'ID_DonVi')) === text(donViHienThiId)) : null;
  const donVi = byId || donViRows[0] || {};
  const taxCode = firstNotBlank([get(donVi, 'MaSoThue'), get(donVi, 'SoDangKyKinhDoanh'), get(donVi, 'MaDonVi')]);
  return {
    tenCongTy: firstNotBlank([get(donVi, 'TenDonVi'), get(donVi, 'TenVietTat')]) || 'TAXI 123',
    diaChi: firstNotBlank([get(donVi, 'DiaChi'), get(donVi, 'DiaChiTruSo'), get(donVi, 'DiaChiCongTy')]),
    maSoThue: taxCode,
    soDienThoai: firstNotBlank([get(donVi, 'SoDienThoai'), get(donVi, 'DienThoai'), get(donVi, 'Phone')])
  };
}

/* ===================== PROFILE ===================== */

function buildNhanSuProfileData(tables, ns, maps, missingSources) {
  const id = text(get(ns, 'ID_NhanSu'));

  const hopDong = layHopDongHienHanh(tables.NHANSU_HOPDONG_LAODONG, id);
  const gplx = layGplxHienHanh(tables.LAIXE_GPLX, id);
  const sucKhoe = laySucKhoeHienHanh(tables.NHANSU_SUCKHOE, id);
  const daoTao = layDaoTaoHienHanh(tables.LAIXE_DAOTAO, id);
  const bhxh = layBhxhHienHanh(tables.NHANSU_BHXH, id);
  const phanCong = layPhanCongHienHanh(tables.LAIXE_PHANCONG_XE, id);
  const ttds = layTtdsHienHanh(tables.XE_THOATHUAN_DANSU, id);

  const refXe = phanCong ? firstNotBlank([get(phanCong, 'Ref_Xe'), get(phanCong, 'ID_Xe'), get(phanCong, 'IDXe'), get(phanCong, 'BienSo')]) : '';
  const xeRow = refXe ? (maps.xeById[refXe] || (tables.XE || []).find((x) => [get(x, 'ID_Xe'), get(x, 'IDXe'), get(x, 'BienSo')].map(text).indexOf(refXe) >= 0)) : null;
  const xeName = refXe ? firstNotBlank([display(refXe, 'xe', maps), get(xeRow, 'BienSo'), refXe]) : '';

  const donViHienThi = layDonViHienThi(tables, maps, phanCong, xeRow, ns);

  const status = buildStatus(gplx, sucKhoe, hopDong, bhxh, daoTao);
  const operation = buildOperation(phanCong, ttds, xeName);
  const ketLuan = buildKetLuan(status, operation);
  const ketLuanLevel = buildKetLuanLevel(status, operation, ketLuan);

  const company = getCompany(tables, firstNotBlank([get(ns, 'Ref_DonViLamViecHienTai'), get(ns, 'Ref_DonVi')]));

  const ctx = { ns, gplx, sucKhoe, daoTao, hopDong, bhxh, phanCong, ttds };

  return {
    meta: {
      title: 'HỒ SƠ NHÂN SỰ ĐIỆN TỬ',
      appName: 'QLVT_TAXI123_HN',
      brand: 'TAXI 123',
      printDate: formatDateTime(new Date()),
      companyName: company.tenCongTy
    },
    company,

    idNhanSu: id,
    hoTen: text(get(ns, 'HoTen')),
    cccd: text(get(ns, 'CCCD')),
    ngaySinh: formatDate(get(ns, 'NgaySinh')),
    gioiTinh: text(get(ns, 'GioiTinh')),
    ngayCapCCCD: formatDate(get(ns, 'NgayCapCCCD')),
    noiCapCCCD: text(get(ns, 'NoiCapCCCD')),
    soDienThoai: text(get(ns, 'SoDienThoai')),
    diaChi: firstNotBlank([get(ns, 'DiaChiDayDu'), get(ns, 'Dia_Chi_Day_Du'), get(ns, 'DiaChiCCCD'), get(ns, 'DiaChi')]),
    loaiNhanSu: text(get(ns, 'LoaiNhanSu')),
    trangThaiLamViec: text(get(ns, 'TrangThai')),
    donVi: donViHienThi,
    doiXe: display(get(ns, 'Ref_DoiXe'), 'doiXe', maps),
    boPhan: display(get(ns, 'Ref_BoPhan'), 'boPhan', maps),
    chucDanh: display(get(ns, 'Ref_ChucDanh'), 'chucDanh', maps),

    status,
    operation,
    ketLuan,
    ketLuanChiTiet: buildKetLuanChiTiet(status, operation),
    ketLuanLevel,
    ketLuanClass: ketLuanLevel === 'OK' ? 'ok' : ketLuanLevel === 'BAD' ? 'bad' : 'warn',
    ketLuanIcon: ketLuanLevel === 'OK' ? '✓' : ketLuanLevel === 'BAD' ? '×' : '!',
    missingItems: buildMissingItems(status, operation),
    missingItemsText: buildMissingItems(status, operation).join('; ') || 'Không có nhóm dữ liệu thiếu theo quy tắc hiện tại',
    profileCompleteness: buildProfileCompleteness(status, operation),
    conditionChecklist: buildConditionChecklist(status, operation, ctx, maps),
    riskItems: buildRiskItems({
      KTKL: tables.LAIXE_KHENTHUONG_KYLUAT, HOSO: tables.NHANSU_HOSO_CANHAN,
      TAINAN: tables.LAIXE_TAINAN, ATGT: tables.LAIXE_VIPHAM_ATGT, NOIBO: tables.LAIXE_VIPHAM_NOIBO
    }, id),

    tables: {
      qtct: buildPhanCongRows(tables, id, maps),
      hopDongHistory: buildHopDongHistory(tables.NHANSU_HOPDONG_LAODONG, id),
      ttdsHistory: buildTtdsHistory(tables.XE_THOATHUAN_DANSU, id, maps),
      gplxHistory: buildGplxHistory(tables.LAIXE_GPLX, id),
      sucKhoeHistory: buildSucKhoeHistory(tables.NHANSU_SUCKHOE, id, maps),
      bhxhHistory: buildBhxhHistory(tables.NHANSU_BHXH, id, maps),
      hoso: buildHoSoPhapLyRows(tables, id, ctx, maps),
      nguoiThan: buildRowsForTemplate(tables.NHANSU_NGUOITHAN, id, 'Ref_NhanSu', [
        ['HoTen', 'Họ tên', 'text'],
        ['QuanHe', 'Quan hệ', 'quanHeNguoiThan'],
        ['SoDienThoai', 'Số điện thoại', 'text'],
        [['DiaChi', 'DiaChiChiTiet'], 'Địa chỉ', 'text'],
        ['GhiChu', 'Ghi chú', 'text']
      ], maps),
      daotao: buildDaoTaoRows(tables, id, maps),
      khenThuong: buildKhenThuongKyLuat(tables.LAIXE_KHENTHUONG_KYLUAT, id, true, maps),
      kyLuat: buildKhenThuongKyLuat(tables.LAIXE_KHENTHUONG_KYLUAT, id, false, maps),
      tainan: buildRowsForTemplate(tables.LAIXE_TAINAN, id, 'Ref_NhanSu', [
        ['NgayTaiNan', 'Ngày tai nạn', 'date'],
        ['Ref_Xe', 'Xe', 'xe'],
        ['DiaDiemTaiNan', 'Địa điểm', 'text'],
        ['MoTaTaiNan', 'Mô tả', 'text'],
        ['MucDoTaiNan', 'Mức độ', 'text'],
        [['NguyenNhan', 'NguyenNhanTaiNan'], 'Nguyên nhân', 'text'],
        ['TrangThaiXuLy', 'Trạng thái', 'text']
      ], maps),
      atgt: buildRowsForTemplate(tables.LAIXE_VIPHAM_ATGT, id, 'Ref_NhanSu', [
        ['NgayViPham', 'Ngày vi phạm', 'date'],
        ['Ref_Xe', 'Xe', 'xe'],
        ['DiaDiemViPham', 'Địa điểm', 'text'],
        ['Ref_LoaiViPham', 'Loại vi phạm', 'loaiViPham'],
        ['HanhViViPham', 'Hành vi', 'text'],
        ['SoBienBan', 'Số biên bản', 'text'],
        [['HinhThucXuLy', 'Ref_HinhThucXuLy', 'Ref_HinhThuc', 'ID_HinhThucXuLy'], 'Hình thức xử lý', 'hinhThucXuLy']
      ], maps),
      noibo: buildRowsForTemplate(tables.LAIXE_VIPHAM_NOIBO, id, 'Ref_NhanSu', [
        ['NgayViPham', 'Ngày vi phạm', 'date'],
        ['Ref_Xe', 'Xe', 'xe'],
        ['Ref_LoaiViPham', 'Loại vi phạm', 'loaiViPham'],
        ['NoiDungViPham', 'Nội dung', 'text'],
        ['MucDoViPham', 'Mức độ', 'text'],
        [['HinhThucXuLy', 'Ref_HinhThucXuLy', 'Ref_HinhThuc', 'ID_HinhThucXuLy'], 'Hình thức xử lý', 'hinhThucXuLy'],
        ['TrangThaiXuLy', 'Trạng thái', 'text']
      ], maps)
    },

    missingSources
  };
}

function findNhanSu(tables, id) {
  const target = text(id);
  const targetNorm = normalize(id).replace(/\s+/g, ' ');
  const rows = tables.NHANSU || [];
  return rows.find((r) => text(get(r, 'ID_NhanSu')) === target) ||
    rows.find((r) => normalize(get(r, 'CCCD')) === normalize(id)) ||
    rows.find((r) => normalize(get(r, 'HoTen')).replace(/\s+/g, ' ') === targetNorm) ||
    null;
}

async function buildNhanSuProfileBundle({ id, query = {}, env = process.env } = {}) {
  const { tables, missingSources } = await readNhanSuTables(NHAN_SU_PROFILE_TABLES, env);
  const maps = buildMaps(tables);
  const ns = findNhanSu(tables, id);
  if (!ns) return null;
  const profile = buildNhanSuProfileData(tables, ns, maps, missingSources);
  return { row: ns, profile, missingSources };
}

module.exports = {
  NHAN_SU_PROFILE_TABLES,
  buildNhanSuProfileBundle,
  buildNhanSuProfileData,
  buildMaps,
  findNhanSu
};
