import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '../../components/ui/button';
import {
  buildBienDong,
  buildDashboardExcelWorkbook,
  buildKpiHoSo,
  buildKpiNhanSu,
  buildKpiPhuongTien,
  buildTuanThu,
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
    { key: 'xe_xuat_hang', ten: 'Xe xuất hãng', type: 'xe', dateKeys: ['ngayXuatHang'], filter: (r) => normalizeText(r.daXuatHang) === 'co' },
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
    { key: 'het_taximet', ten: 'Xe sắp/đã hết hạn taximet', source: 'table', tableKey: 'het_taximet', dateKey: 'ngayHetHan' },
    { key: 'xe_thechap', ten: 'Danh sách xe đang thế chấp', source: 'table', tableKey: 'xe_thechap' },
    { key: 'xe_thoathuan_tnds', ten: 'Thỏa thuận dân sự (TNDS) lái xe', source: 'table', tableKey: 'xe_thoathuan_tnds' },
    { key: 'het_gplx', ten: 'Lái xe sắp/đã hết hạn GPLX', type: 'nhan-su', dateKeys: ['hanGplx'], filter: (r) => hasCanhBao(r, 'GPLX') },
    { key: 'ns_sap_het_skhoe', ten: 'Lái xe sắp/đã hết hạn sức khỏe', source: 'table', tableKey: 'ns_sap_het_skhoe', dateKey: 'ngayHetHan' },
    { key: 'ns_sap_het_daotao', ten: 'Lái xe sắp/đã hết hạn đào tạo/tập huấn', source: 'table', tableKey: 'ns_sap_het_daotao', dateKey: 'ngayHetHan' },
    { key: 'ns_sap_het_hdld', ten: 'HĐLĐ sắp/đã hết hạn', source: 'table', tableKey: 'ns_sap_het_hdld', dateKey: 'ngayHetHan' }
  ] },
  { group: 'Khen thưởng / vi phạm / phản ánh', items: [
    { key: 'ns_khenthuong_kyluat', ten: 'Danh sách khen thưởng / kỷ luật', source: 'table', tableKey: 'ns_khenthuong_kyluat', dateKey: 'NgayApDung' },
    { key: 'lx_vipham_atgt', ten: 'Danh sách vi phạm ATGT', source: 'table', tableKey: 'lx_vipham_atgt', dateKey: 'NgayViPham' },
    { key: 'lx_vipham_noibo', ten: 'Danh sách vi phạm nội bộ', source: 'table', tableKey: 'lx_vipham_noibo', dateKey: 'NgayViPham' },
    { key: 'phan_anh', ten: 'Danh sách phản ánh / kiến nghị', source: 'table', tableKey: 'phan_anh', dateKey: 'NgayPhanAnh' }
  ] },
  { group: 'Báo cáo tổng hợp', items: [
    { key: 'tt_tong_hop', ten: 'Tổng hợp tuân thủ pháp lý', source: 'compute', compute: 'tuanThu' },
    { key: 'bd_tong_hop', ten: 'Tổng hợp biến động (6 tháng)', source: 'compute', compute: 'bienDong' },
    { key: 'kpi_tong_hop', ten: 'Bảng chỉ số tổng quan toàn hệ thống', source: 'compute', compute: 'kpi' }
  ] }
];

// Dựng 3 báo cáo tổng hợp từ dữ liệu compute client (tuân thủ / biến động / KPI).
function buildComputeReport(kind, xe, nhanSu, hoSoSummary) {
  if (kind === 'tuanThu') {
    const tt = buildTuanThu(nhanSu, xe, hoSoSummary);
    const rows = [
      ...tt.phuongTien.map((h) => ({ doiTuong: 'Phương tiện', nhom: h.nhom, du: h.conHan, sap: h.sapHet, qua: h.quaHan, tyLe: `${h.tyLe}%` })),
      ...tt.nhanSu.map((h) => ({ doiTuong: 'Nhân sự', nhom: h.nhom, du: h.conHan, sap: h.sapHet, qua: h.quaHan, tyLe: `${h.tyLe}%` }))
    ];
    return { columns: [['doiTuong', 'Đối tượng'], ['nhom', 'Hạng mục'], ['du', 'Đủ điều kiện'], ['sap', 'Sắp hết hạn'], ['qua', 'Quá hạn'], ['tyLe', 'Tỷ lệ tuân thủ']], rows };
  }
  if (kind === 'bienDong') {
    const bd = buildBienDong(nhanSu, xe);
    const r = (ten, t) => ({ doiTuong: ten, dauKy: t.dauKy, tang: `+${t.nhap}`, giam: `-${t.xuat}`, cuoiKy: t.cuoiKy, tangGiam: `${t.tangGiam >= 0 ? '+' : ''}${t.tangGiam}` });
    return {
      columns: [['doiTuong', 'Đối tượng'], ['dauKy', 'Đầu kỳ'], ['tang', 'Tăng'], ['giam', 'Giảm'], ['cuoiKy', 'Cuối kỳ'], ['tangGiam', 'Tăng/giảm']],
      rows: [r('Phương tiện', bd.phuongTien.tong), r('Nhân sự', bd.nhanSu.tong)]
    };
  }
  // kpi tổng quan
  const p = buildKpiPhuongTien(xe);
  const n = buildKpiNhanSu(nhanSu);
  const h = buildKpiHoSo(nhanSu, xe, hoSoSummary).kpi;
  const rows = [
    { chiTieu: 'Tổng số xe', giaTri: p.tong, tyLe: '' },
    { chiTieu: 'Xe đang hoạt động', giaTri: p.dangHoatDong, tyLe: `${p.tlDangHoatDong}%` },
    { chiTieu: 'Xe ngừng hoạt động', giaTri: p.ngung, tyLe: `${p.tlNgung}%` },
    { chiTieu: 'Xe xuất hãng', giaTri: p.xuatHang, tyLe: `${p.tlXuatHang}%` },
    { chiTieu: 'Tổng nhân sự', giaTri: n.tong, tyLe: '' },
    { chiTieu: 'Nhân sự đang làm việc', giaTri: n.dangLam, tyLe: `${n.tlDangLam}%` },
    { chiTieu: 'Chưa tham gia BHXH', giaTri: n.chuaBHXH, tyLe: `${n.tlChuaBHXH}%` },
    { chiTieu: 'Tổng hồ sơ pháp lý', giaTri: h.tong, tyLe: '' },
    { chiTieu: 'Hồ sơ còn hiệu lực', giaTri: h.conHieuLuc, tyLe: `${h.tlConHieuLuc}%` },
    { chiTieu: 'Hồ sơ sắp hết hạn', giaTri: h.sapHetHan, tyLe: `${h.tlSapHetHan}%` },
    { chiTieu: 'Hồ sơ quá hạn', giaTri: h.quaHan, tyLe: `${h.tlQuaHan}%` }
  ];
  return { columns: [['chiTieu', 'Chỉ tiêu'], ['giaTri', 'Giá trị'], ['tyLe', 'Tỷ lệ']], rows };
}

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
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const xe = useMemo(() => filterXeRows(data?.reports?.xe || [], filters), [data, filters]);
  const nhanSu = useMemo(() => filterNhanSuRows(data?.reports?.nhanSu || [], filters), [data, filters]);

  const report = useMemo(() => {
    if (!current) return null;
    const from = parseDay(tuNgay);
    const to = parseDay(denNgay);

    // Báo cáo tổng hợp tính ở client (tuân thủ / biến động / KPI).
    if (current.source === 'compute') {
      const built = buildComputeReport(current.compute, xe, nhanSu, data?.hoSoSummary);
      const rows = built.rows.map((row, index) => ({ ...row, stt: index + 1 }));
      return { ...current, columns: built.columns, rows, kind: 'compute' };
    }

    // Báo cáo dựng sẵn từ backend (reportTables): có columns + rows riêng.
    if (current.source === 'table') {
      const tbl = data?.reportTables?.[current.tableKey] || { columns: [], rows: [] };
      const dateKey = current.dateKey;
      const rows = tbl.rows
        .filter((r) => {
          if (!from && !to) return true;
          if (!dateKey) return true;
          const day = parseDay(r[dateKey]);
          if (day == null) return false;
          return (!from || day >= from) && (!to || day <= to);
        })
        .map((row, index) => ({ ...row, stt: index + 1 }));
      return { ...current, columns: tbl.columns, rows, kind: 'table' };
    }

    // Báo cáo lọc client trên xe/nhân sự.
    const src = current.type === 'xe' ? xe : nhanSu;
    const rows = src
      .filter(current.filter)
      .filter((r) => inDateRange(r, current.dateKeys, from, to))
      .map((row, index) => ({ ...row, stt: index + 1 }));
    return { ...current, columns: PREVIEW_COLS[current.type], rows, kind: current.type };
  }, [current, xe, nhanSu, tuNgay, denNgay, data]);

  // Reset về trang 1 khi đổi báo cáo hoặc bộ lọc ngày.
  useEffect(() => { setPage(1); }, [current, tuNgay, denNgay]);

  const totalRows = report ? report.rows.length : 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = totalRows ? (safePage - 1) * PAGE_SIZE : 0;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalRows);
  const pageRows = report ? report.rows.slice(startIndex, endIndex) : [];

  async function exportExcel() {
    if (!report || report.rows.length === 0) { toast.info('Không có dữ liệu để xuất.'); return; }
    setExporting(true);
    try {
      const [ExcelJS, fileSaver] = await Promise.all([import('exceljs'), import('file-saver')]);
      const token = new Date().toISOString().slice(0, 10);
      let workbook;
      if (report.kind === 'xe' || report.kind === 'nhan-su') {
        workbook = await buildDashboardExcelWorkbook(ExcelJS, report.kind === 'xe' ? 'xe' : 'nhan-su', report.rows);
      } else {
        // Báo cáo bảng dựng sẵn: tạo workbook theo columns động.
        const Workbook = ExcelJS.Workbook || ExcelJS.default?.Workbook;
        workbook = new Workbook();
        const ws = workbook.addWorksheet('Báo cáo');
        ws.columns = [{ key: 'stt', header: 'STT', width: 6 }].concat(report.columns.map(([k, h]) => ({ key: k, header: h, width: Math.min(Math.max(h.length + 6, 14), 40) })));
        report.rows.forEach((r, i) => ws.addRow({ ...r, stt: i + 1 }));
        ws.views = [{ state: 'frozen', ySplit: 1 }];
        ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
      }
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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

  const cols = report ? report.columns : [];

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

            {/* Lọc theo khoảng thời gian — chỉ với báo cáo danh sách (không phải tổng hợp) */}
            {report.kind !== 'compute' && (
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
            )}
            <div className="overflow-auto rounded-md border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5 font-bold">STT</th>
                    {cols.map(([, label]) => <th key={label} className="px-3 py-2.5 font-bold">{label}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageRows.map((row) => (
                    <tr key={`${report.key}-${row.stt}`} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 text-slate-500">{row.stt}</td>
                      {cols.map(([key]) => {
                        const wrap = key === 'canhBao' || /noidung|nội dung/i.test(key) || key === 'NoiDung' || key === 'NoiDungPhanAnh' || key === 'NoiDungViPham' || key === 'HanhViViPham';
                        return (
                          <td key={key} className={`px-3 py-2.5 text-slate-700 ${wrap ? 'min-w-[200px] max-w-[340px] whitespace-normal' : 'whitespace-nowrap'}`}>{row[key] || ''}</td>
                        );
                      })}
                    </tr>
                  ))}
                  {totalRows === 0 && (
                    <tr><td colSpan={cols.length + 1} className="px-3 py-8 text-center text-sm text-slate-500">Không có dữ liệu phù hợp.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Phân trang */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
              <div className="font-semibold">
                {totalRows > 0 ? `Hiển thị ${formatNumber(startIndex + 1)}-${formatNumber(endIndex)} / ${formatNumber(totalRows)} dòng` : 'Không có dòng'}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPage(safePage - 1)} disabled={safePage <= 1} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40">‹</button>
                <span className="min-w-24 text-center font-bold text-slate-700">Trang {safePage} / {totalPages}</span>
                <button type="button" onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40">›</button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default BaoCaoTab;
