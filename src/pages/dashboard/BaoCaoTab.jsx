import React, { useMemo, useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '../../components/ui/button';
import {
  buildDashboardExcelWorkbook,
  filterNhanSuRows,
  filterXeRows,
  normalizeText,
  warningItemMatchesLoai
} from '../../features/dashboardQlvt';
import { parseDateValue } from '../../lib/dateFormat';
import { useDashboard } from './DashboardContext';
import { DateInput, formatNumber } from './components';

// Bộ lọc riêng cho từng báo cáo — áp trên data.reports đã lọc chung của màn.
function hasCanhBao(row, loai) {
  return (Array.isArray(row.warningItems) ? row.warningItems : [])
    .some((item) => warningItemMatchesLoai(item, loai) && (normalizeText(item.level) === 'do' || normalizeText(item.level) === 'vang'));
}

// dateKeys: các cột ngày dùng cho bộ lọc "Từ ngày / Đến ngày" của báo cáo.
const REPORTS = [
  { group: 'Báo cáo phương tiện', items: [
    { key: 'xe_dang_hd', ten: 'Xe đang hoạt động', type: 'xe', dateKeys: ['ngayDuaVaoHoatDong'], filter: (r) => normalizeText(r.trangThaiXe).includes('hoat dong') || (!!r.trangThaiXe && !normalizeText(r.trangThaiXe).includes('ngung')) },
    { key: 'xe_ngung', ten: 'Xe ngừng hoạt động', type: 'xe', dateKeys: ['ngayNgungHoatDong'], filter: (r) => normalizeText(r.trangThaiXe).includes('ngung') },
    { key: 'xe_chua_lx', ten: 'Xe chưa có lái xe', type: 'xe', dateKeys: ['ngayDuaVaoHoatDong'], filter: (r) => !r.laiXeDangLai }
  ] },
  { group: 'Báo cáo nhân sự', items: [
    { key: 'ns_dang_lam', ten: 'Nhân sự đang làm việc', type: 'nhan-su', dateKeys: ['ngayNhanViec'], filter: (r) => !!r.trangThaiLamViec && !normalizeText(r.trangThaiLamViec).includes('nghi') },
    { key: 'ns_chua_xe', ten: 'Nhân sự chưa có xe', type: 'nhan-su', dateKeys: ['ngayNhanViec'], filter: (r) => !r.bienSoXe && !r.xeDangLai },
    { key: 'ns_chua_bhxh', ten: 'Nhân sự chưa tham gia BHXH', type: 'nhan-su', dateKeys: ['ngayNhanViec'], filter: (r) => !normalizeText(r.trangThaiBhxh).includes('dang tham gia') }
  ] },
  { group: 'Báo cáo hồ sơ pháp lý', items: [
    { key: 'het_dangkiem', ten: 'Xe sắp/đã hết hạn đăng kiểm', type: 'xe', dateKeys: ['hanDangKiem'], filter: (r) => hasCanhBao(r, 'Đăng kiểm') },
    { key: 'het_phuhieu', ten: 'Xe sắp/đã hết hạn phù hiệu', type: 'xe', dateKeys: ['hanPhuHieu'], filter: (r) => hasCanhBao(r, 'Phù hiệu') },
    { key: 'het_baohiem', ten: 'Xe sắp/đã hết hạn bảo hiểm', type: 'xe', dateKeys: ['hanBaoHiemTnds', 'hanBaoHiemThanVo'], filter: (r) => hasCanhBao(r, 'Bảo hiểm') },
    { key: 'het_taximet', ten: 'Xe sắp/đã hết hạn taximet', type: 'xe', dateKeys: ['hanTaximet'], filter: (r) => hasCanhBao(r, 'Taximet') },
    { key: 'het_gplx', ten: 'Lái xe sắp/đã hết hạn GPLX', type: 'nhan-su', dateKeys: ['hanGplx'], filter: (r) => hasCanhBao(r, 'GPLX') },
    { key: 'het_skhoe', ten: 'Lái xe sắp/đã hết hạn sức khỏe', type: 'nhan-su', dateKeys: ['hanSucKhoe'], filter: (r) => hasCanhBao(r, 'Sức khỏe') },
    { key: 'het_hdld', ten: 'HĐLĐ sắp/đã hết hạn', type: 'nhan-su', dateKeys: ['ngayKetThuc'], filter: (r) => hasCanhBao(r, 'Hợp đồng lao động') }
  ] }
];

// Lọc theo khoảng ngày trên các cột mốc của báo cáo.
function inDateRange(row, dateKeys, from, to) {
  if (!from && !to) return true;
  const days = (dateKeys || [])
    .map((k) => parseDateValue(row?.[k]))
    .filter(Boolean)
    .map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime());
  if (days.length === 0) return false; // có lọc mà không có ngày -> loại (giống .gs)
  return days.some((day) => (!from || day >= from) && (!to || day <= to));
}
function parseDay(value) {
  const d = parseDateValue(value);
  return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() : null;
}

const PREVIEW_COLS = {
  xe: [['bienSo', 'Biển số'], ['loaiXe', 'Loại xe'], ['doiXe', 'Đội xe'], ['trangThaiXe', 'Trạng thái'], ['laiXeDangLai', 'Lái xe'], ['canhBao', 'Cảnh báo']],
  'nhan-su': [['hoTen', 'Họ tên'], ['doiXe', 'Đội xe'], ['chucDanh', 'Chức danh'], ['trangThaiLamViec', 'Trạng thái'], ['bienSoXe', 'Biển số'], ['canhBao', 'Cảnh báo']]
};

const BaoCaoTab = () => {
  const { data, loading, filtersByScreen } = useDashboard();
  const filters = filtersByScreen['bao-cao'];
  const [current, setCurrent] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [tuNgay, setTuNgay] = useState('');
  const [denNgay, setDenNgay] = useState('');

  const xe = useMemo(() => filterXeRows(data?.reports?.xe || [], filters), [data, filters]);
  const nhanSu = useMemo(() => filterNhanSuRows(data?.reports?.nhanSu || [], filters), [data, filters]);

  const report = useMemo(() => {
    if (!current) return null;
    const source = current.type === 'xe' ? xe : nhanSu;
    const from = parseDay(tuNgay);
    const to = parseDay(denNgay);
    const rows = source
      .filter(current.filter)
      .filter((r) => inDateRange(r, current.dateKeys, from, to))
      .map((row, index) => ({ ...row, stt: index + 1 }));
    return { ...current, rows };
  }, [current, xe, nhanSu, tuNgay, denNgay]);

  async function exportExcel() {
    if (!report || report.rows.length === 0) { toast.info('Không có dữ liệu để xuất.'); return; }
    setExporting(true);
    try {
      const [ExcelJS, fileSaver] = await Promise.all([import('exceljs'), import('file-saver')]);
      const workbook = await buildDashboardExcelWorkbook(ExcelJS, report.type === 'xe' ? 'xe' : 'nhan-su', report.rows);
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const token = new Date().toISOString().slice(0, 10);
      (fileSaver.saveAs || fileSaver.default)(blob, `${report.key}_${token}.xlsx`);
    } catch (error) {
      toast.error(`Xuất Excel thất bại: ${error.message}`);
    } finally {
      setExporting(false);
    }
  }

  if (loading && !data) {
    return <div className="mt-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white py-16 text-sm font-semibold text-slate-500">Đang tải danh mục báo cáo…</div>;
  }

  const cols = report ? PREVIEW_COLS[report.type] : [];

  return (
    <section className="mt-5 grid min-w-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-slate-700">Nhóm báo cáo</h2>
        <div className="space-y-4">
          {REPORTS.map((group) => (
            <div key={group.group}>
              <p className="mb-1.5 text-[11px] font-semibold text-slate-400">{group.group}</p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => { setCurrent(item); setTuNgay(''); setDenNgay(''); }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${current?.key === item.key ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    {item.ten}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        {!report ? (
          <div className="grid place-items-center py-20 text-center text-slate-500">
            <FileText className="h-12 w-12 text-slate-300" />
            <h3 className="mt-3 text-lg font-bold text-slate-700">Chọn một báo cáo bên trái</h3>
            <p className="mt-1 text-sm">Xem trước dữ liệu thật rồi xuất Excel.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-950">{report.ten}</h2>
                <p className="mt-1 text-sm text-slate-500">{formatNumber(report.rows.length)} dòng.</p>
              </div>
              <Button type="button" className="h-9 bg-emerald-500 hover:bg-emerald-600" onClick={exportExcel} disabled={exporting}>
                {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Xuất Excel
              </Button>
            </div>

            {/* Lọc theo khoảng thời gian mốc của báo cáo */}
            <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-slate-100 bg-slate-50/70 p-3">
              <div className="w-40"><DateInput label="Từ ngày" value={tuNgay} onChange={setTuNgay} /></div>
              <div className="w-40"><DateInput label="Đến ngày" value={denNgay} onChange={setDenNgay} /></div>
              <button
                type="button"
                onClick={() => { setTuNgay(''); setDenNgay(''); }}
                className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-300"
              >
                Bỏ lọc
              </button>
              <span className="text-xs text-slate-400">Lọc theo mốc thời gian của báo cáo (ngày hết hạn / ngày phát sinh).</span>
            </div>
            <div className="max-h-[540px] overflow-auto rounded-md border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5 font-bold">STT</th>
                    {cols.map(([, label]) => <th key={label} className="px-3 py-2.5 font-bold">{label}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.rows.map((row) => (
                    <tr key={`${report.key}-${row.stt}`} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 text-slate-500">{row.stt}</td>
                      {cols.map(([key]) => (
                        <td key={key} className={`px-3 py-2.5 text-slate-700 ${key === 'canhBao' ? 'min-w-[220px] max-w-[320px] whitespace-normal' : 'whitespace-nowrap'}`}>{row[key] || ''}</td>
                      ))}
                    </tr>
                  ))}
                  {report.rows.length === 0 && (
                    <tr><td colSpan={cols.length + 1} className="px-3 py-8 text-center text-sm text-slate-500">Không có dữ liệu phù hợp.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default BaoCaoTab;
