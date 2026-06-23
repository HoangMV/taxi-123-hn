import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BriefcaseBusiness,
  Car,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Gauge,
  Loader2,
  RefreshCw,
  UserCircle,
  Users
} from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  EMPTY_FILTERS,
  buildDashboardExcelFileName,
  buildDashboardExcelWorkbook,
  countBy,
  fetchDashboardQlvt,
  filterNhanSuRows,
  filterXeRows
} from '../features/dashboardQlvt';

const chartPalette = ['#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#ef4444', '#06b6d4'];
const PAGE_SIZE_OPTIONS = [25, 50, 100];
const warningLabels = { do: 'Đỏ', vang: 'Vàng', xanh: 'Xanh', xam: 'Xám' };
const warningClasses = {
  do: 'border-red-200 bg-red-50 text-red-700',
  vang: 'border-amber-200 bg-amber-50 text-amber-700',
  xanh: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  xam: 'border-slate-200 bg-slate-100 text-slate-600'
};

function formatNumber(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

function getPercent(value, total) {
  if (!total) return '0%';
  return `${Math.round((Number(value || 0) / total) * 100)}%`;
}

function getOptions(data, key) {
  return Array.isArray(data?.filters?.[key]) ? data.filters[key].filter(Boolean) : [];
}

function toNumber(value) {
  if (typeof value === 'number') return value;
  const clean = String(value || '').replace(/[^0-9.-]/g, '');
  return Number(clean || 0);
}

function buildTopRows(rows, key, labelKey) {
  return [...rows]
    .map((row) => ({ label: row[labelKey] || row.bienSo || row.idXe || 'Chưa có dữ liệu', value: toNumber(row[key]) }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 10);
}

function buildDonutItems(rows, key) {
  const items = countBy(rows, key)
    .sort((left, right) => Number(right.value || 0) - Number(left.value || 0))
    .slice(0, 6);
  return items.length ? items : [{ label: 'Chưa có dữ liệu', value: 0 }];
}

function donutBackground(items) {
  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
  if (!total) return '#e2e8f0';
  let current = 0;
  const stops = items.map((item, index) => {
    const start = current;
    current += (Number(item.value || 0) / total) * 360;
    return `${chartPalette[index % chartPalette.length]} ${start}deg ${current}deg`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

function SelectFilter({ label, value, options, onChange, getOptionLabel = (option) => option }) {
  return (
    <label className="min-w-0 space-y-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-medium normal-case tracking-normal text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        <option value="">Tất cả</option>
        {options.map((option) => (
          <option key={option} value={option}>{getOptionLabel(option)}</option>
        ))}
      </select>
    </label>
  );
}

function MetricCard({ icon: Icon, label, value, percent, tone, bars }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold leading-none text-slate-950">{formatNumber(value)}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">{percent}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 flex h-9 items-end gap-1.5 overflow-hidden">
        {bars.map((height, index) => (
          <span key={`${label}-${index}`} className="flex-1 rounded-t bg-slate-200" style={{ height: `${height}%` }} />
        ))}
      </div>
    </div>
  );
}

function DonutChart({ title, rows, keyName, icon: Icon }) {
  const items = buildDonutItems(rows, keyName);
  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);

  return (
    <div className="min-w-0 rounded-md border border-slate-100 bg-slate-50/80 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="truncate text-sm font-bold text-slate-800">{title}</h3>
        <span className="text-xs font-semibold text-slate-500">{formatNumber(total)}</span>
      </div>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <div className="relative h-36 w-36 shrink-0 rounded-full" style={{ background: donutBackground(items) }}>
          <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
            <Icon className="h-5 w-5 text-blue-700" />
            <span className="mt-1 text-xl font-bold text-slate-950">{formatNumber(total)}</span>
          </div>
        </div>
        <div className="w-full min-w-0 space-y-2">
          {items.map((item, index) => (
            <div key={`${title}-${item.label}`} className="flex items-center gap-2 text-xs text-slate-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: chartPalette[index % chartPalette.length] }} />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span className="shrink-0 font-bold text-slate-900">{formatNumber(item.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChartPanel({ title, totalLabel, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-bold text-slate-950">{title}</h2>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{totalLabel}</span>
      </div>
      <div className="grid gap-4 p-4 xl:grid-cols-2">{children}</div>
    </section>
  );
}

function TopBarChart({ title, rows, unit }) {
  const max = rows.reduce((value, item) => Math.max(value, Number(item.value || 0)), 0);
  const data = rows.length ? rows : [{ label: 'Chưa có dữ liệu', value: 0 }];

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-bold text-slate-950">{title}</h2>
      </div>
      <div className="space-y-3 p-5">
        {data.map((item, index) => (
          <div key={`${title}-${item.label}-${index}`} className="grid grid-cols-[minmax(90px,160px)_1fr_auto] items-center gap-3 text-sm">
            <span className="truncate font-semibold text-slate-600">{item.label}</span>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${max ? Math.max(5, Math.round((item.value / max) * 100)) : 0}%`, backgroundColor: chartPalette[index % chartPalette.length] }}
              />
            </div>
            <span className="w-20 text-right text-xs font-bold text-slate-900">{formatNumber(item.value)} {unit}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function WarningBadge({ level }) {
  const cleanLevel = level || 'xam';
  return (
    <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-xs font-bold ${warningClasses[cleanLevel] || warningClasses.xam}`}>
      {warningLabels[cleanLevel] || 'Xám'}
    </span>
  );
}

function LoadingLine({ className = '', style }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} style={style} />;
}

function LoadingDashboard() {
  return (
    <div className="-mx-4 -my-6 min-h-full bg-slate-100 lg:-mx-8">
      <div className="bg-[#0b2d5c] px-4 py-4 text-white shadow-sm lg:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <img className="h-[52px] w-[52px] shrink-0 rounded-full object-cover" src="/logo-taxi-123.png" alt="TAXI123" />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-normal text-white">Trung tâm điều hành QLVT TAXI123</h1>
              <div className="mt-1 flex items-center gap-2 text-sm font-medium text-blue-100">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tải dữ liệu dashboard...
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LoadingLine className="h-9 w-24 bg-white/20" />
            <LoadingLine className="h-9 w-32 bg-white/20" />
            <LoadingLine className="h-9 w-36 bg-white/20" />
            <LoadingLine className="hidden h-9 w-9 rounded-full bg-white/20 sm:block" />
          </div>
        </div>
      </div>

      <div className="px-4 pb-8 lg:px-8">
        <section className="-mt-1 rounded-b-lg border border-t-0 border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={`filter-${index}`} className="space-y-2">
                <LoadingLine className="h-3 w-20" />
                <LoadingLine className="h-9 w-full rounded-md" />
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-3">
            <div className="grid flex-1 gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`extra-filter-${index}`} className="space-y-2">
                  <LoadingLine className="h-3 w-28" />
                  <LoadingLine className="h-9 w-full rounded-md" />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <LoadingLine className="h-10 w-20 rounded-md" />
              <LoadingLine className="h-10 w-20 rounded-md" />
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`metric-${index}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="w-full space-y-3">
                  <LoadingLine className="h-4 w-28" />
                  <LoadingLine className="h-8 w-20" />
                  <LoadingLine className="h-3 w-16" />
                </div>
                <LoadingLine className="h-11 w-11 rounded-full" />
              </div>
              <div className="mt-4 flex h-9 items-end gap-2">
                {[36, 58, 44, 76, 62, 82].map((height, barIndex) => (
                  <LoadingLine key={`metric-${index}-bar-${barIndex}`} className="flex-1 rounded-t" style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={`chart-${index}`} className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <LoadingLine className="h-5 w-36" />
                <LoadingLine className="h-7 w-24 rounded-full" />
              </div>
              <div className="grid gap-4 p-4 md:grid-cols-2">
                {Array.from({ length: 2 }).map((__, cardIndex) => (
                  <div key={`chart-${index}-${cardIndex}`} className="rounded-md border border-slate-100 bg-slate-50 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <LoadingLine className="h-4 w-32" />
                      <LoadingLine className="h-5 w-5 rounded-full" />
                    </div>
                    <div className="flex items-center gap-4">
                      <LoadingLine className="h-28 w-28 rounded-full" />
                      <div className="grid flex-1 gap-3">
                        {Array.from({ length: 4 }).map((___, rowIndex) => <LoadingLine key={`legend-${rowIndex}`} className="h-3 w-full" />)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="mt-5 rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <LoadingLine className="h-5 w-52" />
              <LoadingLine className="h-4 w-72 max-w-full" />
            </div>
            <LoadingLine className="h-12 w-56 rounded-md" />
          </div>
          <div className="p-4">
            <div className="overflow-hidden rounded-md border border-slate-200">
              <div className="grid grid-cols-10 gap-3 bg-slate-50 px-3 py-3">
                {Array.from({ length: 10 }).map((_, index) => <LoadingLine key={`head-${index}`} className="h-4" />)}
              </div>
              {Array.from({ length: 8 }).map((_, rowIndex) => (
                <div key={`row-${rowIndex}`} className="grid grid-cols-10 gap-3 border-t border-slate-100 px-3 py-4">
                  {Array.from({ length: 10 }).map((__, cellIndex) => <LoadingLine key={`row-${rowIndex}-${cellIndex}`} className="h-4" />)}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function DataTable({ type, rows, page, pageSize, onPageChange, onPageSizeChange }) {
  const columns = type === 'nhan-su'
    ? [
      ['stt', 'STT'], ['hoTen', 'Họ tên'], ['cccd', 'CCCD'], ['doiXe', 'Đội xe'],
      ['chucDanh', 'Chức danh'], ['trangThaiLamViec', 'Trạng thái'], ['bienSoXe', 'Biển số'],
      ['hanGplx', 'Hạn GPLX'], ['hanSucKhoe', 'Hạn sức khỏe'], ['canhBao', 'Cảnh báo']
    ]
    : [
      ['stt', 'STT'], ['bienSo', 'Biển số'], ['maDam', 'Mã đàm'], ['loaiXe', 'Loại xe'],
      ['doiXe', 'Đội xe'], ['trangThaiXe', 'Trạng thái'], ['laiXeDangLai', 'Lái xe'],
      ['hanPhuHieu', 'Hạn phù hiệu'], ['hanDangKiem', 'Hạn đăng kiểm'], ['canhBao', 'Cảnh báo']
    ];

  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = totalRows ? (safePage - 1) * pageSize : 0;
  const endIndex = Math.min(startIndex + pageSize, totalRows);
  const pageRows = rows.slice(startIndex, endIndex);

  return (
    <div className="rounded-md border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {columns.map(([, label]) => <th key={label} className="whitespace-nowrap px-3 py-3 font-bold">{label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.map((row) => (
              <tr key={`${type}-${row.stt}-${row.idNhanSu || row.idXe}`} className="align-top hover:bg-slate-50">
                {columns.map(([key]) => (
                  <td key={key} className="max-w-[240px] px-3 py-3 text-slate-700">
                    {key === 'canhBao' ? (
                      <div className="flex min-w-40 flex-col items-start gap-1">
                        <WarningBadge level={row.warningLevel} />
                        <span className="line-clamp-2">{row[key] || ''}</span>
                      </div>
                    ) : type === 'xe' && key === 'bienSo' && row.idXe ? (
                      <a
                        className="inline-flex max-w-full items-center gap-1 font-black text-blue-700 underline-offset-2 hover:underline"
                        href={`/vehicle_profile_standalone.html?ID_Xe=${encodeURIComponent(row.idXe)}`}
                        target="_blank"
                        rel="noreferrer"
                        title={`Mở hồ sơ xe ${row.bienSo || row.idXe}`}
                      >
                        <span className="truncate">{row[key] || row.idXe}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      </a>
                    ) : (
                      <span className="line-clamp-2">{row[key] || ''}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-sm text-slate-500">Không có dữ liệu phù hợp bộ lọc.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-100 px-3 py-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
        <div className="font-semibold">
          {totalRows > 0
            ? `Hiển thị ${formatNumber(startIndex + 1)}-${formatNumber(endIndex)} / ${formatNumber(totalRows)} dòng`
            : 'Không có dòng để hiển thị'}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Dòng/trang
            <select
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold normal-case tracking-normal text-slate-700"
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <Button type="button" variant="secondary" className="h-9 px-2" onClick={() => onPageChange(safePage - 1)} disabled={safePage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-24 text-center font-bold text-slate-700">Trang {formatNumber(safePage)} / {formatNumber(totalPages)}</span>
          <Button type="button" variant="secondary" className="h-9 px-2" onClick={() => onPageChange(safePage + 1)} disabled={safePage >= totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

const DashboardPage = () => {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [activeTab, setActiveTab] = useState('nhan-su');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(25);

  async function loadDashboard(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      setData(await fetchDashboardQlvt());
    } catch (requestError) {
      setError(requestError.message || 'Không tải được dashboard QLVT.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadDashboard(false); }, []);

  const filteredNhanSu = useMemo(() => filterNhanSuRows(data?.reports?.nhanSu || [], filters), [data, filters]);
  const filteredXe = useMemo(() => filterXeRows(data?.reports?.xe || [], filters), [data, filters]);
  const activeRows = activeTab === 'nhan-su' ? filteredNhanSu : filteredXe;
  const totalTablePages = Math.max(1, Math.ceil(activeRows.length / tablePageSize));

  useEffect(() => { setTablePage(1); }, [activeTab, filters, tablePageSize]);
  useEffect(() => {
    if (tablePage > totalTablePages) setTablePage(totalTablePages);
  }, [tablePage, totalTablePages]);

  const summary = useMemo(() => {
    const nhanSuDangLamViec = filteredNhanSu.filter((item) => item.trangThaiLamViec && !item.trangThaiLamViec.toLowerCase().includes('nghỉ')).length;
    const xeHoatDong = filteredXe.filter((item) => item.trangThaiXe && !item.trangThaiXe.toLowerCase().includes('ngừng')).length;
    return {
      tongNhanSu: filteredNhanSu.length,
      nhanSuDangLamViec,
      nhanSuNghiViec: filteredNhanSu.length - nhanSuDangLamViec,
      tongXe: filteredXe.length,
      xeHoatDong,
      xeNgung: filteredXe.length - xeHoatDong
    };
  }, [filteredNhanSu, filteredXe]);
  const topKmRows = useMemo(() => buildTopRows(filteredXe, 'kmLuyKe', 'bienSo'), [filteredXe]);
  const topTripRows = useMemo(() => buildTopRows(filteredXe, 'soChuyenThang', 'bienSo'), [filteredXe]);
  const updatedAt = data?.generatedAt ? new Date(data.generatedAt).toLocaleString('vi-VN') : 'Chưa cập nhật';

  function setFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function setActiveReportTab(tab) {
    setActiveTab(tab);
  }

  async function exportExcel(type) {
    const rows = type === 'xe' ? filteredXe : filteredNhanSu;
    if (rows.length === 0) {
      toast.info('Không có dữ liệu để xuất Excel.');
      return;
    }
    setExporting(type);
    try {
      const [ExcelJS, fileSaver] = await Promise.all([import('exceljs'), import('file-saver')]);
      const workbook = await buildDashboardExcelWorkbook(ExcelJS, type, rows);
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const saveAs = fileSaver.saveAs || fileSaver.default;
      saveAs(blob, buildDashboardExcelFileName(type));
    } catch (exportError) {
      toast.error(`Xuất Excel thất bại: ${exportError.message}`);
    } finally {
      setExporting('');
    }
  }

  if (loading) {
    return <LoadingDashboard />;
  }

  return (
    <div className="-mx-4 -my-6 min-h-full bg-slate-100 lg:-mx-8">
      <div className="bg-[#0b2d5c] px-4 py-4 text-white shadow-sm lg:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <img className="h-[52px] w-[52px] shrink-0 rounded-full object-cover" src="/logo-taxi-123.png" alt="TAXI123" />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-normal text-white">Trung tâm điều hành QLVT TAXI123</h1>
              <p className="mt-0.5 text-sm font-medium text-blue-100">Cập nhật: {updatedAt}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" className="h-9 bg-white/10 text-white hover:bg-white/20" onClick={() => loadDashboard(true)} disabled={refreshing}>
              {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Cập nhật
            </Button>
            <Button type="button" className="h-9 bg-blue-500 hover:bg-blue-600" onClick={() => exportExcel('nhan-su')} disabled={Boolean(exporting)}>
              {exporting === 'nhan-su' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              Xuất nhân sự
            </Button>
            <Button type="button" className="h-9 bg-emerald-500 hover:bg-emerald-600" onClick={() => exportExcel('xe')} disabled={Boolean(exporting)}>
              {exporting === 'xe' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Xuất phương tiện
            </Button>
            <UserCircle className="hidden h-9 w-9 text-blue-100 sm:block" />
          </div>
        </div>
      </div>

      <div className="px-4 pb-8 lg:px-8">
        <section className="-mt-1 rounded-b-lg border border-t-0 border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
            <SelectFilter label="Đơn vị" value={filters.donVi} options={getOptions(data, 'donVi')} onChange={(value) => setFilter('donVi', value)} />
            <SelectFilter label="Đội xe" value={filters.doiXe} options={getOptions(data, 'doiXe')} onChange={(value) => setFilter('doiXe', value)} />
            <SelectFilter label="Loại xe" value={filters.loaiXe} options={getOptions(data, 'loaiXe')} onChange={(value) => setFilter('loaiXe', value)} />
            <SelectFilter label="Trạng thái xe" value={filters.trangThaiXe} options={getOptions(data, 'trangThaiXe')} onChange={(value) => setFilter('trangThaiXe', value)} />
            <SelectFilter label="Trạng thái nhân sự" value={filters.trangThaiNhanSu} options={getOptions(data, 'trangThaiNhanSu')} onChange={(value) => setFilter('trangThaiNhanSu', value)} />
            <SelectFilter label="Cảnh báo" value={filters.nhomCanhBao} options={getOptions(data, 'nhomCanhBao')} getOptionLabel={(option) => warningLabels[option] || option} onChange={(value) => setFilter('nhomCanhBao', value)} />
            <label className="min-w-0 space-y-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <span>Từ tháng</span>
              <Input className="h-9" type="month" value={filters.tuThang} onChange={(event) => setFilter('tuThang', event.target.value)} />
            </label>
            <label className="min-w-0 space-y-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <span>Đến tháng</span>
              <Input className="h-9" type="month" value={filters.denThang} onChange={(event) => setFilter('denThang', event.target.value)} />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-3">
            <div className="grid flex-1 gap-3 md:grid-cols-3">
              <SelectFilter label="Loại hợp đồng" value={filters.loaiHopDong} options={getOptions(data, 'loaiHopDong')} onChange={(value) => setFilter('loaiHopDong', value)} />
              <SelectFilter label="Trạng thái hợp đồng" value={filters.trangThaiHopDong} options={getOptions(data, 'trangThaiHopDong')} onChange={(value) => setFilter('trangThaiHopDong', value)} />
              <SelectFilter label="Trạng thái BHXH" value={filters.trangThaiBhxh} options={getOptions(data, 'trangThaiBhxh')} onChange={(value) => setFilter('trangThaiBhxh', value)} />
            </div>
            <div className="flex gap-2">
              <Button type="button" className="bg-blue-600 hover:bg-blue-700" onClick={() => toast.success('Đã áp dụng bộ lọc dashboard.')}>Áp dụng</Button>
              <Button type="button" variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>Xóa lọc</Button>
            </div>
          </div>
        </section>

        {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {data?.missingSources?.length > 0 && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Một số bảng chưa đọc được: {data.missingSources.map((item) => item.table).join(', ')}. Các cột liên quan sẽ để trống và có cảnh báo.
          </div>
        )}

        <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard icon={Users} label="Tổng nhân sự" value={summary.tongNhanSu} percent="Theo bộ lọc" tone="bg-blue-50 text-blue-700" bars={[45, 70, 50, 82, 62, 78]} />
          <MetricCard icon={BriefcaseBusiness} label="Đang làm việc" value={summary.nhanSuDangLamViec} percent={getPercent(summary.nhanSuDangLamViec, summary.tongNhanSu)} tone="bg-emerald-50 text-emerald-700" bars={[35, 52, 68, 58, 76, 84]} />
          <MetricCard icon={AlertTriangle} label="Nghỉ việc" value={summary.nhanSuNghiViec} percent={getPercent(summary.nhanSuNghiViec, summary.tongNhanSu)} tone="bg-amber-50 text-amber-700" bars={[25, 42, 36, 55, 32, 44]} />
          <MetricCard icon={Car} label="Tổng số xe" value={summary.tongXe} percent="Theo bộ lọc" tone="bg-indigo-50 text-indigo-700" bars={[52, 48, 63, 72, 66, 80]} />
          <MetricCard icon={Gauge} label="Xe hoạt động" value={summary.xeHoatDong} percent={getPercent(summary.xeHoatDong, summary.tongXe)} tone="bg-cyan-50 text-cyan-700" bars={[38, 58, 74, 61, 83, 90]} />
          <MetricCard icon={AlertTriangle} label="Xe ngừng" value={summary.xeNgung} percent={getPercent(summary.xeNgung, summary.tongXe)} tone="bg-red-50 text-red-700" bars={[18, 30, 24, 36, 28, 42]} />
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-2">
          <ChartPanel title="Cơ cấu nhân sự" totalLabel={`${formatNumber(filteredNhanSu.length)} nhân sự`}>
            <DonutChart title="Nhân sự theo trạng thái" rows={filteredNhanSu} keyName="trangThaiLamViec" icon={Users} />
            <DonutChart title="Nhân sự theo chức danh" rows={filteredNhanSu} keyName="chucDanh" icon={BriefcaseBusiness} />
          </ChartPanel>
          <ChartPanel title="Cơ cấu đội xe" totalLabel={`${formatNumber(filteredXe.length)} xe`}>
            <DonutChart title="Xe theo trạng thái" rows={filteredXe} keyName="trangThaiXe" icon={Car} />
            <DonutChart title="Xe theo loại" rows={filteredXe} keyName="loaiXe" icon={Gauge} />
          </ChartPanel>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-2">
          <TopBarChart title="Top 10 xe chạy nhiều km nhất" rows={topKmRows} unit="km" />
          <TopBarChart title="Top 10 xe có nhiều chuyến nhất" rows={topTripRows} unit="chuyến" />
        </section>

        <section className="mt-5 rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-950">Tra cứu và báo cáo tổng hợp</h2>
              <p className="mt-1 text-sm text-slate-500">
                Có {formatNumber(activeRows.length)} dòng sau lọc. Excel xuất toàn bộ dữ liệu đang lọc.
              </p>
            </div>
            <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-1">
              <button type="button" onClick={() => setActiveReportTab('nhan-su')} className={`rounded px-3 py-1.5 text-sm font-bold ${activeTab === 'nhan-su' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>Nhân sự</button>
              <button type="button" onClick={() => setActiveReportTab('xe')} className={`rounded px-3 py-1.5 text-sm font-bold ${activeTab === 'xe' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>Phương tiện</button>
            </div>
          </div>
          <div className="p-4">
            <DataTable
              type={activeTab}
              rows={activeRows}
              page={tablePage}
              pageSize={tablePageSize}
              onPageChange={setTablePage}
              onPageSizeChange={setTablePageSize}
            />
          </div>
        </section>
      </div>
    </div>
  );
};

export default DashboardPage;
