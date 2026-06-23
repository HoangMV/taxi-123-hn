import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Loader2,
  Printer,
  RefreshCw
} from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  downloadVehicleProfilePdf,
  fetchVehicleProfile,
  getVehicleProfileIdFromSearch
} from '../features/vehicleProfile';

function valueText(value) {
  return value === null || value === undefined || value === '' ? 'Chưa có dữ liệu' : String(value);
}

function warningTone(level) {
  const text = String(level || '').toLowerCase();
  if (text.includes('đỏ') || text.includes('do')) return 'border-red-200 bg-red-50 text-red-700';
  if (text.includes('vàng') || text.includes('vang')) return 'border-amber-200 bg-amber-50 text-amber-700';
  if (text.includes('xanh')) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function statusClass(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('hết hạn') || text.includes('thiếu') || text.includes('đỏ') || text.includes('chưa có') || text.includes('quá hạn')) return 'status-bad';
  if (text.includes('sắp') || text.includes('vàng') || text.includes('cảnh báo') || text.includes('theo dõi')) return 'status-warn';
  if (text.includes('hiệu lực') || text.includes('xanh') || text.includes('đang') || text.includes('hoàn thành')) return 'status-ok';
  return 'status-info';
}

function legalByName(profile, name) {
  return (profile?.legalRows || []).find((row) => String(row.loai || '').toLowerCase().includes(String(name || '').toLowerCase())) || {};
}

function parseVnDate(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  return Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
}

function totalDaysFromTimeText(value) {
  const text = String(value || '').trim();
  if (!text || text === '—' || text === '-') return 0;
  let total = 0;
  let matched = false;
  const rangeRe = /(\d{1,2}\/\d{1,2}\/\d{4})\s*[-–—]\s*(\d{1,2}\/\d{1,2}\/\d{4})/g;
  let match = rangeRe.exec(text);
  while (match) {
    const from = parseVnDate(match[1]);
    const to = parseVnDate(match[2]);
    if (from !== null && to !== null && to >= from) {
      matched = true;
      total += Math.floor((to - from) / 86400000) + 1;
    }
    match = rangeRe.exec(text);
  }
  if (!matched) {
    const singleMatches = text.match(/\d{1,2}\/\d{1,2}\/\d{4}/g);
    total += singleMatches ? singleMatches.length : 0;
  }
  return total;
}

function daysTextFromTimeText(value) {
  const total = totalDaysFromTimeText(value);
  return total > 0 ? `${total} ngày` : '—';
}

function totalDaysTextFromRows(rows) {
  const total = (Array.isArray(rows) ? rows : []).reduce((sum, row) => sum + totalDaysFromTimeText(row.thoiGian), 0);
  return total > 0 ? `${total} ngày` : '—';
}

function StatusBadge({ value }) {
  return (
    <span className={`badge ${statusClass(value).replace('status-', 'badge-')}`}>
      {valueText(value)}
    </span>
  );
}

function Field({ label, value, strong = false }) {
  return (
    <div className={`field ${strong ? 'strong' : ''}`}>
      <div className="field-label">{label}</div>
      <div className="field-value">{valueText(value)}</div>
    </div>
  );
}

function Section({ number, title, children, dark = false }) {
  return (
    <div className="avoid-break vp-section-block">
      <div className={`section-title ${dark ? 'dark' : ''}`}>
        <div className="section-no">{number}</div>
        <div className="section-text">{title}</div>
      </div>
      <div className="section-content">{children}</div>
    </div>
  );
}

function PageHead({ docName, profile }) {
  return (
    <div className="page-head">
      <div className="page-head-left">
        <span className="logo">{profile?.meta?.brand || 'TAXI 123'}</span>
        <span className="doc-name">{docName}</span>
      </div>
      <div className="page-head-right">
        Biển số: <b>{profile?.vehicle?.bienSo || profile?.vehicle?.idXe}</b><br />
        Năm hồ sơ: <b>{profile?.meta?.year}</b>
      </div>
    </div>
  );
}

function Sheet({ docName, profile, children }) {
  return (
    <section className="sheet">
      <PageHead docName={docName} profile={profile} />
      {children}
    </section>
  );
}

function SimpleTable({ columns, rows, emptyText = 'Chưa có dữ liệu.', soft = false }) {
  return (
    <div className="table-wrap">
      <table className={soft ? 'soft' : ''}>
        <thead className="repeat-head">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="head-cell" style={column.width ? { width: column.width } : undefined}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(Array.isArray(rows) ? rows : []).map((row, index) => (
            <tr key={`${columns[0]?.key || 'row'}-${index}`}>
              {columns.map((column) => (
                <td key={column.key} className={column.className || ''}>
                  {column.render ? column.render(row, index) : column.badge ? <StatusBadge value={row[column.key]} /> : valueText(row[column.key])}
                </td>
              ))}
            </tr>
          ))}
          {(!rows || rows.length === 0) && (
            <tr>
              <td colSpan={columns.length} className="center empty-cell">{emptyText}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function MonthTable({ rows }) {
  const renderHalf = (from, to) => {
    const monthColumns = Array.from({ length: to - from + 1 }, (_, index) => from + index);
    return (
      <div className="table-wrap">
        <table className="month-table">
          <thead className="repeat-head">
            <tr>
              <th rowSpan={2} className="center">TT</th>
              <th rowSpan={2} className="content">Nội dung</th>
              <th colSpan={monthColumns.length}>Tháng {from} - Tháng {to}</th>
              <th rowSpan={2}>Tổng năm</th>
              <th rowSpan={2}>Số ngày BDSC, cải tạo lũy kế</th>
              <th rowSpan={2}>Địa điểm BDSC, cải tạo</th>
            </tr>
            <tr>
              {monthColumns.map((month) => <th key={month}>{month}</th>)}
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((row, rowIndex) => (
              <tr key={`${row.noiDung}-${from}-${rowIndex}`}>
                <td className="center">{row.tt}</td>
                <td className="content value-strong">{row.noiDung}</td>
                {monthColumns.map((month) => {
                  const value = row.values?.[month - 1] || '';
                  const isCode = String(value).includes('BD') || String(value).includes('SC') || String(value).includes('CT');
                  return <td key={`${row.noiDung}-${month}`} className={isCode ? 'code-cell' : ''}>{value}</td>;
                })}
                <td className="center value-strong">{row.total || ''}</td>
                <td className="center days-cell">{daysTextFromTimeText(row.thoiGian)}</td>
                <td>{row.diaDiem || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div>
      {renderHalf(1, 6)}
      {renderHalf(7, 12)}
      <div className="legend">
        <b>Chú thích:</b> BD = Bảo dưỡng, SC = Sửa chữa, CT = Cải tạo. Số ngày kỹ thuật được tính bao gồm cả ngày bắt đầu và ngày kết thúc; nếu có nhiều đợt thì cộng dồn lũy kế.
      </div>
    </div>
  );
}

function WarningList({ warnings }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {(warnings || []).map((warning, index) => (
        <div key={`${warning.level}-${index}`} className={`warning-card ${String(warning.level || '').toLowerCase().includes('đỏ') ? 'warning-bad' : String(warning.level || '').toLowerCase().includes('vàng') ? 'warning-warn' : String(warning.level || '').toLowerCase().includes('xanh') ? 'warning-ok' : ''}`}>
          <div className="warning-title">{valueText(warning.level)}: {valueText(warning.content)}</div>
          <div className="warning-note">{valueText(warning.note)}</div>
        </div>
      ))}
    </div>
  );
}

function LoadingProfile() {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-7xl animate-pulse space-y-4">
        <div className="h-20 rounded-lg bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-40 rounded-lg bg-slate-200" />
          <div className="h-40 rounded-lg bg-slate-200" />
          <div className="h-40 rounded-lg bg-slate-200" />
        </div>
        <div className="h-96 rounded-lg bg-slate-200" />
      </div>
    </div>
  );
}

const legalColumns = [
  { key: 'loai', label: 'Loại hồ sơ', width: '135px', className: 'value-strong' },
  { key: 'so', label: 'Số hồ sơ / thiết bị', width: '145px' },
  { key: 'donVi', label: 'Đơn vị liên quan' },
  { key: 'ngayCap', label: 'Ngày cấp', width: '88px', className: 'center' },
  { key: 'ngayHetHan', label: 'Ngày hết hạn', width: '98px', className: 'center value-strong' },
  { key: 'trangThai', label: 'Trạng thái', width: '145px', className: 'center', badge: true },
  { key: 'file', label: 'File', width: '65px', className: 'center', render: (row) => (row.file ? 'Có' : '—') }
];

const bdscColumns = [
  { key: 'ma', label: 'Mã', width: '50px', className: 'center value-strong' },
  { key: 'thoiGian', label: 'Thời gian', width: '120px', className: 'center' },
  { key: 'soNgay', label: 'Số ngày', width: '75px', className: 'center days-cell', render: (row) => daysTextFromTimeText(row.thoiGian) },
  { key: 'loai', label: 'Loại phiếu', width: '125px' },
  { key: 'noiDung', label: 'Nội dung' },
  { key: 'soKm', label: 'Km', width: '60px', className: 'right' },
  { key: 'donVi', label: 'Đơn vị SC', width: '120px' },
  { key: 'chiPhi', label: 'Chi phí', width: '88px', className: 'right' },
  { key: 'trangThai', label: 'Trạng thái', width: '95px', className: 'center', badge: true },
  { key: 'ghiChu', label: 'Ghi chú' }
];

const historyConfigs = [
  {
    key: 'phuHieu',
    title: 'Lịch sử cấp phù hiệu',
    columns: [
      { key: 'loai', label: 'Loại' },
      { key: 'so', label: 'Số phù hiệu' },
      { key: 'coQuanCap', label: 'Cơ quan cấp' },
      { key: 'ngayCap', label: 'Ngày cấp' },
      { key: 'ngayHetHan', label: 'Hạn' },
      { key: 'ngayHetHieuLucThucTe', label: 'Hết hiệu lực TT' },
      { key: 'trangThai', label: 'Trạng thái', badge: true },
      { key: 'lyDo', label: 'Lý do/Ghi chú', render: (row) => valueText(row.lyDo || row.ghiChu) }
    ]
  },
  {
    key: 'dangKiem',
    title: 'Lịch sử đăng kiểm',
    columns: [
      { key: 'so', label: 'Số đăng kiểm' },
      { key: 'donVi', label: 'Đơn vị' },
      { key: 'ngayCap', label: 'Ngày cấp' },
      { key: 'ngayHetHan', label: 'Hạn' },
      { key: 'trangThai', label: 'Trạng thái', badge: true },
      { key: 'ghiChu', label: 'Ghi chú' }
    ]
  },
  {
    key: 'baoHiem',
    title: 'Lịch sử bảo hiểm',
    columns: [
      { key: 'loai', label: 'Loại' },
      { key: 'so', label: 'Số hợp đồng' },
      { key: 'congTy', label: 'Công ty' },
      { key: 'nguon', label: 'Nguồn mua' },
      { key: 'ngayCap', label: 'Ngày cấp' },
      { key: 'ngayHetHan', label: 'Hạn' },
      { key: 'giaTri', label: 'Giá trị' },
      { key: 'trangThai', label: 'Trạng thái', badge: true }
    ]
  },
  {
    key: 'taximet',
    title: 'Lịch sử kiểm định taximet',
    columns: [
      { key: 'so', label: 'Số thiết bị' },
      { key: 'donVi', label: 'Đơn vị' },
      { key: 'ngayLapDat', label: 'Ngày lắp' },
      { key: 'ngayKiemDinh', label: 'Ngày kiểm định' },
      { key: 'ngayHetHan', label: 'Hạn' },
      { key: 'trangThai', label: 'Trạng thái', badge: true },
      { key: 'ghiChu', label: 'Ghi chú' }
    ]
  },
  {
    key: 'theChap',
    title: 'Lịch sử thế chấp ngân hàng',
    columns: [
      { key: 'nganHang', label: 'Ngân hàng' },
      { key: 'soHopDong', label: 'Hợp đồng' },
      { key: 'ngayTheChap', label: 'Ngày thế chấp' },
      { key: 'ngayHetHan', label: 'Hạn' },
      { key: 'ngayGiaiChap', label: 'Ngày giải chấp' },
      { key: 'soTienVay', label: 'Số tiền vay' },
      { key: 'tinhTrangHoSoGoc', label: 'HS gốc' },
      { key: 'trangThaiTheChap', label: 'Trạng thái', badge: true },
      { key: 'trangThaiKhoanVay', label: 'Khoản vay' }
    ]
  },
  {
    key: 'ngungHoatDong',
    title: 'Lịch sử xe ngừng hoạt động',
    columns: [
      { key: 'tuNgay', label: 'Từ ngày' },
      { key: 'denNgay', label: 'Đến ngày' },
      { key: 'lyDo', label: 'Lý do' },
      { key: 'trangThaiTruoc', label: 'Trước ngừng' },
      { key: 'trangThaiSau', label: 'Sau ngừng' },
      { key: 'ghiChu', label: 'Ghi chú' }
    ]
  },
  {
    key: 'laiXe',
    title: 'Lịch sử lái xe',
    columns: [
      { key: 'hoTen', label: 'Lái xe' },
      { key: 'cccd', label: 'CCCD' },
      { key: 'soDienThoai', label: 'Điện thoại' },
      { key: 'donViLamViec', label: 'Đơn vị' },
      { key: 'tuNgay', label: 'Từ ngày' },
      { key: 'denNgay', label: 'Đến ngày' },
      { key: 'trangThai', label: 'Trạng thái', badge: true },
      { key: 'ghiChu', label: 'Ghi chú' }
    ]
  }
];

const VehicleProfilePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const printRef = useRef(null);
  const idFromUrl = useMemo(() => getVehicleProfileIdFromSearch(location.search), [location.search]);
  const [idInput, setIdInput] = useState(idFromUrl);
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(Boolean(idFromUrl));
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  async function loadProfile(nextId = idInput) {
    const cleanId = String(nextId || '').trim();
    if (!cleanId) {
      setError('Vui lòng nhập ID_Xe để tải hồ sơ phương tiện.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchVehicleProfile(cleanId);
      setBundle(data);
      const params = new URLSearchParams();
      params.set('ID_Xe', cleanId);
      navigate(`/vehicle-profile?${params.toString()}`, { replace: true });
    } catch (requestError) {
      setBundle(null);
      setError(requestError.message || 'Không tải được hồ sơ phương tiện.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setIdInput(idFromUrl);
    if (idFromUrl) loadProfile(idFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idFromUrl]);

  async function handleDownloadPdf() {
    setExporting(true);
    try {
      await downloadVehicleProfilePdf(printRef.current, bundle?.profile);
    } catch (pdfError) {
      toast.error(`Không tải được PDF tự động: ${pdfError.message}. Có thể dùng nút In để lưu PDF.`);
      window.print();
    } finally {
      setExporting(false);
    }
  }

  const profile = bundle?.profile;

  if (loading && !profile) return <LoadingProfile />;

  return (
    <div className="vp-shell min-h-screen px-4 py-5 lg:px-8">
      <style>{`
        .vp-shell {
          background: #e9eef5;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 14px;
          line-height: 1.5;
          letter-spacing: 0;
        }
        .vp-shell button, .vp-shell input { font: inherit; }
        .vp-print-area { display: grid; gap: 12px; }
        .cover2026, .sheet {
          width: min(100%, 210mm);
          min-height: 0;
          margin: 0 auto;
          background: #ffffff;
          color: #172033;
          border: 1px solid #cfd9e6;
          box-shadow: 0 18px 42px rgba(15, 23, 42, .14);
          padding: 8mm;
          overflow: hidden;
        }
        .cover2026 { padding-top: 9mm; }
        .executive-header {
          display: grid;
          grid-template-columns: 12px minmax(0, 1fr) 190px;
          gap: 12px;
          align-items: stretch;
          min-height: 88px;
          border: 2.2px solid #2f6690;
          border-radius: 14px;
          background: linear-gradient(115deg, #ffffff 0%, #f7fbff 48%, #eaf3fb 100%);
          padding: 11px 13px 10px 0;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.7);
          page-break-inside: avoid;
        }
        .eh-left-accent { background: linear-gradient(180deg, #f4b400 0%, #ffd45c 50%, #f4b400 100%); border-right: 2px solid #2f6690; }
        .eh-main { min-width: 0; }
        .eh-brand-row { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .eh-logo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 142px;
          min-width: 142px;
          height: 48px;
          padding: 9px 13px;
          border-radius: 11px;
          background: linear-gradient(180deg, #ffc928 0%, #f4b400 100%);
          border: 2.5px solid #1f4e79;
          color: #172033;
          font-size: 24px;
          line-height: 1;
          font-weight: 1000;
          letter-spacing: .2px;
          flex: 0 0 auto;
          box-shadow: 0 2px 0 rgba(31,78,121,.18);
        }
        .eh-title-wrap { min-width: 0; }
        .eh-doc-title {
          color: #1f4e79;
          font-size: 24px;
          line-height: 1.05;
          font-weight: 1000;
          text-transform: uppercase;
          letter-spacing: .2px;
        }
        .eh-company {
          margin-top: 4px;
          display: inline-block;
          color: #1f4e79;
          font-size: 15px;
          line-height: 1.15;
          font-weight: 1000;
          text-transform: uppercase;
          border-bottom: 3px solid #f4b400;
        }
        .eh-info-row {
          margin-top: 10px;
          padding: 7px 9px;
          border-radius: 8px;
          background: #eef6fd;
          color: #344054;
          font-size: 10.8px;
          line-height: 1.32;
          font-weight: 800;
        }
        .eh-info-row b { color: #1f4e79; }
        .eh-sep { color: #9fb2c8; padding: 0 6px; }
        .eh-meta-card {
          border-radius: 12px;
          border: 1.7px solid #9fb2c8;
          background: rgba(255,255,255,.78);
          color: #344054;
          padding: 9px 10px;
          text-align: right;
        }
        .eh-meta-line {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          border-bottom: 1px solid #d7e3ef;
          padding: 5px 0;
          font-size: 11px;
          font-weight: 800;
        }
        .eh-meta-line:last-child { border-bottom: 0; }
        .eh-meta-line span { color: #667085; }
        .eh-meta-line b { color: #172033; font-size: 11.2px; }
        .cover-section-title, .section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 12px 0 8px;
          border-radius: 9px;
          border: 2px solid #173b63;
          background: linear-gradient(90deg, #173b63 0%, #1f4e79 70%, #2f6690 100%);
          color: #ffffff;
          padding: 7px 10px;
          page-break-inside: avoid;
        }
        .cover-section-no, .section-no {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #f4b400;
          color: #173b63;
          font-size: 13px;
          line-height: 1;
          font-weight: 1000;
          flex: 0 0 auto;
        }
        .section-title.dark .section-no { background: #ffffff; color: #173b63; }
        .section-icon { width: 16px; height: 16px; flex: 0 0 auto; }
        .cover-section-text, .section-text {
          min-width: 0;
          font-size: 14px;
          line-height: 1.1;
          font-weight: 1000;
          text-transform: uppercase;
          letter-spacing: 0;
        }
        .section-content { padding: 0 0 2px; }
        .vehicle-overview-pro {
          display: grid;
          grid-template-columns: 31fr 52fr 17fr;
          gap: 8px;
          margin: 6px 0 8px;
          page-break-inside: avoid;
        }
        .vo-card {
          border: 2px solid #2f6690;
          border-radius: 13px;
          padding: 10px 11px;
          color: #172033;
          background: #fff;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.7);
        }
        .vo-plate-card { text-align: center; background: linear-gradient(180deg, #fffdf3 0%, #fff7d6 100%); }
        .vo-quick-card { background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%); }
        .vo-qr-card { text-align: center; }
        .vo-card-title {
          margin: 0 0 8px;
          color: #1f4e79;
          font-size: 11.8px;
          line-height: 1.1;
          font-weight: 1000;
          text-transform: uppercase;
        }
        .vo-card-title.center { text-align: center; }
        .vo-plate {
          display: inline-block;
          min-width: 210px;
          margin: 2px 0 9px;
          padding: 9px 18px;
          border: 3px solid #2f6690;
          border-radius: 14px;
          background: #fff;
          color: #172033;
          font-size: 32px;
          line-height: 1;
          font-weight: 1000;
          letter-spacing: 1.2px;
          text-align: center;
        }
        .vo-status {
          display: inline-block;
          padding: 5px 13px;
          border-radius: 999px;
          background: #dcfce7;
          color: #166534;
          border: 1.8px solid #16a34a;
          font-size: 11.5px;
          line-height: 1;
          font-weight: 1000;
        }
        .vo-quick-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
        .vo-quick-grid-main { margin-bottom: 7px; }
        .vo-item {
          min-width: 0;
          background: #eef6fd;
          border: 1.4px solid #9fb2c8;
          border-radius: 9px;
          padding: 7px 8px;
        }
        .vo-item span, .field-label {
          display: block;
          color: #667085;
          font-size: 9.8px;
          line-height: 1.1;
          font-weight: 1000;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .vo-item b, .field-value {
          display: block;
          color: #172033;
          font-size: 12.2px;
          line-height: 1.18;
          font-weight: 900;
          overflow-wrap: anywhere;
        }
        .vo-identity-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 7px;
          margin-bottom: 7px;
        }
        .vo-id-item {
          min-width: 0;
          background: #ffffff;
          border: 1.4px solid #9fb2c8;
          border-radius: 9px;
          padding: 7px 8px;
        }
        .vo-id-item span, .vo-register-line span {
          display: block;
          color: #667085;
          font-size: 9.6px;
          line-height: 1.1;
          font-weight: 1000;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .vo-id-item b, .vo-register-line b {
          display: block;
          color: #172033;
          font-size: 11.6px;
          line-height: 1.18;
          font-weight: 900;
          overflow-wrap: anywhere;
        }
        .vo-register-line {
          display: grid;
          grid-template-columns: minmax(0, 68%) minmax(0, 32%);
          gap: 12px;
          background: #fff7d6;
          border-left: 5px solid #f4b400;
          border-radius: 9px;
          padding: 7px 8px;
        }
        .vo-register-date { text-align: right; }
        .vo-register-date b { color: #1f4e79; font-size: 11.8px; }
        .qr-placeholder, .vo-qr-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 92px;
          height: 92px;
          margin: 0 auto 5px;
          border: 1.2px solid #9fb2c8;
          background: repeating-linear-gradient(45deg, #fff, #fff 5px, #eef6fd 5px, #eef6fd 10px);
          color: #1f4e79;
          font-size: 10px;
          font-weight: 1000;
          text-align: center;
        }
        .vo-qr-note { color: #344054; font-size: 8.8px; line-height: 1.1; font-weight: 1000; }
        .cover-dashboard {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }
        .cover-card {
          min-width: 0;
          border: 1.5px solid #9fb2c8;
          border-radius: 10px;
          background: #ffffff;
          padding: 8px;
        }
        .cover-card.hot { background: linear-gradient(180deg, #fffdf3 0%, #fff7d6 100%); border-color: #f4b400; }
        .cover-card-title { color: #1f4e79; font-size: 10px; font-weight: 1000; text-transform: uppercase; }
        .cover-card-value { margin-top: 6px; color: #172033; font-size: 13px; line-height: 1.12; font-weight: 1000; overflow-wrap: anywhere; }
        .cover-card-note { margin-top: 5px; color: #667085; font-size: 9.5px; line-height: 1.15; font-weight: 800; }
        .status-bad { color: #b91c1c !important; }
        .status-warn { color: #b45309 !important; }
        .status-ok { color: #047857 !important; }
        .cover-info-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; page-break-inside: avoid; }
        .cover-info-box {
          border: 1.5px solid #9fb2c8;
          border-radius: 10px;
          background: #fff;
          padding: 9px 10px;
          color: #344054;
        }
        .cover-info-box.dark { background: #173b63; color: #ffffff; border-color: #173b63; }
        .cover-info-box.yellow { background: #fff7d6; border-color: #f4b400; }
        .cover-info-title { margin-bottom: 6px; color: inherit; font-size: 11px; line-height: 1.1; font-weight: 1000; text-transform: uppercase; }
        .cover-info-line { font-size: 10.8px; line-height: 1.35; font-weight: 750; overflow-wrap: anywhere; }
        .cover-info-line b { font-weight: 1000; }
        .page-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
          padding-bottom: 7px;
          border-bottom: 2px solid #173b63;
          color: #172033;
        }
        .page-head-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .logo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          background: #f4b400;
          border: 1.5px solid #173b63;
          color: #173b63;
          padding: 6px 9px;
          font-size: 10.5px;
          line-height: 1;
          font-weight: 1000;
          white-space: nowrap;
        }
        .doc-name { color: #173b63; font-size: 14px; font-weight: 1000; text-transform: uppercase; }
        .page-head-right { color: #344054; font-size: 10.8px; line-height: 1.35; font-weight: 800; text-align: right; }
        .field {
          min-width: 0;
          border: 1.4px solid #9fb2c8;
          border-radius: 8px;
          background: #eef6fd;
          padding: 7px 8px;
        }
        .field.strong { background: #fff7d6; border-color: #f4b400; }
        .field.strong .field-value { color: #172033; font-weight: 1000; }
        .metric-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin: 0 0 10px;
        }
        .metric {
          min-width: 0;
          border: 1.6px solid #9fb2c8;
          border-radius: 10px;
          background: linear-gradient(135deg, #eaf3fb 0%, #ffffff 100%);
          padding: 10px 11px;
          color: #172033;
        }
        .metric-label {
          color: #1f4e79;
          font-size: 10px;
          line-height: 1.15;
          font-weight: 1000;
          text-transform: uppercase;
        }
        .metric-value {
          margin-top: 6px;
          color: #172033;
          font-size: 18px;
          line-height: 1.1;
          font-weight: 1000;
          overflow-wrap: anywhere;
        }
        .metric-note {
          margin-top: 5px;
          color: #667085;
          font-size: 10px;
          line-height: 1.25;
          font-weight: 800;
        }
        .vp-section-block { page-break-inside: avoid; break-inside: avoid; }
        .section-note {
          margin: 0 0 7px;
          padding: 7px 9px;
          border-left: 5px solid #f4b400;
          border-radius: 8px;
          background: #fff7d6;
          color: #344054;
          font-size: 10.8px;
          line-height: 1.3;
          font-weight: 800;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 0 0 8px;
          border: 2px solid #3f5870;
          background: #ffffff;
          font-size: 10.6px;
          line-height: 1.2;
        }
        th, td {
          border: 1px solid #9fb2c8;
          padding: 5px 6px;
          vertical-align: top;
          overflow-wrap: anywhere;
        }
        thead, .repeat-head { display: table-header-group; }
        th {
          background: #1f4e79;
          color: #ffffff;
          font-size: 9.8px;
          line-height: 1.1;
          font-weight: 1000;
          text-transform: uppercase;
          text-align: center;
        }
        tbody tr:nth-child(even) td { background: #f8fbff; }
        .table-wrap { overflow-x: auto; }
        .empty-cell { color: #667085; padding: 24px 8px; font-weight: 800; }
        .value-strong { color: #172033; font-weight: 1000; }
        .center { text-align: center; }
        .right { text-align: right; }
        .badge {
          display: inline-block;
          border-radius: 999px;
          border: 1.3px solid #9fb2c8;
          padding: 3px 7px;
          font-size: 9.4px;
          line-height: 1.1;
          font-weight: 1000;
          white-space: nowrap;
        }
        .badge-bad { background: #fee2e2; color: #991b1b; border-color: #ef4444; }
        .badge-warn { background: #fef3c7; color: #92400e; border-color: #f59e0b; }
        .badge-ok { background: #dcfce7; color: #166534; border-color: #16a34a; }
        .badge-info { background: #e0f2fe; color: #075985; border-color: #38bdf8; }
        .month-table { min-width: 100%; table-layout: fixed; }
        .month-table th, .month-table td { text-align: center; }
        .month-table .content { text-align: left; width: 170px; }
        .code-cell { background: #fff7d6; color: #173b63; font-weight: 1000; }
        .days-cell { color: #1f4e79; font-weight: 1000; }
        .legend {
          margin: 7px 0 0;
          padding: 7px 9px;
          border-radius: 8px;
          border: 1.3px solid #9fb2c8;
          background: #eef6fd;
          color: #344054;
          font-size: 10.4px;
          line-height: 1.3;
          font-weight: 800;
        }
        .warning-card {
          border: 1.5px solid #9fb2c8;
          border-radius: 10px;
          padding: 9px 10px;
          background: #ffffff;
          color: #344054;
        }
        .warning-bad { background: #fee2e2; border-color: #ef4444; color: #991b1b; }
        .warning-warn { background: #fef3c7; border-color: #f59e0b; color: #92400e; }
        .warning-ok { background: #dcfce7; border-color: #16a34a; color: #166534; }
        .warning-title { font-size: 12px; font-weight: 1000; }
        .warning-note { margin-top: 4px; font-size: 10.5px; line-height: 1.3; font-weight: 800; opacity: .86; }
        .signature {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-top: 28px;
          text-align: center;
          color: #172033;
          font-size: 12px;
          line-height: 1.35;
          font-weight: 1000;
        }
        @media (max-width: 900px) {
          .cover2026, .sheet { width: 100%; min-height: auto; padding: 14px; }
          .executive-header { grid-template-columns: 7px 1fr; }
          .eh-meta-card { grid-column: 2; }
          .vehicle-overview-pro, .cover-info-row { grid-template-columns: 1fr; }
          .cover-dashboard { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .vo-quick-grid, .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .vo-register-line { grid-template-columns: 1fr; }
          .vo-register-date { text-align: left; }
        }
        @media print {
          .vp-toolbar, .vp-no-print { display: none !important; }
          body { background: #ffffff !important; }
          .vp-shell { background: #ffffff !important; padding: 0 !important; }
          .vp-print-area { box-shadow: none !important; gap: 0 !important; }
          .cover2026, .sheet {
            width: 210mm !important;
            min-height: 0 !important;
            margin: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
            page-break-after: auto;
          }
          .avoid-break { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="vp-toolbar rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <Button type="button" variant="ghost" className="mb-2 px-0 text-slate-600" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Về dashboard
              </Button>
              <h1 className="text-2xl font-black tracking-normal text-slate-950">Hồ sơ lý lịch phương tiện</h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">Nhập ID_Xe hoặc mở từ biển số trong dashboard.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                ID_Xe
                <Input className="h-10 min-w-48" value={idInput} onChange={(event) => setIdInput(event.target.value)} placeholder="Nhập ID_Xe" />
              </label>
              <Button type="button" className="h-10 bg-blue-600 hover:bg-blue-700" onClick={() => loadProfile()} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Tải hồ sơ
              </Button>
              <Button type="button" variant="secondary" className="h-10" onClick={() => window.print()} disabled={!profile}>
                <Printer className="mr-2 h-4 w-4" />
                In
              </Button>
              <Button type="button" className="h-10 bg-emerald-600 hover:bg-emerald-700" onClick={handleDownloadPdf} disabled={!profile || exporting}>
                {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Tải PDF
              </Button>
            </div>
          </div>
        </div>

        {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

        {profile && (
          <div ref={printRef} className="vp-print-area">
            <section className="cover2026">
              <div className="executive-header">
                <div className="eh-left-accent" />
                <div className="eh-main">
                  <div className="eh-brand-row">
                    <div className="eh-logo">TAXI 123</div>
                    <div className="eh-title-wrap">
                      <div className="eh-doc-title">Hồ sơ lý lịch phương tiện</div>
                      <div className="eh-company">{profile.company?.tenCongTy || profile.meta?.appName}</div>
                    </div>
                  </div>
                  <div className="eh-info-row">
                    <span className="eh-info-item"><b>Địa chỉ:</b> {valueText(profile.company?.diaChi)}</span>
                    <span className="eh-sep">|</span>
                    <span className="eh-info-item"><b>MST/ĐKKD:</b> {valueText(profile.company?.maSoThue || profile.company?.soDangKyKinhDoanh)}</span>
                    <span className="eh-sep">|</span>
                    <span className="eh-info-item"><b>Điện thoại:</b> {valueText(profile.company?.soDienThoai)}</span>
                  </div>
                </div>
                <div className="eh-meta-card">
                  <div className="eh-meta-line"><span>Năm hồ sơ</span><b>{profile.meta?.year}</b></div>
                  <div className="eh-meta-line"><span>Ngày tạo</span><b>{profile.meta?.printDate}</b></div>
                  <div className="eh-meta-line"><span>Mã xe</span><b>{profile.vehicle?.idXe}</b></div>
                </div>
              </div>

              {bundle?.missingSources?.length > 0 && (
                <div className="vp-no-print mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                  Một số bảng phụ chưa đọc được: {bundle.missingSources.map((item) => item.table).join(', ')}. Hồ sơ vẫn hiển thị phần dữ liệu đã tải được.
                </div>
              )}

              <div className="cover-section-title">
                <div className="cover-section-no">01</div>
                <div className="cover-section-text">Tổng quan phương tiện</div>
              </div>

              <div className="vehicle-overview-pro">
                <div className="vo-card vo-plate-card">
                  <div className="vo-card-title">Biển kiểm soát</div>
                  <div className="vo-plate">{profile.vehicle?.bienSo || profile.vehicle?.idXe}</div>
                  <div className="vo-status">{valueText(profile.vehicle?.trangThaiXe)}</div>
                </div>
                <div className="vo-card vo-quick-card">
                  <div className="vo-card-title">Thông tin xe</div>
                  <div className="vo-quick-grid vo-quick-grid-main">
                    <div className="vo-item"><span>Nhãn hiệu</span><b>{valueText(profile.vehicle?.nhanHieu)}</b></div>
                    <div className="vo-item"><span>Loại xe</span><b>{valueText(profile.vehicle?.loaiXe)}</b></div>
                    <div className="vo-item"><span>Số chỗ</span><b>{valueText(profile.vehicle?.soCho)}</b></div>
                    <div className="vo-item"><span>Năm SX</span><b>{valueText(profile.vehicle?.namSanXuat)}</b></div>
                  </div>
                  <div className="vo-identity-grid">
                    <div className="vo-id-item"><span>Số khung</span><b>{valueText(profile.vehicle?.soKhung)}</b></div>
                    <div className="vo-id-item"><span>Số máy</span><b>{valueText(profile.vehicle?.soMay)}</b></div>
                  </div>
                  <div className="vo-register-line">
                    <div className="vo-register-name">
                      <span>Tên đăng ký xe</span>
                      <b>{valueText(profile.vehicle?.tenDangKyXe)}</b>
                    </div>
                    <div className="vo-register-date">
                      <span>Ngày vào HĐ</span>
                      <b>{valueText(profile.vehicle?.ngayDuaVaoHoatDong || profile.vehicle?.ngayDuaVaoHD)}</b>
                    </div>
                  </div>
                </div>
                <div className="vo-card vo-qr-card">
                  <div className="vo-card-title center">QR hồ sơ xe</div>
                  <div className="vo-qr-wrap qr-placeholder">Chưa tạo<br />được QR</div>
                  <div className="vo-qr-note">Quét để mở hồ sơ</div>
                </div>
              </div>

              <div className="cover-section-title">
                <div className="cover-section-no">02</div>
                <div className="cover-section-text">Tình trạng pháp lý, khai thác và cảnh báo</div>
              </div>

              <div className="cover-dashboard">
                {[
                  ['Đăng kiểm', legalByName(profile, 'Đăng kiểm')],
                  ['Phù hiệu', legalByName(profile, 'Phù hiệu')],
                  ['Bảo hiểm TNDS', legalByName(profile, 'Bảo hiểm TNDS')],
                  ['Taximet', legalByName(profile, 'Taximet')],
                  ['Thế chấp', legalByName(profile, 'Thế chấp')],
                  ['Cảnh báo', { ngayHetHan: `${profile.warnings?.length || 0} nội dung`, trangThai: 'Ưu tiên xử lý màu đỏ/vàng' }]
                ].map(([label, row], index) => (
                  <div key={label} className={`cover-card ${index < 3 ? 'hot' : ''}`}>
                    <div className="cover-card-title">{label}</div>
                    <div className={`cover-card-value ${statusClass(row.trangThai)}`}>{valueText(row.ngayHetHan)}</div>
                    <div className="cover-card-note">{label === 'Cảnh báo' ? row.trangThai : (row.donVi || <StatusBadge value={row.trangThai} />)}</div>
                  </div>
                ))}
              </div>

              <div className="cover-info-row">
                <div className="cover-info-box dark">
                  <div className="cover-info-title">Thông tin khai thác</div>
                  <div className="cover-info-line"><b>Lái xe:</b> {valueText(profile.driver?.hoTen)}</div>
                  <div className="cover-info-line"><b>Điện thoại:</b> {valueText(profile.driver?.soDienThoai)}</div>
                  <div className="cover-info-line"><b>Ngày bắt đầu:</b> {valueText(profile.driver?.ngayBatDau)}</div>
                  <div className="cover-info-line"><b>Đơn vị quản lý:</b> {valueText(profile.vehicle?.donViQuanLy)}</div>
                </div>
                <div className="cover-info-box yellow">
                  <div className="cover-info-title">Sản lượng năm {profile.meta?.year}</div>
                  <div className="cover-info-line"><b>Tổng km:</b> {valueText(profile.technicalSummary?.totalKm)}</div>
                  <div className="cover-info-line"><b>Tổng chuyến:</b> {valueText(profile.technicalSummary?.totalTrips)}</div>
                  <div className="cover-info-line"><b>Bảo dưỡng/Sửa chữa/Cải tạo:</b> {profile.technicalSummary?.totalBD || 0}/{profile.technicalSummary?.totalSC || 0}/{profile.technicalSummary?.totalCT || 0}</div>
                  <div className="cover-info-line"><b>Tổng ngày kỹ thuật:</b> {totalDaysTextFromRows(profile.bdscRows)}</div>
                  <div className="cover-info-line"><b>Chi phí kỹ thuật:</b> {profile.technicalSummary?.totalCost || '0 đ'}</div>
                </div>
                <div className="cover-info-box">
                  <div className="cover-info-title">Cảnh báo nổi bật</div>
                  {(profile.warnings || []).slice(0, 3).map((warning, index) => (
                    <div key={`${warning.level}-${index}`} className="cover-info-line"><b>{warning.level}:</b> {warning.content}</div>
                  ))}
                </div>
              </div>
            </section>

            <Sheet docName="Quản lý, khai thác và lái xe" profile={profile}>
              <Section number="03" title="Lái xe đang khai thác" dark>
                <table>
                  <thead className="repeat-head">
                    <tr>
                      <th className="head-cell">Họ tên</th>
                      <th className="head-cell">CCCD</th>
                      <th className="head-cell">Điện thoại</th>
                      <th className="head-cell">Ngày bắt đầu</th>
                      <th className="head-cell">GPLX</th>
                      <th className="head-cell">Hạng</th>
                      <th className="head-cell">Hạn GPLX</th>
                      <th className="head-cell">Hạn sức khỏe</th>
                      <th className="head-cell">BHXH</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="value-strong">{valueText(profile.driver?.hoTen)}</td>
                      <td>{valueText(profile.driver?.cccd)}</td>
                      <td>{valueText(profile.driver?.soDienThoai)}</td>
                      <td className="center">{valueText(profile.driver?.ngayBatDau)}</td>
                      <td>{valueText(profile.driver?.soGPLX)}</td>
                      <td className="center">{valueText(profile.driver?.hangGPLX)}</td>
                      <td className="center">{valueText(profile.driver?.hanGPLX)}</td>
                      <td className="center">{valueText(profile.driver?.hanSucKhoe)}</td>
                      <td>{valueText(profile.driver?.bhxh)}</td>
                    </tr>
                  </tbody>
                </table>
              </Section>
              <Section number="04" title={`Tổng hợp khai thác năm ${profile.meta?.year}`}>
                <div className="metric-grid">
                  <div className="metric">
                    <div className="metric-label">Tổng km năm</div>
                    <div className="metric-value">{valueText(profile.technicalSummary?.totalKm)}</div>
                    <div className="metric-note">Lũy kế: {valueText(profile.technicalSummary?.lastKm)}</div>
                  </div>
                  <div className="metric">
                    <div className="metric-label">Tổng chuyến năm</div>
                    <div className="metric-value">{valueText(profile.technicalSummary?.totalTrips)}</div>
                    <div className="metric-note">Lũy kế: {valueText(profile.technicalSummary?.lastTrips)}</div>
                  </div>
                  <div className="metric">
                    <div className="metric-label">Bảo dưỡng / sửa chữa / cải tạo</div>
                    <div className="metric-value">{profile.technicalSummary?.totalBD || 0}/{profile.technicalSummary?.totalSC || 0}/{profile.technicalSummary?.totalCT || 0}</div>
                    <div className="metric-note">BD / SC / CT · Tổng ngày: {totalDaysTextFromRows(profile.bdscRows)}</div>
                  </div>
                  <div className="metric">
                    <div className="metric-label">Chi phí kỹ thuật</div>
                    <div className="metric-value">{profile.technicalSummary?.totalCost || '0 đ'}</div>
                    <div className="metric-note">Theo phiếu đã nhập</div>
                  </div>
                </div>
              </Section>
            </Sheet>

            <Sheet docName="Hồ sơ pháp lý phương tiện" profile={profile}>
              <Section number="05" title="Hồ sơ pháp lý phương tiện" icon={ShieldCheck} dark>
                <div className="section-note">Các điều kiện khai thác bắt buộc gồm đăng kiểm, phù hiệu, bảo hiểm, taximet và thế chấp ngân hàng. Nội dung thiếu, hết hạn hoặc sắp hết hạn cần được ưu tiên xử lý.</div>
                <SimpleTable columns={legalColumns} rows={profile.legalRows} />
              </Section>
            </Sheet>

            <Sheet docName="Theo dõi hoạt động và kỹ thuật" profile={profile}>
              <Section number="06" title="Bảng theo dõi hoạt động và kỹ thuật" icon={Wrench} dark>
                <MonthTable rows={profile.monthRows} />
              </Section>
            </Sheet>

            <Sheet docName="Nhật ký kỹ thuật chi tiết" profile={profile}>
              <Section number="07" title="Nhật ký kỹ thuật chi tiết" dark>
                <SimpleTable columns={bdscColumns} rows={profile.bdscRows} />
              </Section>
            </Sheet>

            <Sheet docName="Lịch sử phù hiệu và đăng kiểm" profile={profile}>
              <Section number="08" title="Lịch sử cấp phù hiệu" dark>
                <SimpleTable columns={historyConfigs.find((item) => item.key === 'phuHieu')?.columns || []} rows={profile.histories?.phuHieu || []} soft />
              </Section>
              <Section number="09" title="Lịch sử đăng kiểm">
                <SimpleTable columns={historyConfigs.find((item) => item.key === 'dangKiem')?.columns || []} rows={profile.histories?.dangKiem || []} soft />
              </Section>
            </Sheet>

            <Sheet docName="Lịch sử bảo hiểm và taximet" profile={profile}>
              <Section number="10" title="Lịch sử bảo hiểm" dark>
                <SimpleTable columns={historyConfigs.find((item) => item.key === 'baoHiem')?.columns || []} rows={profile.histories?.baoHiem || []} soft />
              </Section>
              <Section number="11" title="Lịch sử kiểm định taximet">
                <SimpleTable columns={historyConfigs.find((item) => item.key === 'taximet')?.columns || []} rows={profile.histories?.taximet || []} soft />
              </Section>
            </Sheet>

            <Sheet docName="Lịch sử quản lý xe" profile={profile}>
              <Section number="12" title="Lịch sử thế chấp ngân hàng" dark>
                <SimpleTable columns={historyConfigs.find((item) => item.key === 'theChap')?.columns || []} rows={profile.histories?.theChap || []} soft />
              </Section>
              <Section number="13" title="Lịch sử xe ngừng hoạt động">
                <SimpleTable columns={historyConfigs.find((item) => item.key === 'ngungHoatDong')?.columns || []} rows={profile.histories?.ngungHoatDong || []} soft />
              </Section>
              <Section number="14" title="Lịch sử lái xe">
                <SimpleTable columns={historyConfigs.find((item) => item.key === 'laiXe')?.columns || []} rows={profile.histories?.laiXe || []} soft />
              </Section>
            </Sheet>

            <Sheet docName="Cảnh báo quản trị và xác nhận hồ sơ" profile={profile}>
              <Section number="15" title="Cảnh báo quản trị cần theo dõi" dark>
                <WarningList warnings={profile.warnings} />
              </Section>
              <div className="signature">
                <div>NGƯỜI LẬP HỒ SƠ<br /><br /><br /><br />........................................</div>
                <div>LÃNH ĐẠO ĐƠN VỊ<br /><br /><br /><br />........................................</div>
              </div>
            </Sheet>
          </div>
        )}
      </div>
    </div>
  );
};

export default VehicleProfilePage;
