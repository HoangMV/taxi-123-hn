import React from 'react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from 'chart.js';
import { Chart } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Legend, Tooltip);
ChartJS.defaults.font.family = '"Be Vietnam Pro", system-ui, -apple-system, "Segoe UI", Arial, sans-serif';
ChartJS.defaults.color = '#475569';

/**
 * Biểu đồ biến động: 2 cột (vào/ra) + 1 đường luỹ kế cuối kỳ (trục Y phải).
 * Cấu hình khớp bản .gs gốc (comboChart): bar y-trái, line y1-phải.
 */
export default function ComboChart({ series, labelNhap = 'Vào mới', labelXuat = 'Rời đi', showCumulative = true, height = 250 }) {
  const rows = Array.isArray(series) ? series : [];
  const labels = rows.map((s) => s.ky);

  const datasets = [
    { type: 'bar', label: labelNhap, data: rows.map((s) => Number(s.nhap || 0)), backgroundColor: '#16a34a', borderRadius: 4, maxBarThickness: 22, order: 2 },
    { type: 'bar', label: labelXuat, data: rows.map((s) => Number(s.xuat || 0)), backgroundColor: '#ef4444', borderRadius: 4, maxBarThickness: 22, order: 2 }
  ];
  if (showCumulative) {
    datasets.push({
      type: 'line',
      label: 'Luỹ kế cuối kỳ',
      data: rows.map((s) => Number(s.cuoiKy || 0)),
      borderColor: '#2563eb',
      backgroundColor: '#2563eb',
      tension: 0.3,
      pointRadius: 3,
      borderWidth: 2,
      yAxisID: 'y1',
      order: 1
    });
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 }, usePointStyle: true, pointStyle: 'circle' } },
      tooltip: { backgroundColor: 'rgba(15,23,42,.92)', padding: 10, cornerRadius: 10 }
    },
    scales: {
      y: { beginAtZero: true, position: 'left', ticks: { precision: 0 } },
      ...(showCumulative ? { y1: { position: 'right', grid: { display: false } } } : {})
    }
  };

  return (
    <div style={{ height }}>
      <Chart type="bar" data={{ labels, datasets }} options={options} />
    </div>
  );
}
