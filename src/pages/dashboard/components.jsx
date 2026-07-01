import React from 'react';

export const CHART_PALETTE = ['#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6', '#64748b', '#0f766e'];

export function formatNumber(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

export function getPercent(value, total) {
  if (!total) return '0%';
  return `${Math.round((Number(value || 0) / total) * 100)}%`;
}

/* ---------- Bộ lọc ---------- */
export function SelectFilter({ label, value, options, onChange, getOptionLabel = (option) => option, allLabel = 'Tất cả' }) {
  const normalized = options.map((option) => (
    option && typeof option === 'object'
      ? { value: option.value, label: option.label }
      : { value: option, label: getOptionLabel(option) }
  ));
  return (
    <label className="min-w-0 space-y-1">
      <span className="block text-[11px] font-semibold text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        <option value="">{allLabel}</option>
        {normalized.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

// Ô chọn ngày tháng năm chuẩn (<input type="date">). Giá trị dạng 'YYYY-MM-DD'.
export function DateInput({ label, value, onChange }) {
  return (
    <label className="min-w-0 space-y-1">
      <span className="block text-[11px] font-semibold text-slate-500">{label}</span>
      <input
        type="date"
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

export function FilterBar({ children }) {
  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {children}
    </section>
  );
}

function toDayToken(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Nút bấm nhanh đặt khoảng "Từ ngày" / "Đến ngày".
export function QuickRangeButtons({ filters, setRange }) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const quyStart = Math.floor(m / 3) * 3;
  const ranges = [
    { id: 'thang-nay', label: 'Tháng này', from: toDayToken(new Date(y, m, 1)), to: toDayToken(new Date(y, m + 1, 0)) },
    { id: 'quy-nay', label: 'Quý này', from: toDayToken(new Date(y, quyStart, 1)), to: toDayToken(new Date(y, quyStart + 3, 0)) },
    { id: 'nam-nay', label: 'Năm nay', from: `${y}-01-01`, to: `${y}-12-31` },
    { id: '30-ngay', label: '30 ngày tới', from: toDayToken(now), to: toDayToken(new Date(y, m, now.getDate() + 30)) },
    { id: '90-ngay', label: '90 ngày tới', from: toDayToken(now), to: toDayToken(new Date(y, m, now.getDate() + 90)) }
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ranges.map((range) => {
        const isActive = filters.tuNgay === range.from && filters.denNgay === range.to;
        return (
          <button
            key={range.id}
            type="button"
            onClick={() => setRange(isActive ? '' : range.from, isActive ? '' : range.to)}
            className={`rounded-full border px-3 py-1 text-xs font-bold transition ${isActive ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700'}`}
          >
            {range.label}
          </button>
        );
      })}
    </div>
  );
}

export function FilterActions({ onApply, onReset }) {
  return (
    <div className="flex gap-2">
      {onApply && <button type="button" onClick={onApply} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">Áp dụng</button>}
      <button type="button" onClick={onReset} className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-300">Xóa lọc</button>
    </div>
  );
}

/* ---------- KPI card ---------- */
export function MetricCard({ icon: Icon, label, value, percent, tone, barColor, ratio, onClick, active }) {
  const width = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) * 100 : null;
  const clickable = typeof onClick === 'function';
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={clickable ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(); } } : undefined}
      className={`rounded-lg border bg-white p-3 shadow-sm transition sm:p-4 ${clickable ? 'cursor-pointer hover:border-blue-300 hover:shadow' : ''} ${active ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200'}`}
      title={clickable ? (active ? 'Đang lọc — bấm để bỏ lọc' : `Lọc theo: ${label}`) : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-slate-500 sm:text-sm">{label}</p>
          <p className="mt-1.5 text-2xl font-bold leading-none text-slate-950 sm:mt-2 sm:text-3xl">{formatNumber(value)}</p>
          <p className="mt-1.5 truncate text-[11px] font-semibold text-slate-500 sm:mt-2 sm:text-xs">{active ? 'Đang lọc — bấm để bỏ' : percent}</p>
        </div>
        {Icon && (
          <div className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-full sm:flex sm:h-11 sm:w-11 ${tone}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {width !== null && (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${barColor || 'bg-blue-500'}`} style={{ width: `${width}%` }} />
        </div>
      )}
    </div>
  );
}

/* ---------- Donut ---------- */
function donutBackground(items) {
  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
  if (!total) return '#e2e8f0';
  let current = 0;
  const stops = items.map((item, index) => {
    const start = current;
    current += (Number(item.value || 0) / total) * 360;
    return `${CHART_PALETTE[index % CHART_PALETTE.length]} ${start}deg ${current}deg`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

export function DonutChart({ title, items, icon: Icon }) {
  const data = items.length ? items : [{ label: 'Chưa có dữ liệu', value: 0 }];
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);
  return (
    <div className="min-w-0 rounded-md border border-slate-100 bg-slate-50/80 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="truncate text-sm font-bold text-slate-800">{title}</h3>
        <span className="text-xs font-semibold text-slate-500">{formatNumber(total)}</span>
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-32 w-32 shrink-0 rounded-full" style={{ background: donutBackground(data) }}>
          <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
            {Icon && <Icon className="h-5 w-5 text-blue-700" />}
            <span className="mt-1 text-lg font-bold text-slate-950">{formatNumber(total)}</span>
          </div>
        </div>
        <div className="w-full min-w-0 space-y-2">
          {data.map((item, index) => (
            <div key={`${title}-${item.label}`} className="flex items-center gap-2 text-xs text-slate-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CHART_PALETTE[index % CHART_PALETTE.length] }} />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span className="shrink-0 font-bold text-slate-900">{formatNumber(item.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChartPanel({ title, totalLabel, children, gridClassName = 'sm:grid-cols-2 xl:grid-cols-4' }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-bold text-slate-950">{title}</h2>
        {totalLabel && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{totalLabel}</span>}
      </div>
      <div className={`grid gap-4 p-4 ${gridClassName}`}>{children}</div>
    </section>
  );
}

/* ---------- Thanh ngang (top-N / phân bố) ---------- */
export function TopBarChart({ title, rows, unit }) {
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
                style={{ width: `${max ? Math.max(5, Math.round((item.value / max) * 100)) : 0}%`, backgroundColor: CHART_PALETTE[index % CHART_PALETTE.length] }}
              />
            </div>
            <span className="w-24 text-right text-xs font-bold text-slate-900">{formatNumber(item.value)}{unit ? ` ${unit}` : ''}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Vòng tỷ lệ tuân thủ (gauge) ---------- */
export function GaugeRing({ value, label }) {
  const pct = Math.max(0, Math.min(100, Number(value || 0)));
  const color = pct >= 90 ? '#16a34a' : pct >= 70 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex flex-col items-center gap-2 p-2 text-center">
      <div
        className="relative grid h-20 w-20 place-items-center rounded-full"
        style={{ background: `conic-gradient(${color} ${pct * 3.6}deg, #e2e8f0 0deg)` }}
      >
        <div className="grid h-[58px] w-[58px] place-items-center rounded-full bg-white text-sm font-black text-slate-900">
          {pct}%
        </div>
      </div>
      <span className="text-xs font-bold leading-tight text-slate-600">{label}</span>
    </div>
  );
}

/* ---------- Hộp cảnh báo lớn (đỏ / vàng) ---------- */
export function AlertBox({ tone, value, label }) {
  const bg = tone === 'red' ? 'from-rose-400 to-red-600' : 'from-amber-300 to-amber-600';
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${bg} p-4 text-white shadow-lg`}>
      <div className="text-4xl font-black leading-none">{formatNumber(value)}</div>
      <div className="mt-2 text-[11px] font-black uppercase tracking-wider opacity-95">{label}</div>
    </div>
  );
}

/* ---------- Biểu đồ cột dọc (độ tuổi, thâm niên, năm SX...) ---------- */
export function BarChartV({ items, color = '#2563eb', unit = '' }) {
  const data = Array.isArray(items) && items.length ? items : [{ label: '—', value: 0 }];
  const max = data.reduce((m, it) => Math.max(m, Number(it.value || 0)), 0) || 1;
  return (
    <div>
      <div className="flex items-end justify-around gap-2" style={{ height: 180 }}>
        {data.map((it, index) => (
          <div key={`${it.label}-${index}`} className="flex flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-xs font-bold text-slate-700">{formatNumber(it.value)}</span>
            <div className="w-full max-w-12 rounded-t transition-all" style={{ height: `${Math.max(2, (it.value / max) * 140)}px`, backgroundColor: color }} title={`${it.label}: ${it.value}${unit}`} />
            <span className="text-center text-[11px] font-semibold leading-tight text-slate-500">{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Bảng cảnh báo (biển số / họ tên + hạng mục + ngày hết hạn) ---------- */
export function AlertTable({ rows, firstCol = 'Đối tượng', secondCol = 'Đội / Chức danh', max = 300 }) {
  const list = Array.isArray(rows) ? rows : [];
  return (
    <div className="max-h-[420px] overflow-auto rounded-md border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2.5 font-bold">{firstCol}</th>
            <th className="px-3 py-2.5 font-bold">{secondCol}</th>
            <th className="px-3 py-2.5 font-bold">Hạng mục</th>
            <th className="px-3 py-2.5 font-bold">Ngày hết hạn</th>
            <th className="px-3 py-2.5 font-bold">Còn lại</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {list.slice(0, max).map((row, index) => (
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
          {list.length === 0 && (
            <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">Không có cảnh báo.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function SectionCard({ title, badge, children, className = '' }) {
  return (
    <section className={`min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">{title}</h2>
        {badge != null && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{badge}</span>}
      </div>
      <div className="min-w-0 p-4">{children}</div>
    </section>
  );
}
