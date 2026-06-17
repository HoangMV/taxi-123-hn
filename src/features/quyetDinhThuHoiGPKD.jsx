export function getDecisionIdFromSearch(search) {
  const params = new URLSearchParams(search || '');
  return params.get('IDQuyetDinh') || '';
}

export function parseDateValue(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getNguoiPhuTrachInfo(quyetDinh, nguoiPhuTrachList) {
  if (!quyetDinh || !Array.isArray(nguoiPhuTrachList)) return null;
  const nguoiKyId = String(quyetDinh.NguoiKy || '').trim();

  return nguoiPhuTrachList.find((item) => String(item.IDNguoi || '').trim() === nguoiKyId) || null;
}

export function getNguoiKyName(info) {
  return info?.TenNguoi || info?.HoTen || info?.NguoiPhuTrach || '';
}

export function formatVietnameseDate(value) {
  const date = parseDateValue(value);
  if (!date) return '';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatAdministrativeDate(value) {
  const date = parseDateValue(value);
  if (!date) {
    return { day: '', month: '', year: '' };
  }

  const day = String(date.getDate()).padStart(2, '0');
  const monthValue = date.getMonth() + 1;
  const month = monthValue <= 2 ? String(monthValue).padStart(2, '0') : String(monthValue);
  const year = String(date.getFullYear());

  return { day, month, year };
}

export function formatAdministrativeDateString(value) {
  const date = formatAdministrativeDate(value);
  if (!date.day || !date.month || !date.year) return '';
  return `${date.day}/${date.month}/${date.year}`;
}

export function buildCanCuList(refIds, canCuData) {
  if (!refIds) return [];

  let ids = [];

  if (Array.isArray(refIds)) {
    ids = refIds;
  } else {
    try {
      const str = String(refIds).trim();
      if (str.startsWith('[')) {
        const parsed = JSON.parse(str);
        ids = Array.isArray(parsed) ? parsed : [];
      } else {
        ids = str.split(',').map((item) => item.trim()).filter(Boolean);
      }
    } catch {
      ids = String(refIds).split(',').map((item) => item.trim()).filter(Boolean);
    }
  }

  return ids
    .map((id) => canCuData.find((item) => String(item.ID_CanCu || item.ID_CANCU || item.ID || '').trim() === String(id).trim()))
    .filter(Boolean)
    .map((item) => {
      const ngayBanHanh = formatAdministrativeDateString(item.NgayBanHanh);
      const ngay = ngayBanHanh ? ` ngày ${ngayBanHanh}` : '';
      const soVanBan = item.SoVanBan || item.SoKyHieu || '';
      const so = soVanBan ? ` số ${soVanBan}` : '';
      const coQuanBanHanh = item.CQBanHanh || item.CoQuanBanHanh || '';
      const coQuan = coQuanBanHanh ? ` của ${coQuanBanHanh}` : '';
      const tenVanBan = item.TenVanBanDayDu || item.TrichYeu || '';
      const trichYeu = tenVanBan ? ` ${tenVanBan}` : '';
      return `${item.LoaiVanBan || 'Văn bản'}${so}${ngay}${coQuan}${trichYeu}`.replace(/[;\s]+$/, '');
    });
}

export function buildLyDoThuHoi(item) {
  const reasons = [];
  if (item?.LyDoThuHoiDuaQD && String(item.LyDoThuHoiDuaQD).trim()) {
    reasons.push(String(item.LyDoThuHoiDuaQD).trim());
  }
  if (item?.LyDoThuHoiKhac && String(item.LyDoThuHoiKhac).trim()) {
    reasons.push(`(${String(item.LyDoThuHoiKhac).trim()})`);
  }
  return reasons;
}

function replaceOrInsertSectValue(sectionXml, tagName, valueXml) {
  const pattern = new RegExp(`<w:${tagName}[^>]*/>`);
  if (pattern.test(sectionXml)) {
    return sectionXml.replace(pattern, valueXml);
  }
  return sectionXml.replace('</w:sectPr>', `${valueXml}</w:sectPr>`);
}

export function normalizeQuyetDinhWordLayout(zip) {
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) return zip;

  const portraitSize = '<w:pgSz w:w="11907" w:h="16840" w:code="9"/>';
  const portraitMargins = '<w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="1417" w:header="706" w:footer="706" w:gutter="0"/>';
  const landscapeSize = '<w:pgSz w:w="16840" w:h="11907" w:orient="landscape" w:code="9"/>';
  const landscapeMargins = '<w:pgMar w:top="567" w:right="850" w:bottom="567" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/>';

  let sectionIndex = 0;
  const normalizedDocumentXml = documentFile.asText().replace(/<w:sectPr[\s\S]*?<\/w:sectPr>/g, (sectionXml) => {
    const isLandscape = sectionXml.includes('w:orient="landscape"') || sectionIndex > 0;
    sectionIndex += 1;
    let nextSectionXml = replaceOrInsertSectValue(sectionXml, 'pgSz', isLandscape ? landscapeSize : portraitSize);
    nextSectionXml = replaceOrInsertSectValue(nextSectionXml, 'pgMar', isLandscape ? landscapeMargins : portraitMargins);
    return nextSectionXml;
  });

  zip.file('word/document.xml', normalizedDocumentXml);

  const stylesFile = zip.file('word/styles.xml');
  if (stylesFile) {
    const normalizedStylesXml = stylesFile
      .asText()
      .replace(/w:ascii="(?:Calibri|Arial)"/g, 'w:ascii="Times New Roman"')
      .replace(/w:hAnsi="(?:Calibri|Arial)"/g, 'w:hAnsi="Times New Roman"')
      .replace(/w:eastAsia="(?:Calibri|Arial)"/g, 'w:eastAsia="Times New Roman"')
      .replace(/w:cs="(?:Calibri|Arial)"/g, 'w:cs="Times New Roman"');
    zip.file('word/styles.xml', normalizedStylesXml);
  }

  return zip;
}

async function readJsonResponse(response, fallbackMessage) {
  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      const preview = text.trim().slice(0, 40).toLowerCase();
      if (preview.startsWith('<!doctype') || preview.startsWith('<html') || preview.startsWith('<')) {
        throw new Error('API trả về HTML thay vì JSON. Khi chạy local, hãy chạy thêm npm run proxy cùng với npm start, rồi tải lại trang.');
      }
      throw new Error(fallbackMessage || 'Không đọc được phản hồi JSON từ API.');
    }
  }

  if (!response.ok) {
    throw new Error(data.error || fallbackMessage || `Y?u c?u th?t b?i (${response.status}).`);
  }

  return data;
}

export async function fetchQuyetDinhThuHoiData(decisionId) {
  if (!decisionId) {
    throw new Error('Thiếu tham số IDQuyetDinh trên URL.');
  }

  const response = await fetch(`/api/quyet-dinh-thu-hoi-gpkd?IDQuyetDinh=${encodeURIComponent(decisionId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });
  const data = await readJsonResponse(response, 'Không tải được dữ liệu quyết định thu hồi GPKD từ Google Sheets.');
  const related = data.related || {};
  const quyetDinh = data.row || null;
  if (!quyetDinh) {
    throw new Error(`Không tìm thấy quyết định với IDQuyetDinh = ${decisionId}.`);
  }

  const chitietData = Array.isArray(related.GPKD_THUHOI_CHITIET) ? related.GPKD_THUHOI_CHITIET : [];
  const tinhData = Array.isArray(related.ThongTin) ? related.ThongTin : [];
  const canCuData = Array.isArray(related.CANCU_PHAPLY) ? related.CANCU_PHAPLY : [];
  const nguoiPhuTrachData = Array.isArray(related.NguoiPhuTrach) ? related.NguoiPhuTrach : [];
  const nguoiPhuTrachInfo = getNguoiPhuTrachInfo(quyetDinh, nguoiPhuTrachData);

  const mocTinhHieuLuc = parseDateValue(quyetDinh.NgayKy) || new Date();
  const sortedTinhData = tinhData
    .filter((item) => {
      const ngayHieuLuc = parseDateValue(item.Ngay_hieu_luc);
      return !ngayHieuLuc || ngayHieuLuc <= mocTinhHieuLuc;
    })
    .sort((a, b) => new Date(b.Ngay_hieu_luc) - new Date(a.Ngay_hieu_luc));
  const tenTinh = sortedTinhData[0]?.Tinh || '';

  return {
    decisionId,
    quyetDinh,
    chiTietData: chitietData,
    tinhData,
    canCuData,
    nguoiPhuTrachInfo,
    tenTinh
  };
}
