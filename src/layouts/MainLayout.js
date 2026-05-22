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
      <div key={section.id} className="space-y-2">
        {!collapsed && <p className="px-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{section.title}</p>}
        <div className="space-y-1.5">
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
                className={`group relative w-full rounded-2xl text-left transition-all duration-200 ease-out ${collapsed ? 'flex h-11 items-center justify-center px-0' : 'px-3.5 py-2.5'
                  } ${active
                    ? 'bg-red-50 text-red-800 shadow-sm ring-1 ring-red-100'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                  } ${isMobile ? 'min-h-[72px]' : ''}`}
              >
                {active && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-red-600" />}
                <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${active ? 'bg-white text-red-700 shadow-sm' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-slate-800'
                      }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  {!collapsed && <div className="min-w-0">
                    <div className="font-medium leading-5">{item.text}</div>
                  </div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    ));

  const renderBrand = (compact = false) => (
    <div className={`flex items-center ${compact ? 'justify-center gap-0' : 'gap-3'}`}>
      <div className={`${compact ? 'h-10 w-10' : 'h-10 w-10'} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-slate-200`}>
        <img src={config.LOGO_URL} alt="Logo TAXI 123_HN" className="h-full w-full object-cover" />
      </div>
      {!compact && <div>
        <h1 className="text-lg font-semibold text-slate-950">TAXI 123_HN</h1>
      </div>}
    </div>
  );

  const renderPageHeading = () => (
      <div className="min-w-0">
        <h2 className="truncate text-lg font-semibold text-slate-900 sm:text-xl">{getPageTitleByPath(location.pathname)}</h2>
      </div>
  );

  return (
    <div className="app-print-root h-screen overflow-hidden bg-slate-100">
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Đóng menu"
            className="absolute inset-0 bg-slate-950/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative flex h-full w-[min(22rem,86vw)] flex-col border-r border-slate-200 bg-white text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              {renderBrand(true)}
              <button
                type="button"
                aria-label="Đóng menu"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
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
          className={`hidden h-screen shrink-0 border-r border-slate-200 bg-white text-slate-900 shadow-sm transition-[width] duration-300 ease-out lg:flex lg:flex-col ${sidebarCollapsed ? 'w-20' : 'w-72'
            }`}
        >
          <div className={`flex h-[76px] items-center border-b border-slate-200 transition-all duration-300 ${sidebarCollapsed ? 'px-3' : 'px-6'}`}>
            <div className="flex w-full items-center justify-between gap-3">
              {renderBrand(sidebarCollapsed)}
              {!sidebarCollapsed && (
                <button
                  type="button"
                  aria-label="Thu gọn thanh điều hướng"
                  onClick={() => setSidebarCollapsed(true)}
                  className="rounded-xl bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <nav className={`scrollbar-sidebar flex-1 space-y-5 overflow-y-auto py-5 transition-all duration-300 ${sidebarCollapsed ? 'px-3' : 'px-4'}`}>
            {sidebarCollapsed && (
              <button
                type="button"
                aria-label="Mở rộng thanh điều hướng"
                onClick={() => setSidebarCollapsed(false)}
                className="mb-3 flex h-10 w-full items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
            {renderMenuItems(false, sidebarCollapsed)}
          </nav>
        </aside>

        <div className="app-print-content flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
          <header className="z-30 h-[76px] shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex h-full min-w-0 items-center justify-between gap-3 px-4 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  aria-label="Mở menu"
                  onClick={() => setMobileMenuOpen(true)}
                  className="rounded-xl bg-slate-100 p-2 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 lg:hidden"
                >
                  <Menu className="h-5 w-5 text-slate-700" />
                </button>
                {renderPageHeading()}
              </div>

            </div>
          </header>

          <main className="app-print-main scrollbar-enterprise min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
