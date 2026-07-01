import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BriefcaseBusiness, Car, FileSpreadsheet, HeartPulse, IdCard, Loader2, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '../../components/ui/button';
import {
  LOAI_GIAY_TO_NHAN_SU,
  TINH_TRANG_HAN_OPTIONS,
  buildCanhBaoList,
  buildCoCauNhanSu,
  buildDashboardExcelFileName,
  buildDashboardExcelWorkbook,
  buildKpiNhanSu,
  countBy,
  filterNhanSuRows
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

const SCREEN = 'nhan-su';
const warningLabels = { do: 'Đỏ', vang: 'Vàng', xanh: 'Xanh', xam: 'Xám' };

function getOptions(data, key) {
  return Array.isArray(data?.filters?.[key]) ? data.filters[key].filter(Boolean) : [];
}
function buildDonutItems(rows, key) {
  const items = countBy(rows, key).sort((a, b) => Number(b.value || 0) - Number(a.value || 0)).slice(0, 6);
  return items.length ? items : [{ label: 'Chưa có dữ liệu', value: 0 }];
}

const NhanSuTab = () => {
  const { data, loading, filtersByScreen, setScreenFilters } = useDashboard();
  const filters = filtersByScreen[SCREEN];
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [exporting, setExporting] = useState(false);

  const nhanSu = useMemo(() => filterNhanSuRows(data?.reports?.nhanSu || [], filters), [data, filters]);
  const kpi = useMemo(() => buildKpiNhanSu(nhanSu), [nhanSu]);
  const laiXe = useMemo(() => nhanSu.filter((row) => String(row.chucDanh || '').toLowerCase().includes('lái xe')).length, [nhanSu]);
  const coCau = useMemo(() => buildCoCauNhanSu(nhanSu), [nhanSu]);
  const canhBao = useMemo(() => buildCanhBaoList(nhanSu, { hoTenKey: 'hoTen', phuKey: 'chucDanh', trangThaiKey: 'trangThaiLamViec' }), [nhanSu]);

  const totalPages = Math.max(1, Math.ceil(nhanSu.length / pageSize));
  useEffect(() => { setPage(1); }, [filters, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const setFilter = (key, value) => setScreenFilters(SCREEN, (current) => ({ ...current, [key]: value }));
  const setRange = (tuNgay, denNgay) => setScreenFilters(SCREEN, (current) => ({ ...current, tuNgay, denNgay }));
  const resetFilters = () => setScreenFilters(SCREEN, {
    ...filtersByScreen[SCREEN], donVi: '', doiXe: '', trangThaiNhanSu: '', gioiTinh: '', loaiHopDong: '', trangThaiHopDong: '', trangThaiBhxh: '', loaiGiayTo: '', tinhTrangHan: '', nhomCanhBao: '', chucDanh: '', nhomTrangThaiNhanSu: '', tuNgay: '', denNgay: ''
  });

  async function exportExcel() {
    if (nhanSu.length === 0) { toast.info('Không có dữ liệu để xuất Excel.'); return; }
    setExporting(true);
    try {
      const [ExcelJS, fileSaver] = await Promise.all([import('exceljs'), import('file-saver')]);
      const workbook = await buildDashboardExcelWorkbook(ExcelJS, 'nhan-su', nhanSu);
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      (fileSaver.saveAs || fileSaver.default)(blob, buildDashboardExcelFileName('nhan-su'));
    } catch (error) {
      toast.error(`Xuất Excel thất bại: ${error.message}`);
    } finally {
      setExporting(false);
    }
  }

  if (loading && !data) {
    return <div className="mt-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white py-16 text-sm font-semibold text-slate-500">Đang tải dữ liệu nhân sự…</div>;
  }

  return (
    <>
      <FilterBar>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
          <SelectFilter label="Đơn vị" value={filters.donVi} options={getOptions(data, 'donVi')} onChange={(v) => setFilter('donVi', v)} />
          <SelectFilter label="Đội xe" value={filters.doiXe} options={getOptions(data, 'doiXe')} onChange={(v) => setFilter('doiXe', v)} />
          <SelectFilter label="Trạng thái nhân sự" value={filters.trangThaiNhanSu} options={getOptions(data, 'trangThaiNhanSu')} onChange={(v) => setFilter('trangThaiNhanSu', v)} />
          <SelectFilter label="Loại hợp đồng" value={filters.loaiHopDong} options={getOptions(data, 'loaiHopDong')} onChange={(v) => setFilter('loaiHopDong', v)} />
          <SelectFilter label="Trạng thái hợp đồng" value={filters.trangThaiHopDong} options={getOptions(data, 'trangThaiHopDong')} onChange={(v) => setFilter('trangThaiHopDong', v)} />
          <SelectFilter label="Trạng thái BHXH" value={filters.trangThaiBhxh} options={getOptions(data, 'trangThaiBhxh')} onChange={(v) => setFilter('trangThaiBhxh', v)} />
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <SelectFilter label="Loại giấy tờ" value={filters.loaiGiayTo} options={LOAI_GIAY_TO_NHAN_SU} onChange={(v) => setFilter('loaiGiayTo', v)} allLabel="Tất cả giấy tờ" />
            <SelectFilter label="Tình trạng hạn" value={filters.tinhTrangHan} options={TINH_TRANG_HAN_OPTIONS} onChange={(v) => setFilter('tinhTrangHan', v)} allLabel="Tất cả tình trạng" />
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
        <MetricCard icon={Users} label="Tổng nhân sự" value={kpi.tong} percent="Theo bộ lọc" tone="bg-blue-50 text-blue-700" barColor="bg-blue-500" ratio={1} />
        <MetricCard icon={BriefcaseBusiness} label="Đang làm việc" value={kpi.dangLam} percent={`${kpi.tlDangLam}%`} tone="bg-emerald-50 text-emerald-700" barColor="bg-emerald-500" ratio={kpi.tong ? kpi.dangLam / kpi.tong : 0} onClick={() => setFilter('nhomTrangThaiNhanSu', filters.nhomTrangThaiNhanSu === 'dang-lam' ? '' : 'dang-lam')} active={filters.nhomTrangThaiNhanSu === 'dang-lam'} />
        <MetricCard icon={AlertTriangle} label="Nghỉ / tạm nghỉ" value={kpi.nghiViec + kpi.tamNghi} percent={`${kpi.tlNghiViec}%`} tone="bg-amber-50 text-amber-700" barColor="bg-amber-500" ratio={kpi.tong ? (kpi.nghiViec + kpi.tamNghi) / kpi.tong : 0} onClick={() => setFilter('nhomTrangThaiNhanSu', filters.nhomTrangThaiNhanSu === 'nghi' ? '' : 'nghi')} active={filters.nhomTrangThaiNhanSu === 'nghi'} />
        <MetricCard icon={Car} label="Lái xe" value={laiXe} percent={`${kpi.tong ? Math.round((laiXe / kpi.tong) * 100) : 0}%`} tone="bg-indigo-50 text-indigo-700" barColor="bg-indigo-500" ratio={kpi.tong ? laiXe / kpi.tong : 0} onClick={() => setFilter('chucDanh', filters.chucDanh === 'Lái xe' ? '' : 'Lái xe')} active={filters.chucDanh === 'Lái xe'} />
        <MetricCard icon={IdCard} label="Chưa có xe" value={kpi.chuaCoXe} percent={`${kpi.tlChuaCoXe}%`} tone="bg-rose-50 text-rose-700" barColor="bg-rose-500" ratio={kpi.tong ? kpi.chuaCoXe / kpi.tong : 0} />
        <MetricCard icon={HeartPulse} label="Chưa tham gia BHXH" value={kpi.chuaBHXH} percent={`${kpi.tlChuaBHXH}%`} tone="bg-orange-50 text-orange-700" barColor="bg-orange-500" ratio={kpi.tong ? kpi.chuaBHXH / kpi.tong : 0} />
      </section>

      <section className="mt-5">
        <ChartPanel title="Cơ cấu nhân sự" totalLabel={`${formatNumber(nhanSu.length)} nhân sự`}>
          <DonutJs title="Theo giới tính" items={coCau.gioiTinh} />
          <DonutJs title="Theo trạng thái" items={buildDonutItems(nhanSu, 'trangThaiLamViec')} />
          <DonutJs title="Theo chức danh" items={buildDonutItems(nhanSu, 'chucDanh')} />
          <DonutJs title="Theo loại nhân sự" items={coCau.loaiNhanSu.length ? coCau.loaiNhanSu : buildDonutItems(nhanSu, 'loaiHopDong')} />
        </ChartPanel>
      </section>

      {/* Độ tuổi + thâm niên (biểu đồ cột) */}
      <section className="mt-5 grid gap-4 xl:grid-cols-3">
        <SectionCard title="🎂 Cơ cấu theo độ tuổi">
          <BarJs items={coCau.doTuoi} color="#7c3aed" />
          <p className="mt-3 text-xs text-slate-500">Tuổi bình quân: <b className="text-slate-800">{coCau.tuoiBinhQuan || '—'}</b></p>
        </SectionCard>
        <SectionCard title="📈 Thâm niên làm việc">
          <BarJs items={coCau.thamNien} color="#0891b2" />
        </SectionCard>
        <SectionCard title="👥 Nhân sự theo đội xe">
          <DonutJs items={buildDonutItems(nhanSu, 'doiXe')} />
        </SectionCard>
      </section>

      {/* Danh sách nhân sự cảnh báo */}
      <SectionCard className="mt-5" title={<><AlertTriangle className="h-4 w-4 text-amber-500" /> Danh sách nhân sự cảnh báo</>} badge={formatNumber(canhBao.length)}>
        <AlertTable rows={canhBao} firstCol="Họ và tên" secondCol="Đội xe" />
      </SectionCard>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-950">Danh sách nhân sự</h2>
            <p className="mt-1 text-sm text-slate-500">Có {formatNumber(nhanSu.length)} dòng sau lọc. Excel xuất toàn bộ dữ liệu đang lọc.</p>
          </div>
          <Button type="button" className="h-9 bg-blue-500 hover:bg-blue-600" onClick={exportExcel} disabled={exporting}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
            Xuất nhân sự
          </Button>
        </div>
        <div className="p-4">
          <DataTable type="nhan-su" rows={nhanSu} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </div>
      </section>
    </>
  );
};

export default NhanSuTab;
