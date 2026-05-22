import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Building2,
  FileSpreadsheet,
  Filter,
  IdCard,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Truck
} from 'lucide-react';
import { toast } from 'react-toastify';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import appSheetService from '../services/appSheetService';
import {
  buildPhuHieuStats,
  CACHE_KEY,
  CACHE_TTL_MS,
  calculateSummary,
  buildStatsExcelWorkbook,
  filterStats,
  sortStats
} from '../features/phuHieuDonVi';

const PAGE_SIZE = 100;

const defaultFilters = {
  search: '',
  loaihinh: '',
  loaiph: '',
  quanhuyen: '',
  totalOp: '',
  totalMin: '',
  totalMax: ''
};

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !Array.isArray(parsed?.statsData) || !Array.isArray(parsed?.phLoaiTypes)) {
      return null;
    }

    if (Date.now() - parsed.ts > CACHE_TTL_MS) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function saveCache(payload) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
}

function useDebouncedValue(value, delayMs) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [value, delayMs]);

  return debouncedValue;
}

function getFriendlyErrorMessage(error) {
  const rawMessage = error?.message || '';
  if (!rawMessage) {
    return 'Không thể tải dữ liệu. Vui lòng thử lại.';
  }

  if (rawMessage.includes('Thiếu cấu hình')) {
    return rawMessage;
  }

  if (rawMessage.includes('Failed to fetch') || rawMessage.includes('NetworkError')) {
    return 'Không kết nối được AppSheet. Vui lòng kiểm tra mạng hoặc cấu hình API.';
  }

  if (rawMessage.length > 160) {
    return 'AppSheet trả về lỗi khi tải dữ liệu. Vui lòng kiểm tra lại cấu hình và quyền truy cập.';
  }

  return rawMessage;
}

const numberCompareOptions = [
  { value: '', label: 'Tất cả' },
  { value: 'gte', label: 'Lớn hơn hoặc bằng' },
  { value: 'lte', label: 'Nhỏ hơn hoặc bằng' },
  { value: 'between', label: 'Trong khoảng' }
];

const summaryMeta = [
  { key: 'totalDV', label: 'Đơn vị', icon: Building2, tone: 'bg-red-100 text-red-700' },
  { key: 'totalPH', label: 'Phù hiệu còn hiệu lực', icon: IdCard, tone: 'bg-emerald-100 text-emerald-700' },
  { key: 'totalDKT', label: 'Đang khai thác', icon: Truck, tone: 'bg-amber-100 text-amber-700' }
];

const ThongKePhuHieuDonViPage = () => {
  const [statsData, setStatsData] = useState([]);
  const [phLoaiTypes, setPhLoaiTypes] = useState([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [sortCol, setSortCol] = useState('total');
  const [sortDir, setSortDir] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const debouncedSearch = useDebouncedValue(filters.search, 250);

  const effectiveFilters = useMemo(
    () => ({
      search: debouncedSearch,
      loaihinh: filters.loaihinh,
      loaiph: filters.loaiph,
      quanhuyen: filters.quanhuyen,
      totalOp: filters.totalOp,
      totalMin: filters.totalMin,
      totalMax: filters.totalMax
    }),
    [
      debouncedSearch,
      filters.loaihinh,
      filters.loaiph,
      filters.quanhuyen,
      filters.totalOp,
      filters.totalMin,
      filters.totalMax
    ]
  );

  const filteredStats = useMemo(() => {
    const filtered = filterStats(statsData, effectiveFilters);
    return sortStats(filtered, sortCol, sortDir, phLoaiTypes);
  }, [statsData, effectiveFilters, sortCol, sortDir, phLoaiTypes]);

  const summary = useMemo(() => calculateSummary(filteredStats, phLoaiTypes), [filteredStats, phLoaiTypes]);
  const totalPages = Math.max(1, Math.ceil(filteredStats.length / PAGE_SIZE));

  const currentPageItems = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredStats.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, filteredStats]);

  const loaihinhOptions = useMemo(
    () => [...new Set(statsData.map((item) => item.loaihinh).filter(Boolean))].sort(),
    [statsData]
  );

  const quanhuyenOptions = useMemo(
    () => [...new Set(statsData.map((item) => item.quanHuyen).filter(Boolean))].sort(),
    [statsData]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [effectiveFilters, sortCol, sortDir]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    const cached = loadCache();
    if (cached) {
      setStatsData(cached.statsData);
      setPhLoaiTypes(cached.phLoaiTypes);
      setLastUpdated(new Date(cached.ts).toLocaleString('vi-VN'));
      setLoading(false);
      refreshData(true);
      return;
    }

    refreshData(false);
  }, []);

  async function refreshData(isBackground) {
    if (isBackground) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      setErrorMessage('');
      const [emblemsRaw, companyRaw] = await Promise.all([
        appSheetService.find('PHUHIEUXE', 'Filter(PHUHIEUXE, [TrangThai] = "Hiệu lực")'),
        appSheetService.find('THONGTINDONVIVANTAI', 'Filter(THONGTINDONVIVANTAI, true)')
      ]);

      const nextData = buildPhuHieuStats(emblemsRaw, companyRaw);
      const payload = {
        ts: Date.now(),
        statsData: nextData.statsData,
        phLoaiTypes: nextData.phLoaiTypes
      };

      saveCache(payload);
      setStatsData(payload.statsData);
      setPhLoaiTypes(payload.phLoaiTypes);
      setLastUpdated(new Date(payload.ts).toLocaleString('vi-VN'));
    } catch (error) {
      const message = getFriendlyErrorMessage(error);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const handleSort = (column) => {
    if (sortCol === column) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortCol(column);
    setSortDir('desc');
  };

  const handleExport = async () => {
    if (!filteredStats.length) {
      toast.error('Không có dữ liệu để xuất Excel.');
      return;
    }

    setExportingExcel(true);
    try {
      const [ExcelJS, fileSaver] = await Promise.all([
        import('exceljs'),
        import('file-saver')
      ]);
      const workbook = buildStatsExcelWorkbook(ExcelJS, filteredStats, phLoaiTypes, summary);
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const fileName = `ThongKePhuHieu_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`;
      const saveAs = fileSaver.saveAs || fileSaver.default;
      saveAs(blob, fileName);
      toast.success('Đã xuất file Excel.');
    } catch (error) {
      toast.error(`Xuất Excel thất bại: ${error.message}`);
    } finally {
      setExportingExcel(false);
    }
  };

  const sortIndicator = (column) => {
    if (sortCol !== column) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  const hasActiveFilters = Object.values(filters).some((value) => String(value || '').trim());

  const clearFilters = () => {
    setFilters(defaultFilters);
  };

  const renderLoadingSkeleton = () => (
    <>
      <div className="space-y-3 md:hidden">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-100" />
            <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-slate-100" />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 md:block">
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className="grid grid-cols-6 gap-4 border-b border-slate-100 bg-white p-4 last:border-b-0">
            <div className="h-4 animate-pulse rounded bg-slate-100" />
            <div className="col-span-2 h-4 animate-pulse rounded bg-slate-200" />
            <div className="h-4 animate-pulse rounded bg-slate-100" />
            <div className="h-4 animate-pulse rounded bg-slate-100" />
            <div className="h-4 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </>
  );

  const renderMobileCards = () => (
    <div className="space-y-3 md:hidden">
      {currentPageItems.map((item, index) => {
        const typeEntries = phLoaiTypes
          .map((type) => ({ type, total: item.byType?.[type] || 0 }))
          .filter((entry) => entry.total > 0);

        return (
          <article key={`${item.companyId}-mobile-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  #{(currentPage - 1) * PAGE_SIZE + index + 1} · {item.loaihinh || 'Chưa có loại hình'}
                </p>
                <h3 className="mt-1 break-words text-base font-semibold text-slate-900">{item.tenDonVi || 'Chưa có tên đơn vị'}</h3>
              </div>
              <div className="shrink-0 rounded-xl bg-emerald-50 px-3 py-2 text-center">
                <p className="text-[11px] font-medium text-emerald-700">Tổng PH</p>
                <p className="text-lg font-bold text-emerald-700">{item.total || 0}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm text-slate-600">
              {item.diaChi && (
                <div className="flex gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <span>{item.diaChi}</span>
                </div>
              )}
              {item.dienThoai && (
                <div className="flex gap-2">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <span>{item.dienThoai}</span>
                </div>
              )}
              {item.email && (
                <div className="flex gap-2">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <span className="break-all text-red-700">{item.email}</span>
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-red-50 p-3">
                <p className="text-xs text-red-700">Đang khai thác</p>
                <p className="text-lg font-semibold text-red-800">{item.dangKhaiThac || 0}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Mã đơn vị</p>
                <p className="truncate text-sm font-semibold text-slate-800">{item.maDN || item.companyId}</p>
              </div>
            </div>

            {typeEntries.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {typeEntries.map((entry) => (
                  <span key={entry.type} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {entry.type}: {entry.total}
                  </span>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );

  const renderEmptyState = () => (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center">
      <Search className="mx-auto h-8 w-8 text-slate-300" />
      <h3 className="mt-3 text-base font-semibold text-slate-800">Không có dữ liệu phù hợp</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        Hãy thử đổi từ khóa, nới bộ lọc hoặc tải lại dữ liệu từ AppSheet.
      </p>
      {hasActiveFilters && (
        <Button variant="outline" className="mt-4" onClick={clearFilters}>
          Xóa lọc
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-w-0 space-y-6">
      <Card className="overflow-hidden bg-gradient-to-r from-red-700 via-red-600 to-red-500 text-white">
        <CardHeader>
          <div className="grid min-w-0 gap-4 xl:grid-cols-[1fr_auto] xl:items-start">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-3 text-xl text-white sm:text-2xl">
                <IdCard className="h-7 w-7 shrink-0 text-yellow-300" />
                <span className="min-w-0">Thống kê phù hiệu xe theo đơn vị vận tải</span>
              </CardTitle>
              <CardDescription className="mt-2 text-red-50">
                Bản React page, đọc AppSheet bằng `appSheetService` và dùng cùng cấu hình `.env` của project.
              </CardDescription>
            </div>

            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-none xl:grid-flow-col xl:auto-cols-max">
              <Button variant="secondary" className="w-full sm:w-auto" onClick={() => window.open('/TN_thongke_phuhieu_donvi_standalone.html', '_blank')}>
                Mở bản HTML
              </Button>
              <Button className="w-full bg-white text-red-700 hover:bg-red-50 sm:w-auto" onClick={() => refreshData(false)}>
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing || loading ? 'animate-spin' : ''}`} />
                Làm mới
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Bộ lọc</CardTitle>
              <CardDescription>Giữ cùng tinh thần với file HTML gốc để bạn so sánh trực tiếp.</CardDescription>
            </div>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Xóa lọc
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="min-w-0 xl:col-span-2">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
              <Search className="h-4 w-4 text-red-600" />
              Tìm kiếm đơn vị
            </label>
            <Input
              placeholder="Nhập tên đơn vị, mã doanh nghiệp..."
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            />
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium text-slate-700">Loại hình đơn vị</label>
            <select
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={filters.loaihinh}
              onChange={(event) => setFilters((current) => ({ ...current, loaihinh: event.target.value }))}
            >
              <option value="">Tất cả</option>
              {loaihinhOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium text-slate-700">Loại phù hiệu</label>
            <select
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={filters.loaiph}
              onChange={(event) => setFilters((current) => ({ ...current, loaiph: event.target.value }))}
            >
              <option value="">Tất cả</option>
              {phLoaiTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium text-slate-700">Xã / phường</label>
            <select
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={filters.quanhuyen}
              onChange={(event) => setFilters((current) => ({ ...current, quanhuyen: event.target.value }))}
            >
              <option value="">Tất cả</option>
              {quanhuyenOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
              <Filter className="h-4 w-4 text-amber-600" />
              Tổng phù hiệu
            </label>
            <div className="grid gap-2">
              <select
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={filters.totalOp}
                onChange={(event) => setFilters((current) => ({ ...current, totalOp: event.target.value }))}
              >
                {numberCompareOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="Từ"
                  value={filters.totalMin}
                  onChange={(event) => setFilters((current) => ({ ...current, totalMin: event.target.value }))}
                />
                <Input
                  type="number"
                  placeholder="Đến"
                  value={filters.totalMax}
                  onChange={(event) => setFilters((current) => ({ ...current, totalMax: event.target.value }))}
                  disabled={filters.totalOp !== 'between'}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {summaryMeta.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.key}>
              <CardHeader>
                <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${item.tone}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <CardTitle>{item.label}</CardTitle>
                <CardDescription>{summary[item.key].toLocaleString('vi-VN')}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}

        {phLoaiTypes.slice(0, 3).map((type) => (
          <Card key={type}>
            <CardHeader>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                <BarChart3 className="h-6 w-6" />
              </div>
              <CardTitle>{type}</CardTitle>
              <CardDescription>{(summary.typeTotals[type] || 0).toLocaleString('vi-VN')}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="grid min-w-0 gap-3 xl:grid-cols-[1fr_auto] xl:items-center">
            <div className="min-w-0">
              <CardTitle>Danh sách đơn vị vận tải</CardTitle>
              <CardDescription>
                {loading
                  ? 'Đang tải dữ liệu...'
                  : `Hiển thị ${currentPageItems.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}-${Math.min(
                      currentPage * PAGE_SIZE,
                      filteredStats.length
                    )} / ${filteredStats.length} đơn vị`}
              </CardDescription>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-flow-col sm:items-center xl:w-auto">
              <span className="text-sm text-slate-500">Cập nhật: {lastUpdated || 'Chưa có'}</span>
              <Button variant="secondary" className="w-full sm:w-auto" onClick={handleExport} disabled={exportingExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {exportingExcel ? 'Đang xuất...' : 'Xuất Excel'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <div className="mb-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold">Chưa tải được dữ liệu mới</p>
                <p className="mt-1">{errorMessage}</p>
              </div>
            </div>
          )}

          {loading && !statsData.length ? (
            renderLoadingSkeleton()
          ) : !currentPageItems.length ? (
            renderEmptyState()
          ) : (
            <>
              {renderMobileCards()}

              <div className="hidden overflow-auto rounded-2xl border border-slate-200 md:block">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-red-700 text-white">
                    <tr>
                      <th className="px-3 py-3 text-left">STT</th>
                      <th className="cursor-pointer px-3 py-3 text-left" onClick={() => handleSort('loaihinh')}>
                        Loại hình{sortIndicator('loaihinh')}
                      </th>
                      <th className="cursor-pointer px-3 py-3 text-left" onClick={() => handleSort('tenDonVi')}>
                        Tên đơn vị{sortIndicator('tenDonVi')}
                      </th>
                      <th className="px-3 py-3 text-left">Địa chỉ</th>
                      <th className="px-3 py-3 text-left">Người đại diện</th>
                      <th className="px-3 py-3 text-left">Điện thoại</th>
                      <th className="px-3 py-3 text-left">Email</th>
                      <th className="cursor-pointer px-3 py-3 text-center" onClick={() => handleSort('dangKhaiThac')}>
                        Đang KT{sortIndicator('dangKhaiThac')}
                      </th>
                      <th className="cursor-pointer px-3 py-3 text-center" onClick={() => handleSort('total')}>
                        Tổng PH{sortIndicator('total')}
                      </th>
                      {phLoaiTypes.map((type) => (
                        <th key={type} className="cursor-pointer px-3 py-3 text-center" onClick={() => handleSort(type)}>
                          {type}
                          {sortIndicator(type)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentPageItems.map((item, index) => (
                      <tr key={`${item.companyId}-${index}`} className="border-t border-slate-100 odd:bg-white even:bg-slate-50">
                        <td className="px-3 py-3 text-slate-500">{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                        <td className="px-3 py-3">{item.loaihinh}</td>
                        <td className="px-3 py-3 font-semibold text-slate-800">{item.tenDonVi}</td>
                        <td className="px-3 py-3 text-slate-600">{item.diaChi}</td>
                        <td className="px-3 py-3 text-slate-600">{item.nguoiDaiDien}</td>
                        <td className="px-3 py-3 text-slate-600">{item.dienThoai}</td>
                        <td className="px-3 py-3 text-red-700">{item.email}</td>
                        <td className="px-3 py-3 text-center font-semibold text-red-700">{item.dangKhaiThac || ''}</td>
                        <td className="px-3 py-3 text-center font-semibold text-emerald-700">{item.total}</td>
                        {phLoaiTypes.map((type) => (
                          <td key={type} className="px-3 py-3 text-center">
                            {item.byType?.[type] || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 grid gap-3 sm:flex sm:items-center sm:justify-between">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                >
                  Trang trước
                </Button>
                <span className="text-center text-sm text-slate-500">
                  Trang {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                >
                  Trang sau
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ThongKePhuHieuDonViPage;
