import React, { useMemo } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Car, FileWarning, FolderCheck, Gauge, ShieldCheck, UserCheck, Users } from 'lucide-react';
import {
  buildBienDong,
  buildCanhBaoList,
  buildKpiHoSo,
  buildKpiNhanSu,
  buildKpiPhuongTien,
  countBy,
  filterNhanSuRows,
  filterXeRows
} from '../../features/dashboardQlvt';
import { useDashboard } from './DashboardContext';
import {
  AlertBox,
  ChartPanel,
  FilterBar,
  GaugeRing,
  MetricCard,
  SectionCard,
  SelectFilter,
  formatNumber
} from './components';
import { DonutJs } from './Charts';

const SCREEN = 'tong-quan';

function getOptions(data, key) {
  return Array.isArray(data?.filters?.[key]) ? data.filters[key].filter(Boolean) : [];
}

function buildDonutItems(rows, key) {
  const items = countBy(rows, key).sort((a, b) => Number(b.value || 0) - Number(a.value || 0)).slice(0, 6);
  return items.length ? items : [{ label: 'Chưa có dữ liệu', value: 0 }];
}

const TongQuanTab = () => {
  const { data, loading, filtersByScreen, setScreenFilters } = useDashboard();
  const filters = filtersByScreen[SCREEN];

  const nhanSu = useMemo(() => filterNhanSuRows(data?.reports?.nhanSu || [], filters), [data, filters]);
  const xe = useMemo(() => filterXeRows(data?.reports?.xe || [], filters), [data, filters]);

  const kpiXe = useMemo(() => buildKpiPhuongTien(xe), [xe]);
  const kpiNs = useMemo(() => buildKpiNhanSu(nhanSu), [nhanSu]);
  const hoSo = useMemo(() => buildKpiHoSo(nhanSu, xe, data?.hoSoSummary), [nhanSu, xe, data]);
  const bienDong = useMemo(() => buildBienDong(nhanSu, xe), [nhanSu, xe]);
  const canhBao = useMemo(() => [
    ...buildCanhBaoList(xe, { hoTenKey: 'bienSo', phuKey: 'nhanHieu', trangThaiKey: 'trangThaiXe' }),
    ...buildCanhBaoList(nhanSu, { hoTenKey: 'hoTen', phuKey: 'chucDanh', trangThaiKey: 'trangThaiLamViec' })
  ].sort((a, b) => (a.soNgayConLai ?? 9999) - (b.soNgayConLai ?? 9999)), [xe, nhanSu]);

  const setFilter = (key, value) => setScreenFilters(SCREEN, (current) => ({ ...current, [key]: value }));
  const resetFilters = () => setScreenFilters(SCREEN, (current) => ({ ...current, donVi: '', doiXe: '' }));

  if (loading && !data) {
    return <div className="mt-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white py-16 text-sm font-semibold text-slate-500">Đang tải số liệu tổng quan…</div>;
  }

  return (
    <>
      <FilterBar>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SelectFilter label="Đơn vị" value={filters.donVi} options={getOptions(data, 'donVi')} onChange={(v) => setFilter('donVi', v)} />
            <SelectFilter label="Đội xe" value={filters.doiXe} options={getOptions(data, 'doiXe')} onChange={(v) => setFilter('doiXe', v)} />
          </div>
          <button type="button" onClick={resetFilters} className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-300">Xóa lọc</button>
        </div>
      </FilterBar>

      {/* KPI-strip 6 card — đồng bộ với màn Phương tiện / Nhân sự */}
      <section className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <MetricCard icon={Car} label="Tổng số xe" value={kpiXe.tong} percent={`${kpiXe.dangHoatDong} đang hoạt động`} tone="bg-indigo-50 text-indigo-700" barColor="bg-indigo-500" ratio={1} />
        <MetricCard icon={Gauge} label="Xe đang hoạt động" value={kpiXe.dangHoatDong} percent={`${kpiXe.tlDangHoatDong}% trên tổng`} tone="bg-cyan-50 text-cyan-700" barColor="bg-cyan-500" ratio={kpiXe.tong ? kpiXe.dangHoatDong / kpiXe.tong : 0} />
        <MetricCard icon={Users} label="Tổng nhân sự" value={kpiNs.tong} percent={`${kpiNs.dangLam} đang làm việc`} tone="bg-blue-50 text-blue-700" barColor="bg-blue-500" ratio={1} />
        <MetricCard icon={UserCheck} label="Nhân sự đang làm" value={kpiNs.dangLam} percent={`${kpiNs.tlDangLam}% trên tổng`} tone="bg-emerald-50 text-emerald-700" barColor="bg-emerald-500" ratio={kpiNs.tong ? kpiNs.dangLam / kpiNs.tong : 0} />
        <MetricCard icon={FolderCheck} label="Hồ sơ còn hiệu lực" value={hoSo.kpi.conHieuLuc} percent={`${hoSo.kpi.tlConHieuLuc}% / ${formatNumber(hoSo.kpi.tong)} hồ sơ`} tone="bg-teal-50 text-teal-700" barColor="bg-teal-500" ratio={hoSo.kpi.tong ? hoSo.kpi.conHieuLuc / hoSo.kpi.tong : 0} />
        <MetricCard icon={FileWarning} label="Hồ sơ quá hạn" value={hoSo.kpi.quaHan} percent={`${hoSo.kpi.tlQuaHan}% · ${hoSo.kpi.sapHetHan} sắp hết`} tone="bg-red-50 text-red-700" barColor="bg-red-500" ratio={hoSo.kpi.tong ? hoSo.kpi.quaHan / hoSo.kpi.tong : 0} />
      </section>

      {/* Cơ cấu nhanh */}
      <section className="mt-5">
        <ChartPanel title="Cơ cấu tổng quan" totalLabel={`${formatNumber(kpiXe.tong + kpiNs.tong)} đối tượng`}>
          <DonutJs title="Xe theo trạng thái" items={buildDonutItems(xe, 'trangThaiXe')} />
          <DonutJs title="Xe theo đội" items={buildDonutItems(xe, 'doiXe')} />
          <DonutJs title="Nhân sự theo trạng thái" items={buildDonutItems(nhanSu, 'trangThaiLamViec')} />
          <DonutJs title="Nhân sự theo chức danh" items={buildDonutItems(nhanSu, 'chucDanh')} />
        </ChartPanel>
      </section>

      {/* Cảnh báo + Tỷ lệ tuân thủ */}
      <section className="mt-5 grid gap-4 xl:grid-cols-2">
        <SectionCard title={<><AlertTriangle className="h-4 w-4 text-red-500" /> Cảnh báo hết hạn</>}>
          <div className="grid grid-cols-2 gap-3">
            <AlertBox tone="red" value={hoSo.tongQuaHan} label="Quá hạn" />
            <AlertBox tone="amber" value={hoSo.tongSapHet} label="Sắp hết hạn (≤30 ngày)" />
          </div>
          <div className="mt-4 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {hoSo.canhBaoNhom.length === 0 && <p className="text-sm text-slate-500">Không có hồ sơ quá hạn hay sắp hết hạn.</p>}
            {hoSo.canhBaoNhom.map((row) => (
              <div key={row.nhom} className="flex items-center justify-between gap-3 border-b border-dashed border-slate-200 py-2 text-sm">
                <span className="font-semibold text-slate-700">{row.nhom}</span>
                <span className="whitespace-nowrap text-slate-500">
                  <b className="text-red-600">{row.quaHan}</b> quá hạn · <b className="text-amber-600">{row.sapHet}</b> sắp hết
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title={<><ShieldCheck className="h-4 w-4 text-emerald-600" /> Tỷ lệ tuân thủ theo hạng mục</>}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {hoSo.tyLeTuanThu.map((row) => <GaugeRing key={row.nhom} value={row.tyLe} label={row.nhom} />)}
          </div>
          <p className="mt-3 text-xs text-slate-500">Tỷ lệ = số đối tượng đang hoạt động có hồ sơ còn hiệu lực / số cần có.</p>
        </SectionCard>
      </section>

      {/* Biến động tháng này */}
      <SectionCard className="mt-5" title={<><ArrowUpRight className="h-4 w-4 text-blue-600" /> Biến động tháng này</>} badge={bienDong.kyLabel}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Xe vào mới', value: bienDong.thangNay.xeNhap, icon: ArrowUpRight, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Xe xuất hãng', value: bienDong.thangNay.xeXuat, icon: ArrowDownRight, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Nhân sự tuyển mới', value: bienDong.thangNay.nsTuyen, icon: ArrowUpRight, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Nhân sự nghỉ việc', value: bienDong.thangNay.nsNghi, icon: ArrowDownRight, color: 'text-red-600', bg: 'bg-red-50' }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                <span className={`grid h-11 w-11 place-items-center rounded-full ${item.bg} ${item.color}`}><Icon className="h-5 w-5" /></span>
                <div>
                  <div className={`text-3xl font-black leading-none ${item.color}`}>{formatNumber(item.value)}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">{item.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Danh sách cảnh báo gần hết hạn nhất */}
      <SectionCard className="mt-5" title={<><AlertTriangle className="h-4 w-4 text-amber-500" /> Hồ sơ cần xử lý sớm nhất</>} badge={formatNumber(canhBao.length)}>
        <div className="max-h-96 overflow-auto rounded-md border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2.5 font-bold">Đối tượng</th>
                <th className="px-3 py-2.5 font-bold">Đội / Chức danh</th>
                <th className="px-3 py-2.5 font-bold">Hạng mục</th>
                <th className="px-3 py-2.5 font-bold">Ngày hết hạn</th>
                <th className="px-3 py-2.5 font-bold">Còn lại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {canhBao.slice(0, 200).map((row, index) => (
                <tr key={`${row.ten}-${row.hangMuc}-${index}`} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-semibold text-slate-800">{row.ten || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{row.doiXe || row.phu || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{row.hangMuc}</td>
                  <td className="px-3 py-2.5 text-slate-600">{row.ngayHetHan || '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex min-w-14 justify-center rounded-full px-2 py-1 text-xs font-black ${row.soNgayConLai < 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {row.soNgayConLai == null ? '—' : row.soNgayConLai < 0 ? `${Math.abs(row.soNgayConLai)} ngày trước` : `${row.soNgayConLai} ngày`}
                    </span>
                  </td>
                </tr>
              ))}
              {canhBao.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">Không có hồ sơ cần cảnh báo.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
};

export default TongQuanTab;
