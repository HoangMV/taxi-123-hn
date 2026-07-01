import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Car, Download, Gauge, Loader2, ShieldCheck, Stamp } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '../../components/ui/button';
import {
  LOAI_GIAY_TO_XE,
  TINH_TRANG_HAN_OPTIONS,
  buildCanhBaoList,
  buildDashboardExcelFileName,
  buildDashboardExcelWorkbook,
  buildKpiPhuongTien,
  buildThongKeDonVi,
  countBy,
  filterXeRows
} from '../../features/dashboardQlvt';
import { useDashboard } from './DashboardContext';
import {
  AlertTable,
  ChartPanel,
  FilterActions,
  DateInput,
  FilterBar,
  MetricCard,
  QuickRangeButtons,
  SectionCard,
  SelectFilter,
  formatNumber
} from './components';
import { BarJs, DonutJs } from './Charts';
import DataTable from './DataTable';

const SCREEN = 'phuong-tien';
const warningLabels = { do: 'Đỏ', vang: 'Vàng', xanh: 'Xanh', xam: 'Xám' };

function getOptions(data, key) {
  return Array.isArray(data?.filters?.[key]) ? data.filters[key].filter(Boolean) : [];
}

function toNumber(value) {
  if (typeof value === 'number') return value;
  return Number(String(value || '').replace(/[^0-9.-]/g, '') || 0);
}

function buildTopRows(rows, key, labelKey) {
  return [...rows]
    .map((row) => ({ label: row[labelKey] || row.idXe || 'Chưa có dữ liệu', value: toNumber(row[key]) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

function buildDonutItems(rows, key) {
  const items = countBy(rows, key).sort((a, b) => Number(b.value || 0) - Number(a.value || 0)).slice(0, 6);
  return items.length ? items : [{ label: 'Chưa có dữ liệu', value: 0 }];
}

const PhuongTienTab = () => {
  const { data, loading, filtersByScreen, setScreenFilters } = useDashboard();
  const filters = filtersByScreen[SCREEN];
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [exporting, setExporting] = useState(false);

  const xe = useMemo(() => filterXeRows(data?.reports?.xe || [], filters), [data, filters]);
  const kpi = useMemo(() => buildKpiPhuongTien(xe), [xe]);
  const topKm = useMemo(() => buildTopRows(xe, 'kmLuyKe', 'bienSo'), [xe]);
  const topChuyen = useMemo(() => buildTopRows(xe, 'soChuyenThang', 'bienSo'), [xe]);
  const thongKeDonVi = useMemo(() => buildThongKeDonVi(xe), [xe]);
  const theoNam = useMemo(() => {
    const c = {};
    xe.forEach((r) => { const n = String(r.namSanXuat || '').match(/(\d{4})/); if (n) c[n[1]] = (c[n[1]] || 0) + 1; });
    return Object.keys(c).sort().map((k) => ({ label: k, value: c[k] }));
  }, [xe]);
  const phanBoDoi = useMemo(() => countBy(xe, 'doiXe').sort((a, b) => b.value - a.value).slice(0, 12), [xe]);
  const canhBao = useMemo(() => buildCanhBaoList(xe, { hoTenKey: 'bienSo', phuKey: 'nhanHieu', trangThaiKey: 'trangThaiXe' }), [xe]);

  const totalPages = Math.max(1, Math.ceil(xe.length / pageSize));
  useEffect(() => { setPage(1); }, [filters, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const setFilter = (key, value) => setScreenFilters(SCREEN, (current) => ({ ...current, [key]: value }));
  const setRange = (tuNgay, denNgay) => setScreenFilters(SCREEN, (current) => ({ ...current, tuNgay, denNgay }));
  const resetFilters = () => setScreenFilters(SCREEN, {
    ...filtersByScreen[SCREEN], donVi: '', doiXe: '', loaiXe: '', trangThaiXe: '', loaiGiayTo: '', tinhTrangHan: '', nhomCanhBao: '', tuNgay: '', denNgay: '', nhomTrangThaiXe: ''
  });

  async function exportExcel() {
    if (xe.length === 0) { toast.info('Không có dữ liệu để xuất Excel.'); return; }
    setExporting(true);
    try {
      const [ExcelJS, fileSaver] = await Promise.all([import('exceljs'), import('file-saver')]);
      const workbook = await buildDashboardExcelWorkbook(ExcelJS, 'xe', xe);
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      (fileSaver.saveAs || fileSaver.default)(blob, buildDashboardExcelFileName('xe'));
    } catch (error) {
      toast.error(`Xuất Excel thất bại: ${error.message}`);
    } finally {
      setExporting(false);
    }
  }

  if (loading && !data) {
    return <div className="mt-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white py-16 text-sm font-semibold text-slate-500">Đang tải dữ liệu phương tiện…</div>;
  }

  return (
    <>
      <FilterBar>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
          <SelectFilter label="Đơn vị" value={filters.donVi} options={getOptions(data, 'donVi')} onChange={(v) => setFilter('donVi', v)} />
          <SelectFilter label="Đội xe" value={filters.doiXe} options={getOptions(data, 'doiXe')} onChange={(v) => setFilter('doiXe', v)} />
          <SelectFilter label="Loại xe" value={filters.loaiXe} options={getOptions(data, 'loaiXe')} onChange={(v) => setFilter('loaiXe', v)} />
          <SelectFilter label="Trạng thái xe" value={filters.trangThaiXe} options={getOptions(data, 'trangThaiXe')} onChange={(v) => setFilter('trangThaiXe', v)} />
          <SelectFilter label="Loại giấy tờ" value={filters.loaiGiayTo} options={LOAI_GIAY_TO_XE} onChange={(v) => setFilter('loaiGiayTo', v)} allLabel="Tất cả giấy tờ" />
          <SelectFilter label="Tình trạng hạn" value={filters.tinhTrangHan} options={TINH_TRANG_HAN_OPTIONS} onChange={(v) => setFilter('tinhTrangHan', v)} allLabel="Tất cả tình trạng" />
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <SelectFilter label="Cảnh báo" value={filters.nhomCanhBao} options={getOptions(data, 'nhomCanhBao')} getOptionLabel={(o) => warningLabels[o] || o} onChange={(v) => setFilter('nhomCanhBao', v)} />
            <DateInput label="Từ ngày" value={filters.tuNgay} onChange={(v) => setFilter('tuNgay', v)} />
            <DateInput label="Đến ngày" value={filters.denNgay} onChange={(v) => setFilter('denNgay', v)} />
          </div>
          <FilterActions onReset={resetFilters} />
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
          <span className="text-[11px] font-semibold text-slate-400">Chọn nhanh:</span>
          <QuickRangeButtons filters={filters} setRange={setRange} />
        </div>
      </FilterBar>

      <section className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <MetricCard icon={Car} label="Tổng số xe" value={kpi.tong} percent="Theo bộ lọc" tone="bg-indigo-50 text-indigo-700" barColor="bg-indigo-500" ratio={1} />
        <MetricCard icon={Gauge} label="Đang hoạt động" value={kpi.dangHoatDong} percent={`${kpi.tlDangHoatDong}%`} tone="bg-cyan-50 text-cyan-700" barColor="bg-cyan-500" ratio={kpi.tong ? kpi.dangHoatDong / kpi.tong : 0} onClick={() => setFilter('nhomTrangThaiXe', filters.nhomTrangThaiXe === 'hoat-dong' ? '' : 'hoat-dong')} active={filters.nhomTrangThaiXe === 'hoat-dong'} />
        <MetricCard icon={AlertTriangle} label="Ngừng hoạt động" value={kpi.ngung} percent={`${kpi.tlNgung}%`} tone="bg-red-50 text-red-700" barColor="bg-red-500" ratio={kpi.tong ? kpi.ngung / kpi.tong : 0} onClick={() => setFilter('nhomTrangThaiXe', filters.nhomTrangThaiXe === 'ngung' ? '' : 'ngung')} active={filters.nhomTrangThaiXe === 'ngung'} />
        <MetricCard icon={Stamp} label="Xuất hãng" value={kpi.xuatHang} percent={`${kpi.tlXuatHang}%`} tone="bg-amber-50 text-amber-700" barColor="bg-amber-500" ratio={kpi.tong ? kpi.xuatHang / kpi.tong : 0} />
        <MetricCard icon={ShieldCheck} label="Chưa phân công lái xe" value={kpi.chuaPhanCong} percent={`${kpi.tlChuaPhanCong}%`} tone="bg-blue-50 text-blue-700" barColor="bg-blue-500" ratio={kpi.tong ? kpi.chuaPhanCong / kpi.tong : 0} />
        <MetricCard icon={Car} label="Có nhiều lái xe" value={kpi.nhieuLaiXe} percent={`${kpi.tlNhieuLaiXe}%`} tone="bg-slate-100 text-slate-600" barColor="bg-slate-400" ratio={kpi.tong ? kpi.nhieuLaiXe / kpi.tong : 0} />
      </section>

      <section className="mt-5">
        <ChartPanel title="Cơ cấu đội xe" totalLabel={`${formatNumber(xe.length)} xe`}>
          <DonutJs title="Xe theo trạng thái" items={buildDonutItems(xe, 'trangThaiXe')} />
          <DonutJs title="Xe theo nhãn hiệu" items={buildDonutItems(xe, 'nhanHieu')} />
          <DonutJs title="Xe theo loại" items={buildDonutItems(xe, 'loaiXe')} />
          <DonutJs title="Xe theo đội xe" items={buildDonutItems(xe, 'doiXe')} />
        </ChartPanel>
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-2">
        <SectionCard title="📅 Xe theo năm sản xuất">
          <BarJs items={theoNam} color="#2563eb" />
        </SectionCard>
        <SectionCard title="🚚 Phân bố theo đội xe">
          <BarJs items={phanBoDoi} horizontal multiColor height={320} />
        </SectionCard>
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-2">
        <SectionCard title="🚀 Top 10 xe nhiều chuyến nhất">
          <BarJs items={topChuyen} horizontal color="#16a34a" unit="chuyến" height={320} />
        </SectionCard>
        <SectionCard title="🛣️ Top 10 xe chạy nhiều km nhất">
          <BarJs items={topKm} horizontal color="#06b6d4" unit="km" height={320} />
        </SectionCard>
      </section>

      {/* Thống kê theo đơn vị */}
      <SectionCard className="mt-5" title="🏢 Thống kê theo đơn vị" badge={`${thongKeDonVi.length} đơn vị`}>
        <div className="overflow-auto rounded-md border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2.5 font-bold">Đơn vị</th>
                <th className="px-3 py-2.5 text-center font-bold">Tổng xe</th>
                <th className="px-3 py-2.5 text-center font-bold">Đang HĐ</th>
                <th className="px-3 py-2.5 text-center font-bold">Xuất hãng</th>
                <th className="px-3 py-2.5 text-center font-bold">Ngừng HĐ</th>
                <th className="px-3 py-2.5 text-center font-bold">Chưa phân công</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {thongKeDonVi.map((row) => (
                <tr key={row.donVi} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-semibold text-slate-800">{row.donVi}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-slate-900">{formatNumber(row.tong)}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-emerald-600">{formatNumber(row.dangHD)}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-amber-600">{formatNumber(row.xuatHang)}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-red-600">{formatNumber(row.ngung)}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-blue-600">{formatNumber(row.chuaPC)}</td>
                </tr>
              ))}
              {thongKeDonVi.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">Không có dữ liệu.</td></tr>}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Danh sách cảnh báo phương tiện */}
      <SectionCard className="mt-5" title={<><AlertTriangle className="h-4 w-4 text-amber-500" /> Danh sách cảnh báo phương tiện</>} badge={formatNumber(canhBao.length)}>
        <AlertTable rows={canhBao} firstCol="Biển số" secondCol="Đội xe" />
      </SectionCard>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-950">Danh sách phương tiện</h2>
            <p className="mt-1 text-sm text-slate-500">Có {formatNumber(xe.length)} dòng sau lọc. Excel xuất toàn bộ dữ liệu đang lọc.</p>
          </div>
          <Button type="button" className="h-9 bg-emerald-500 hover:bg-emerald-600" onClick={exportExcel} disabled={exporting}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Xuất phương tiện
          </Button>
        </div>
        <div className="p-4">
          <DataTable type="xe" rows={xe} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </div>
      </section>
    </>
  );
};

export default PhuongTienTab;
