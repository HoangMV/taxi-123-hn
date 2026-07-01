import React, { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Car, Users } from 'lucide-react';
import { buildBienDong, filterNhanSuRows, filterXeRows } from '../../features/dashboardQlvt';
import { useDashboard } from './DashboardContext';
import { MetricCard, SectionCard, formatNumber } from './components';
import ComboChart from './ComboChart';

const SCREEN = 'bien-dong';

function TongHopBang({ tong }) {
  const tyLe = tong.dauKy ? Math.round((tong.tangGiam / tong.dauKy) * 1000) / 10 : 0;
  const rows = [
    ['Đầu kỳ', formatNumber(tong.dauKy), 'text-slate-900'],
    ['Vào mới trong kỳ', `+${formatNumber(tong.nhap)}`, 'text-emerald-600'],
    ['Rời đi trong kỳ', `-${formatNumber(tong.xuat)}`, 'text-red-600'],
    ['Cuối kỳ', formatNumber(tong.cuoiKy), 'text-slate-900'],
    ['Tăng / giảm', `${tong.tangGiam > 0 ? '+' : ''}${formatNumber(tong.tangGiam)}`, tong.tangGiam >= 0 ? 'text-emerald-600' : 'text-red-600'],
    ['Tỷ lệ tăng/giảm', `${tyLe > 0 ? '+' : ''}${tyLe}%`, tyLe >= 0 ? 'text-emerald-600' : 'text-red-600']
  ];
  return (
    <table className="min-w-full text-left text-sm">
      <tbody className="divide-y divide-slate-100">
        {rows.map(([label, value, color], index) => (
          <tr key={label} className={index >= rows.length - 2 ? 'font-black' : ''}>
            <td className="px-3 py-2.5 font-semibold text-slate-600">{label}</td>
            <td className={`px-3 py-2.5 text-right font-bold ${color}`}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const BienDongTab = () => {
  const { data, loading, filtersByScreen } = useDashboard();
  const filters = filtersByScreen[SCREEN];
  const nhanSu = useMemo(() => filterNhanSuRows(data?.reports?.nhanSu || [], filters), [data, filters]);
  const xe = useMemo(() => filterXeRows(data?.reports?.xe || [], filters), [data, filters]);
  const bienDong = useMemo(() => buildBienDong(nhanSu, xe), [nhanSu, xe]);
  // Biến động hồ sơ lấy từ backend (đếm ngày cấp / hết hạn 10 bảng).
  const hoSoSeries = useMemo(
    () => (data?.hoSoSummary?.bienDong || []).map((m) => ({ ky: m.ky, nhap: m.moi, xuat: m.het, cuoiKy: m.cuoiKy })),
    [data]
  );

  if (loading && !data) {
    return <div className="mt-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white py-16 text-sm font-semibold text-slate-500">Đang tải dữ liệu biến động…</div>;
  }

  const pt = bienDong.phuongTien.tong;
  const ns = bienDong.nhanSu.tong;

  return (
    <>
      <p className="mt-5 text-sm text-slate-500">Phân tích biến động {bienDong.soThang} tháng gần nhất (dựa trên ngày đưa vào hoạt động / ngừng của xe và ngày nhận / nghỉ việc của nhân sự).</p>

      {/* KPI-strip tóm tắt biến động kỳ */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard icon={Car} label="Xe vào mới trong kỳ" value={pt.nhap} percent={`Cuối kỳ: ${formatNumber(pt.cuoiKy)} xe`} tone="bg-emerald-50 text-emerald-700" barColor="bg-emerald-500" ratio={null} />
        <MetricCard icon={ArrowDownRight} label="Xe rời đi trong kỳ" value={pt.xuat} percent={`${pt.tangGiam >= 0 ? '+' : ''}${formatNumber(pt.tangGiam)} so đầu kỳ`} tone="bg-red-50 text-red-700" barColor="bg-red-500" ratio={null} />
        <MetricCard icon={Users} label="Nhân sự tuyển mới" value={ns.nhap} percent={`Cuối kỳ: ${formatNumber(ns.cuoiKy)} người`} tone="bg-blue-50 text-blue-700" barColor="bg-blue-500" ratio={null} />
        <MetricCard icon={ArrowUpRight} label="Nhân sự nghỉ việc" value={ns.xuat} percent={`${ns.tangGiam >= 0 ? '+' : ''}${formatNumber(ns.tangGiam)} so đầu kỳ`} tone="bg-amber-50 text-amber-700" barColor="bg-amber-500" ratio={null} />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-3">
        <SectionCard title="🚗 Biến động phương tiện">
          <ComboChart series={bienDong.phuongTien.series} labelNhap="Xe nhập mới" labelXuat="Xe xuất hàng" />
        </SectionCard>
        <SectionCard title="👥 Biến động nhân sự">
          <ComboChart series={bienDong.nhanSu.series} labelNhap="Tuyển mới" labelXuat="Nghỉ việc" />
        </SectionCard>
        <SectionCard title="📁 Biến động hồ sơ">
          <ComboChart series={hoSoSeries} labelNhap="Hồ sơ mới" labelXuat="Hồ sơ hết hạn" />
        </SectionCard>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <SectionCard title="Tổng hợp phương tiện" badge={bienDong.kyLabel}>
          <TongHopBang tong={bienDong.phuongTien.tong} />
        </SectionCard>
        <SectionCard title="Tổng hợp nhân sự" badge={bienDong.kyLabel}>
          <TongHopBang tong={bienDong.nhanSu.tong} />
        </SectionCard>
      </section>
    </>
  );
};

export default BienDongTab;
