import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Menu, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import config from '../config/config';
import { getPageTitleByPath, menuSections } from '../config/menuConfig';

const MainLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('taxi123hn.sidebar.collapsed') === 'true');

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem('taxi123hn.sidebar.collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const renderMenuItems = (isMobile = false, collapsed = false) =>
    menuSections.map((section) => (
      <div key={section.id} className="space-y-1.5">
        {!collapsed && <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400/90">{section.title}</p>}
        <div className="space-y-1">
          {section.items.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;

            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) {
                    setMobileMenuOpen(false);
                  }
                }}
                title={collapsed ? item.text : undefined}
                className={`group relative w-full rounded-xl text-left transition-all duration-200 ease-out ${collapsed ? 'flex h-10 items-center justify-center px-0' : 'px-3 py-2'
                  } ${active
                    ? 'bg-red-50 text-red-800 font-medium'
                    : 'text-slate-600 hover:bg-stone-100 hover:text-slate-900'
                  } ${isMobile ? 'min-h-[56px]' : ''}`}
              >
                {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-red-600" />}
                <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${active ? 'bg-red-100 text-red-700 shadow-sm' : 'text-slate-400 group-hover:bg-stone-200 group-hover:text-slate-600'
                      }`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  {!collapsed && <span className="text-[14px] leading-5 font-medium whitespace-nowrap">{item.text}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    ));

  const renderBrand = (compact = false) => (
    <div className={`flex items-center ${compact ? 'justify-center gap-0' : 'gap-2.5'}`}>
      <div className={`${compact ? 'h-8 w-8' : 'h-8 w-8'} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-red-100`}>
        <img src={config.LOGO_URL} alt="Logo TAXI 123_HN" className="h-full w-full object-cover" />
      </div>
      {!compact && <div>
        <h1 className="whitespace-nowrap text-[15px] font-semibold text-slate-950">{config.APP_NAME}</h1>
      </div>}
    </div>
  );

  const renderPageHeading = () => (
      <div className="min-w-0">
        <h2 className="truncate text-lg font-semibold text-slate-900 sm:text-xl">{getPageTitleByPath(location.pathname)}</h2>
      </div>
  );

  return (
    <div className="app-print-root h-screen overflow-hidden bg-stone-100">
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Đóng menu"
            className="absolute inset-0 bg-slate-950/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative flex h-full w-[min(22rem,86vw)] flex-col border-r border-red-100 bg-white text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-red-100 px-5 py-3.5">
              {renderBrand(false)}
              <button
                type="button"
                aria-label="Đóng menu"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl bg-stone-100 p-2 text-slate-600 transition hover:bg-stone-200 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="scrollbar-sidebar flex-1 space-y-5 overflow-y-auto px-4 py-4">{renderMenuItems(true)}</nav>
          </aside>
        </div>
      )}

      <div className="app-print-frame flex h-screen overflow-hidden">
        <aside
          className={`hidden h-screen shrink-0 border-r border-red-100 bg-white text-slate-900 shadow-sm transition-[width] duration-300 ease-out lg:flex lg:flex-col ${sidebarCollapsed ? 'w-20' : 'w-64'
            }`}
        >
          <div className={`flex h-16 items-center border-b border-red-100 transition-all duration-300 ${sidebarCollapsed ? 'px-3' : 'px-5'}`}>
            <div className="flex w-full items-center justify-between gap-3">
              {renderBrand(sidebarCollapsed)}
              {!sidebarCollapsed && (
                <button
                  type="button"
                  aria-label="Thu gọn thanh điều hướng"
                  onClick={() => setSidebarCollapsed(true)}
                  className="rounded-xl bg-stone-100 p-2 text-slate-500 transition hover:bg-stone-200 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <nav className={`scrollbar-sidebar flex-1 space-y-4 overflow-y-auto py-4 transition-all duration-300 ${sidebarCollapsed ? 'px-3' : 'px-3.5'}`}>
            {sidebarCollapsed && (
              <button
                type="button"
                aria-label="Mở rộng thanh điều hướng"
                onClick={() => setSidebarCollapsed(false)}
                className="mb-3 flex h-10 w-full items-center justify-center rounded-2xl bg-stone-100 text-slate-500 transition hover:bg-stone-200 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
            {renderMenuItems(false, sidebarCollapsed)}
          </nav>
        </aside>

        <div className="app-print-content flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
          <header className="z-30 h-16 shrink-0 border-b border-red-100 bg-white/95 backdrop-blur">
            <div className="flex h-full min-w-0 items-center justify-between gap-3 px-4 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  aria-label="Mở menu"
                  onClick={() => setMobileMenuOpen(true)}
                  className="rounded-xl bg-stone-100 p-2 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 lg:hidden"
                >
                  <Menu className="h-5 w-5 text-slate-700" />
                </button>
                {renderPageHeading()}
              </div>

            </div>
          </header>

          <main className="app-print-main scrollbar-enterprise min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-stone-100 px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
