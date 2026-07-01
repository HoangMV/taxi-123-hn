import React from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar, Doughnut } from 'react-chartjs-2';
import { formatNumber } from './components';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip);

export const PALETTE = ['#2563eb', '#06b6d4', '#16a34a', '#f59e0b', '#ef4444', '#7c3aed', '#ec4899', '#14b8a6', '#64748b', '#0f766e'];

// Plugin vẽ TỔNG ở giữa lỗ doughnut (giống bản .gs).
const centerTotalPlugin = {
  id: 'centerTotal',
  afterDraw(chart) {
    const { ctx, chartArea } = chart;
    const total = chart.config.options?.plugins?.centerTotal?.total;
    if (total == null || !chartArea) return;
    const cx = (chartArea.left + chartArea.right) / 2;
    const cy = (chartArea.top + chartArea.bottom) / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 22px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.fillText(total.toLocaleString('vi-VN'), cx, cy - 2);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 10px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.fillText('TỔNG', cx, cy + 16);
    ctx.restore();
  }
};

/* ---------- Doughnut cơ cấu — legend kèm số + %, tổng ở giữa ---------- */
export function DonutJs({ title, items, height = 240 }) {
  const data = Array.isArray(items) && items.length ? items : [{ label: 'Chưa có dữ liệu', value: 0 }];
  const total = data.reduce((s, it) => s + Number(it.value || 0), 0);
  const colors = data.map((_, i) => PALETTE[i % PALETTE.length]);

  const chartData = {
    labels: data.map((it) => it.label),
    datasets: [{ data: data.map((it) => Number(it.value || 0)), backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      centerTotal: { total },
      legend: { display: false },
      datalabels: {
        // Chỉ vẽ % lên miếng đủ lớn (>=6%) để không rối.
        color: '#fff',
        font: { weight: 700, size: 11 },
        formatter: (value) => (total && value / total >= 0.06 ? `${Math.round((value / total) * 100)}%` : ''),
        display: (ctx) => Number(ctx.dataset.data[ctx.dataIndex] || 0) > 0
      },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,.92)', padding: 10, cornerRadius: 10,
        callbacks: { label: (ctx) => ` ${ctx.label}: ${formatNumber(ctx.parsed)} (${total ? Math.round((ctx.parsed / total) * 100) : 0}%)` }
      }
    }
  };

  return (
    <div className="min-w-0 rounded-md border border-slate-100 bg-slate-50/80 p-4">
      {title && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="truncate text-sm font-bold text-slate-800">{title}</h3>
          <span className="text-xs font-semibold text-slate-500">{formatNumber(total)}</span>
        </div>
      )}
      <div style={{ height }}><Doughnut data={chartData} options={options} plugins={[ChartDataLabels, centerTotalPlugin]} /></div>
      {/* Legend tuỳ chỉnh: nhãn + số + % */}
      <div className="mt-3 space-y-1.5">
        {data.map((it, i) => (
          <div key={`${it.label}-${i}`} className="flex items-center gap-2 text-xs text-slate-600">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[i] }} />
            <span className="min-w-0 flex-1 truncate">{it.label}</span>
            <span className="shrink-0 font-bold text-slate-900">{formatNumber(it.value)}</span>
            <span className="w-10 shrink-0 text-right font-semibold text-slate-400">{total ? Math.round((Number(it.value || 0) / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Bar (dọc hoặc ngang) — số hiển thị trên/cạnh cột ---------- */
export function BarJs({ items, color = '#2563eb', horizontal = false, unit = '', height = 240, multiColor = false }) {
  const data = Array.isArray(items) && items.length ? items : [{ label: '—', value: 0 }];
  const chartData = {
    labels: data.map((it) => it.label),
    datasets: [{
      data: data.map((it) => Number(it.value || 0)),
      backgroundColor: multiColor ? data.map((_, i) => PALETTE[i % PALETTE.length]) : color,
      borderRadius: 5,
      maxBarThickness: horizontal ? 20 : 40
    }]
  };
  const options = {
    indexAxis: horizontal ? 'y' : 'x',
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: horizontal ? 0 : 18, right: horizontal ? 34 : 0 } },
    plugins: {
      legend: { display: false },
      datalabels: {
        anchor: horizontal ? 'end' : 'end',
        align: horizontal ? 'right' : 'top',
        color: '#334155',
        font: { weight: 700, size: 11 },
        formatter: (value) => (value ? formatNumber(value) : '')
      },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,.92)', padding: 10, cornerRadius: 10,
        callbacks: { label: (ctx) => ` ${formatNumber(horizontal ? ctx.parsed.x : ctx.parsed.y)}${unit ? ` ${unit}` : ''}` }
      }
    },
    scales: {
      x: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } }, grid: { display: !horizontal } },
      y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } }, grid: { display: horizontal } }
    }
  };
  return <div style={{ height }}><Bar data={chartData} options={options} plugins={[ChartDataLabels]} /></div>;
}
