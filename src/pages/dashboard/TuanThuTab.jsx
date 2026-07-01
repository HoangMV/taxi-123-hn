import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, FileX } from 'lucide-react';
import { buildTuanThu, filterNhanSuRows, filterXeRows } from '../../features/dashboardQlvt';
import { useDashboard } from './DashboardContext';
import { MetricCard, SectionCard, formatNumber } from './components';

const SCREEN = 'tuan-thu';

function ComplianceTable({ rows }) {
  return (
    <div className="overflow-auto rounded-md border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2.5 font-bold">Hạng mục</th>
            <th className="px-3 py-2.5 text-center font-bold">Đủ điều kiện</th>
            <th className="px-3 py-2.5 text-center font-bold">Sắp hết</th>
            <th className="px-3 py-2.5 text-center font-bold">Quá hạn</th>
            <th className="px-3 py-2.5 text-center font-bold">Thiếu</th>
            <th className="px-3 py-2.5 font-bold">Tỷ lệ tuân thủ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.nhom} className="hover:bg-slate-50">
              <td className="px-3 py-2.5 font-semibold text-slate-800">{row.nhom}</td>
              <td className="px-3 py-2.5 text-center font-bold text-emerald-600">{formatNumber(row.conHan)}</td>
              <td className="px-3 py-2.5 text-center font-bold text-amber-600">{formatNumber(row.sapHet)}</td>
              <td className="px-3 py-2.5 text-center font-bold text-red-600">{formatNumber(row.quaHan)}</td>
              <td className="px-3 py-2.5 text-center font-bold text-slate-500">{formatNumber(row.thieu)}</td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-40 min-w-24 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full transition-all" style={{ width: `${row.tyLe}%`, backgroundColor: row.tyLe >= 90 ? '#16a34a' : row.tyLe >= 70 ? '#f59e0b' : '#ef4444' }} />
                  </div>
                  <span className="w-12 text-right text-xs font-black text-slate-800">{row.tyLe}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TuanThuTab = () => {
  const { data, loading, filtersByScreen } = useDashboard();
  const filters = filtersByScreen[SCREEN];
  const [tab, setTab] = useState('all');

  const nhanSu = useMemo(() => filterNhanSuRows(data?.reports?.nhanSu || [], filters), [data, filters]);
  const xe = useMemo(() => filterXeRows(data?.reports?.xe || [], filters), [data, filters]);
  const tuanThu = useMemo(() => buildTuanThu(nhanSu, xe, data?.hoSoSummary), [nhanSu, xe, data]);

  const tong = useMemo(() => {
    const all = [...tuanThu.phuongTien, ...tuanThu.nhanSu];
    const conHan = all.reduce((s, x) => s + x.conHan, 0);
    const sapHet = all.reduce((s, x) => s + x.sapHet, 0);
    const quaHan = all.reduce((s, x) => s + x.quaHan, 0);
    const thieu = all.reduce((s, x) => s + x.thieu, 0);
    const canCoTong = all.reduce((s, x) => s + x.canCo, 0);
    const dtConHan = all.reduce((s, x) => s + x.dtConHan, 0);
    const total = conHan + sapHet + quaHan;
    return { conHan, sapHet, quaHan, thieu, total, tyLe: canCoTong ? Math.round((dtConHan / canCoTong) * 1000) / 10 : 0 };
  }, [tuanThu]);

  if (loading && !data) {
    return <div className="mt-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white py-16 text-sm font-semibold text-slate-500">Đang tải dữ liệu tuân thủ…</div>;
  }

  const TABS = [['all', 'Tất cả'], ['pt', 'Phương tiện'], ['ns', 'Nhân sự']];

  return (
    <>
      {/* KPI-strip tóm tắt tuân thủ — đồng bộ Phương tiện / Nhân sự */}
      <section className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard icon={CheckCircle2} label="Hồ sơ đủ điều kiện" value={tong.conHan} percent={`${tong.tyLe}% tuân thủ`} tone="bg-emerald-50 text-emerald-700" barColor="bg-emerald-500" ratio={tong.tyLe / 100} />
        <MetricCard icon={Clock} label="Sắp hết hạn (≤30 ngày)" value={tong.sapHet} percent="Cần gia hạn sớm" tone="bg-amber-50 text-amber-700" barColor="bg-amber-500" ratio={tong.total ? tong.sapHet / tong.total : 0} />
        <MetricCard icon={AlertTriangle} label="Đã quá hạn" value={tong.quaHan} percent="Cần xử lý ngay" tone="bg-red-50 text-red-700" barColor="bg-red-500" ratio={tong.total ? tong.quaHan / tong.total : 0} />
        <MetricCard icon={FileX} label="Đối tượng thiếu hồ sơ" value={tong.thieu} percent="Chưa có bản ghi" tone="bg-slate-100 text-slate-600" barColor="bg-slate-400" ratio={null} />
      </section>

      <div className="mt-5 inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${tab === id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>{label}</button>
        ))}
      </div>

      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        {tab !== 'ns' && (
          <SectionCard title="🚗 Tuân thủ pháp lý phương tiện" className={tab === 'pt' ? 'xl:col-span-2' : ''}>
            <ComplianceTable rows={tuanThu.phuongTien} />
          </SectionCard>
        )}
        {tab !== 'pt' && (
          <SectionCard title="👥 Tuân thủ pháp lý nhân sự" className={tab === 'ns' ? 'xl:col-span-2' : ''}>
            <ComplianceTable rows={tuanThu.nhanSu} />
          </SectionCard>
        )}
      </section>

      <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-slate-600">
        <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-emerald-500" />Đủ điều kiện</span>
        <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-amber-500" />Sắp hết hạn (≤30 ngày)</span>
        <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-red-500" />Quá hạn</span>
      </div>
    </>
  );
};

export default TuanThuTab;
