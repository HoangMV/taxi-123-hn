import { parseDateValue } from '../lib/dateFormat';

export const CACHE_KEY = 'taxi123hn.thongke-phuhieu-donvi.v1';
export const CACHE_TTL_MS = 60 * 60 * 1000;

export function removeAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function isValidEmblem(item) {
  if ((item?.TrangThai || '').trim() !== 'Hiệu lực') {
    return false;
  }

  if (item?.NgayHetHan) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiryDate = parseDateValue(item.NgayHetHan);
    if (!expiryDate || expiryDate < today) {
      return false;
    }
  }

  return true;
}

export function isDangKhaiThac(item) {
  if (!isValidEmblem(item)) {
    return false;
  }

  const status = String(item?.TrangThaiKhaiThac || '').toLowerCase();

  if (!status || status.includes('đang') || status.includes('hoat dong') || status.includes('hoạt động')) {
    return true;
  }

  if (status.includes('ngừng') || status.includes('ngung') || status.includes('dừng') || status.includes('dung')) {
    return false;
  }

  return true;
}

export function buildPhuHieuStats(emblemsData, companyData) {
  const validEmblems = [];
  const typeSet = new Set();

  (Array.isArray(emblemsData) ? emblemsData : []).forEach((item) => {
    if (isValidEmblem(item)) {
      validEmblems.push(item);
      const loai = String(item.LoaiPH || '').trim();
      if (loai) {
        typeSet.add(loai);
      }
    }
  });

  const phLoaiTypes = [...typeSet].sort();
  const companyLookup = new Map(
    (Array.isArray(companyData) ? companyData : []).map((item) => [String(item.IDDoanhNghiep || '').trim(), item])
  );
  const companyMap = new Map();

  validEmblems.forEach((item, index) => {
    const refDonVi = String(item.Ref_DonViCapPhuHieu || '').trim();
    const key = refDonVi || String(item.Ten_don_vi || '').trim() || `unknown_${index}`;

    if (!companyMap.has(key)) {
      const company = refDonVi ? companyLookup.get(refDonVi) : null;
      const tenDonVi = item.Ten_don_vi || (company ? company.TenDoanhNghiep || '' : '');
      const maDN = company ? company.MaDN || company.IDDoanhNghiep || key : key;
      const loaihinh = item.Loaihinh_donvi || (company ? company.Loaihinh_donvi || company.LoaihinhDonvi || '' : '');

      companyMap.set(key, {
        companyId: key,
        tenDonVi,
        diaChi: company ? company.DiaChiSauSapNhap || '' : '',
        loaihinh,
        quanHuyen: company ? company.XaPhuongSauSapNhap || '' : '',
        maDN,
        nguoiDaiDien: company
          ? company.NguoiDaiDienTheoPhapLuat || company.NguoiDaiDien || company.NguoidaidienTheoPhapLuat || ''
          : '',
        dienThoai: company ? company.SoDienThoai || company.DienThoai || '' : '',
        email: company ? company.Email || company.EmailDonVi || '' : item.GuiEmailbao || '',
        searchIndex: removeAccents(`${tenDonVi} ${maDN} ${loaihinh}`.toLowerCase()),
        total: 0,
        dangKhaiThac: 0,
        byType: {}
      });
    }

    const stats = companyMap.get(key);
    stats.total += 1;

    if (isDangKhaiThac(item)) {
      stats.dangKhaiThac += 1;
    }

    const loai = String(item.LoaiPH || '').trim();
    if (loai) {
      stats.byType[loai] = (stats.byType[loai] || 0) + 1;
    }
  });

  return {
    phLoaiTypes,
    statsData: Array.from(companyMap.values())
  };
}

export function calculateSummary(stats, phLoaiTypes) {
  const summary = {
    totalDV: stats.length,
    totalPH: 0,
    totalDKT: 0,
    typeTotals: {}
  };

  phLoaiTypes.forEach((type) => {
    summary.typeTotals[type] = 0;
  });

  stats.forEach((item) => {
    summary.totalPH += item.total || 0;
    summary.totalDKT += item.dangKhaiThac || 0;

    phLoaiTypes.forEach((type) => {
      summary.typeTotals[type] += item.byType?.[type] || 0;
    });
  });

  return summary;
}

export function sortStats(stats, sortCol, sortDir, phLoaiTypes) {
  const sorted = [...stats];

  sorted.sort((a, b) => {
    const isNumberColumn = sortCol === 'total' || sortCol === 'dangKhaiThac' || phLoaiTypes.includes(sortCol);
    const valueA = isNumberColumn
      ? sortCol === 'total' || sortCol === 'dangKhaiThac'
        ? a[sortCol] || 0
        : a.byType?.[sortCol] || 0
      : String(a[sortCol] || '').toLowerCase();
    const valueB = isNumberColumn
      ? sortCol === 'total' || sortCol === 'dangKhaiThac'
        ? b[sortCol] || 0
        : b.byType?.[sortCol] || 0
      : String(b[sortCol] || '').toLowerCase();

    if (valueA < valueB) {
      return sortDir === 'asc' ? -1 : 1;
    }

    if (valueA > valueB) {
      return sortDir === 'asc' ? 1 : -1;
    }

    return 0;
  });

  return sorted;
}

export function filterStats(statsData, filters) {
  const {
    search,
    loaihinh,
    loaiph,
    quanhuyen,
    totalOp,
    totalMin,
    totalMax
  } = filters;

  const normalizedSearch = removeAccents(String(search || '').toLowerCase().trim());
  const minValue = Number(totalMin);
  const maxValue = Number(totalMax);

  return statsData.filter((item) => {
    if (loaihinh && item.loaihinh !== loaihinh) {
      return false;
    }

    if (quanhuyen && item.quanHuyen !== quanhuyen) {
      return false;
    }

    if (loaiph && !(item.byType?.[loaiph] > 0)) {
      return false;
    }

    if (normalizedSearch && !item.searchIndex.includes(normalizedSearch)) {
      return false;
    }

    if (totalOp && !Number.isNaN(minValue)) {
      if (totalOp === 'gte' && item.total < minValue) {
        return false;
      }

      if (totalOp === 'lte' && item.total > minValue) {
        return false;
      }

      if (totalOp === 'between') {
        if (Number.isNaN(maxValue)) {
          return false;
        }

        if (item.total < minValue || item.total > maxValue) {
          return false;
        }
      }
    }

    return true;
  });
}

export function buildStatsExcelWorkbook(ExcelJS, filteredStats, phLoaiTypes, summary) {
  const Workbook = ExcelJS.Workbook || ExcelJS.default?.Workbook;
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet('Theo đơn vị');
  const today = new Date().toLocaleString('vi-VN');
  const totalColumns = 9 + phLoaiTypes.length;
  const headers = [
    'STT',
    'Loại hình',
    'Tên đơn vị',
    'Địa chỉ',
    'Người đại diện',
    'Điện thoại',
    'Email',
    'Đang khai thác',
    'Tổng phù hiệu còn hiệu lực',
    ...phLoaiTypes
  ];

  const rows = [
    ['THỐNG KÊ PHÙ HIỆU XE THEO ĐƠN VỊ VẬN TẢI'],
    ['Phù hiệu còn hiệu lực, phân theo loại'],
    [`Ngày xuất: ${today}`],
    [`Tổng số: ${filteredStats.length} đơn vị, ${summary.totalPH} phù hiệu còn hiệu lực`],
    [],
    headers
  ];

  filteredStats.forEach((item, index) => {
    rows.push([
      index + 1,
      item.loaihinh,
      item.tenDonVi,
      item.diaChi,
      item.nguoiDaiDien,
      item.dienThoai,
      item.email,
      item.dangKhaiThac || 0,
      item.total,
      ...phLoaiTypes.map((type) => item.byType?.[type] || 0)
    ]);
  });

  rows.push([]);
  rows.push([
    '',
    '',
    '',
    '',
    '',
    '',
    'TỔNG CỘNG',
    summary.totalDKT,
    summary.totalPH,
    ...phLoaiTypes.map((type) => summary.typeTotals[type] || 0)
  ]);

  worksheet.columns = [
    { width: 8 },
    { width: 18 },
    { width: 38 },
    { width: 40 },
    { width: 22 },
    { width: 16 },
    { width: 30 },
    { width: 15 },
    { width: 18 },
    ...phLoaiTypes.map(() => ({ width: 15 }))
  ];

  rows.forEach((row) => worksheet.addRow(row));

  [1, 2, 3, 4].forEach((rowNumber) => {
    worksheet.mergeCells(rowNumber, 1, rowNumber, totalColumns);
  });

  worksheet.getRow(1).height = 24;
  worksheet.getCell('A1').font = { bold: true, size: 14 };
  worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

  [2, 3, 4].forEach((rowNumber) => {
    worksheet.getCell(rowNumber, 1).alignment = { horizontal: 'left', vertical: 'middle' };
  });

  const headerRow = worksheet.getRow(6);
  headerRow.height = 34;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFB91C1C' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD9E2EC' } },
      left: { style: 'thin', color: { argb: 'FFD9E2EC' } },
      bottom: { style: 'thin', color: { argb: 'FFD9E2EC' } },
      right: { style: 'thin', color: { argb: 'FFD9E2EC' } }
    };
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 6) return;

    row.eachCell((cell, columnNumber) => {
      cell.alignment = {
        horizontal: columnNumber === 1 || columnNumber >= 8 ? 'center' : 'left',
        vertical: 'middle',
        wrapText: true
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5EAF0' } },
        left: { style: 'thin', color: { argb: 'FFE5EAF0' } },
        bottom: { style: 'thin', color: { argb: 'FFE5EAF0' } },
        right: { style: 'thin', color: { argb: 'FFE5EAF0' } }
      };
    });
  });

  worksheet.views = [{ state: 'frozen', ySplit: 6 }];
  return workbook;
}
