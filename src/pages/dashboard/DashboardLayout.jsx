import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  BarChart3,
  Car,
  FileText,
  Loader2,
  RefreshCw,
  Scale,
  TrendingUp,
  Users
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { EMPTY_FILTERS, fetchDashboardQlvt } from '../../features/dashboardQlvt';
import { DashboardContext } from './DashboardContext';

const NAV_ITEMS = [
  { to: '/dashboard/tong-quan', num: '1', label: 'Tổng quan', icon: BarChart3 },
  { to: '/dashboard/phuong-tien', num: '2', label: 'Phương tiện', icon: Car },
  { to: '/dashboard/nhan-su', num: '3', label: 'Nhân sự', icon: Users },
  { to: '/dashboard/tuan-thu', num: '4', label: 'Tuân thủ pháp lý', icon: Scale },
  { to: '/dashboard/bien-dong', num: '5', label: 'Biến động', icon: TrendingUp },
  { to: '/dashboard/bao-cao', num: '6', label: 'Báo cáo', icon: FileText }
];

// Bộ lọc giữ riêng cho từng màn (giống bản .gs — lọc màn này không ảnh hưởng màn kia).
const INITIAL_FILTERS = {
  'tong-quan': EMPTY_FILTERS,
  'phuong-tien': EMPTY_FILTERS,
  'nhan-su': EMPTY_FILTERS,
  'tuan-thu': EMPTY_FILTERS,
  'bien-dong': EMPTY_FILTERS,
  'bao-cao': EMPTY_FILTERS
};

const DashboardLayout = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filtersByScreen, setFiltersByScreen] = useState(INITIAL_FILTERS);

  const loadDashboard = useCallback(async (isRefresh = false) => {
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
  }, []);

  useEffect(() => { loadDashboard(false); }, [loadDashboard]);

  const setScreenFilters = useCallback((screen, updater) => {
    setFiltersByScreen((current) => ({
      ...current,
      [screen]: typeof updater === 'function' ? updater(current[screen]) : updater
    }));
  }, []);

  const updatedAt = data?.generatedAt ? new Date(data.generatedAt).toLocaleString('vi-VN') : 'Chưa cập nhật';

  const ctxValue = useMemo(() => ({
    data,
    loading,
    error,
    filtersByScreen,
    setScreenFilters,
    reload: loadDashboard
  }), [data, loading, error, filtersByScreen, setScreenFilters, loadDashboard]);

  return (
    <DashboardContext.Provider value={ctxValue}>
      <div className="-mx-4 -my-6 w-[calc(100%+2rem)] max-w-[calc(100%+2rem)] overflow-x-hidden bg-slate-100 lg:-mx-8 lg:w-[calc(100%+4rem)] lg:max-w-[calc(100%+4rem)]">
        {/* Header xanh navy + sub-nav 6 màn */}
        <div className="bg-[#0b2d5c] px-4 py-4 text-white shadow-sm lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <img className="h-11 w-11 shrink-0 rounded-full object-cover sm:h-[52px] sm:w-[52px]" src="/logo-taxi-123.png" alt="TAXI123" />
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold tracking-normal text-white sm:text-xl">Trung tâm điều hành QLVT TAXI123</h1>
                <p className="mt-0.5 flex items-center gap-2 truncate text-xs font-medium text-blue-100 sm:text-sm">
                  {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
                  Cập nhật: {updatedAt}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="h-10 w-10 shrink-0 rounded-full bg-white/10 p-0 text-white hover:bg-white/20"
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
              title="Cập nhật dữ liệu"
              aria-label="Cập nhật dữ liệu"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <nav className="mt-4 flex flex-wrap gap-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-bold transition sm:px-3.5 sm:text-sm ${
                    isActive ? 'bg-white text-[#0b2d5c] shadow-sm' : 'text-blue-100 hover:bg-white/10'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="min-w-0 max-w-full overflow-x-hidden px-4 pb-8 lg:px-8">
          {error && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          {data?.missingSources?.length > 0 && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Một số bảng chưa đọc được: {data.missingSources.map((item) => item.table).join(', ')}. Các cột liên quan sẽ để trống và có cảnh báo.
            </div>
          )}
          <Outlet />
        </div>
      </div>
    </DashboardContext.Provider>
  );
};

export default DashboardLayout;
