import React from 'react';
import { ArrowRight, BookMarked, Car, FileText, Gauge, GraduationCap, Landmark, HandCoins, ScrollText, ShieldCheck, LayoutGrid } from 'lucide-react';
import { Link } from 'react-router-dom';
import config from '../config/config';

const actions = [
  {
    title: 'Dashboard điều hành',
    description: 'Tổng quan nhân sự, phương tiện, cảnh báo hết hạn và báo cáo QLVT.',
    path: config.ROUTES.DASHBOARD,
    icon: LayoutGrid,
    tone: 'bg-red-50 text-red-700'
  },
  {
    title: 'Đề nghị cấp phù hiệu',
    description: 'Xem trước, in và xuất đơn đề nghị cấp phù hiệu xe từ hồ sơ Google Sheets.',
    path: config.ROUTES.DE_NGHI_CAP_PHU_HIEU_XE_REACT,
    icon: FileText,
    tone: 'bg-amber-50 text-amber-700'
  },
  {
    title: 'Đề nghị đào tạo lái xe',
    description: 'Xem trước, in và xuất Excel danh sách lái xe đề nghị đào tạo từ hồ sơ Google Sheets.',
    path: config.ROUTES.DE_NGHI_DAO_TAO_LAI_XE_REACT,
    icon: GraduationCap,
    tone: 'bg-orange-50 text-orange-700'
  },
  {
    title: 'Đề nghị cấp bảo hiểm',
    description: 'Xem trước, in và xuất Excel danh sách xe đề nghị cấp bảo hiểm từ hồ sơ Google Sheets.',
    path: config.ROUTES.DE_NGHI_CAP_BAO_HIEM_REACT,
    icon: ShieldCheck,
    tone: 'bg-red-50 text-red-700'
  },
  {
    title: 'Đề nghị kiểm định taximet',
    description: 'Xem trước, in và xuất Excel danh sách xe đề nghị kiểm định taximet từ hồ sơ Google Sheets.',
    path: config.ROUTES.DE_NGHI_KIEM_DINH_TAXIMET_REACT,
    icon: Gauge,
    tone: 'bg-amber-50 text-amber-700'
  },
  {
    title: 'Đề nghị thế chấp',
    description: 'Xem trước, in và xuất Excel danh sách xe đề nghị thế chấp từ hồ sơ Google Sheets.',
    path: config.ROUTES.DE_NGHI_THE_CHAP_REACT,
    icon: Landmark,
    tone: 'bg-orange-50 text-orange-700'
  },
  {
    title: 'Thu hồi GPKD',
    description: 'Xem trước, in và xuất quyết định thu hồi giấy phép.',
    path: `${config.ROUTES.QUYET_DINH_THU_HOI_GPKD_REACT}?IDQuyetDinh=`,
    icon: FileText,
    tone: 'bg-red-50 text-red-700'
  },
  {
    title: 'Bàn giao xe',
    description: 'Quản lý, lập và xuất biên bản bàn giao xe chi tiết cho lái xe.',
    path: config.ROUTES.BAN_GIAO_XE_REACT,
    icon: Car,
    tone: 'bg-amber-50 text-amber-700'
  },
  {
    title: 'Thỏa thuận dân sự',
    description: 'Xem trước, in và xuất thỏa thuận trách nhiệm dân sự của lái xe từ Google Sheets.',
    path: config.ROUTES.THOA_THUAN_DAN_SU_REACT,
    icon: FileText,
    tone: 'bg-orange-50 text-orange-700'
  },
  {
    title: 'Ký quỹ lái xe',
    description: 'Xem trước, in và xuất hợp đồng ký quỹ của lái xe từ Google Sheets.',
    path: config.ROUTES.KY_QUY_LAI_XE_REACT,
    icon: HandCoins,
    tone: 'bg-red-50 text-red-700'
  },
  {
    title: 'Thanh lý ký quỹ',
    description: 'Xem trước, in và xuất biên bản thanh lý hợp đồng đặt cọc lái xe từ Google Sheets.',
    path: config.ROUTES.THANH_LY_KY_QUY_LAI_XE_REACT,
    icon: FileText,
    tone: 'bg-amber-50 text-amber-700'
  },
  {
    title: 'Bàn giao sổ BHXH',
    description: 'Xem trước, in và xuất biên bản bàn giao sổ bảo hiểm xã hội.',
    path: config.ROUTES.BAN_GIAO_SO_BHXH_REACT,
    icon: BookMarked,
    tone: 'bg-orange-50 text-orange-700'
  },
  {
    title: 'HĐLĐ nhân viên lái xe',
    description: 'Xem trước, in và xuất hợp đồng lao động nhân viên lái xe từ Google Sheets.',
    path: config.ROUTES.HDLD_NHAN_VIEN_LAI_XE_REACT,
    icon: ScrollText,
    tone: 'bg-red-50 text-red-700'
  },
  {
    title: 'Chấm dứt HĐLĐ',
    description: 'Xem trước, in và xuất quyết định chấm dứt hợp đồng lao động từ Google Sheets.',
    path: config.ROUTES.CHAM_DUT_HOP_DONG_LAO_DONG_REACT,
    icon: FileText,
    tone: 'bg-amber-50 text-amber-700'
  },
  {
    title: 'Thanh lý HĐLĐ',
    description: 'Xem trước, in và xuất biên bản thanh lý hợp đồng lao động từ Google Sheets.',
    path: config.ROUTES.THANH_LY_HOP_DONG_LAO_DONG_REACT,
    icon: FileText,
    tone: 'bg-orange-50 text-orange-700'
  }
];

const MenuPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Chức năng chính</h1>
        <p className="mt-1 text-sm text-slate-500">Chọn nghiệp vụ cần thực hiện.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {actions.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.title}
              to={item.path}
              className="group flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-red-200 hover:bg-red-50/30 hover:shadow-md"
            >
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.tone}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-red-500" />
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default MenuPage;
