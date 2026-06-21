import { BookMarked, Car, FileText, Gauge, GraduationCap, Landmark, HandCoins, IdCard, LayoutDashboard, ScrollText, ShieldCheck } from 'lucide-react';
import config from './config';

export const menuSections = [
  {
    id: 'operations',
    title: 'Nghiệp vụ',
    items: [
      {
        id: 'menu',
        text: 'Menu chức năng',
        path: config.ROUTES.MENU,
        icon: LayoutDashboard
      },
      {
        id: 'dashboard',
        text: 'Dashboard điều hành',
        path: config.ROUTES.DASHBOARD,
        icon: LayoutDashboard
      },
      {
        id: 'thong-ke-phu-hieu',
        text: 'Thống kê phù hiệu',
        path: config.ROUTES.THONG_KE_PHU_HIEU_REACT,
        icon: IdCard
      },
      {
        id: 'thong-bao-ngung-phu-hieu',
        text: 'Thông báo ngừng phù hiệu',
        path: config.ROUTES.THONG_BAO_NGUNG_PHU_HIEU_REACT,
        icon: IdCard
      },
      {
        id: 'de-nghi-cap-phu-hieu-xe',
        text: 'Đề nghị cấp phù hiệu',
        path: config.ROUTES.DE_NGHI_CAP_PHU_HIEU_XE_REACT,
        icon: FileText
      },
      {
        id: 'de-nghi-dao-tao-lai-xe',
        text: 'Đề nghị đào tạo lái xe',
        path: config.ROUTES.DE_NGHI_DAO_TAO_LAI_XE_REACT,
        icon: GraduationCap
      },
      {
        id: 'de-nghi-cap-bao-hiem',
        text: 'Đề nghị cấp bảo hiểm',
        path: config.ROUTES.DE_NGHI_CAP_BAO_HIEM_REACT,
        icon: ShieldCheck
      },
      {
        id: 'de-nghi-kiem-dinh-taximet',
        text: 'Đề nghị kiểm định taximet',
        path: config.ROUTES.DE_NGHI_KIEM_DINH_TAXIMET_REACT,
        icon: Gauge
      },
      {
        id: 'de-nghi-the-chap',
        text: 'Đề nghị thế chấp',
        path: config.ROUTES.DE_NGHI_THE_CHAP_REACT,
        icon: Landmark
      },
      {
        id: 'quyet-dinh-thu-hoi-gpkd',
        text: 'Thu hồi GPKD',
        path: config.ROUTES.QUYET_DINH_THU_HOI_GPKD_REACT,
        icon: FileText
      },
      {
        id: 'ban-giao-xe',
        text: 'Bàn giao xe',
        path: config.ROUTES.BAN_GIAO_XE_REACT,
        icon: Car
      },

      {
        id: 'thoa-thuan-dan-su',
        text: 'Thỏa thuận dân sự',
        path: config.ROUTES.THOA_THUAN_DAN_SU_REACT,
        icon: FileText
      },
      {
        id: 'ky-quy-lai-xe',
        text: 'Ký quỹ lái xe',
        path: config.ROUTES.KY_QUY_LAI_XE_REACT,
        icon: HandCoins
      },
      {
        id: 'thanh-ly-ky-quy-lai-xe',
        text: 'Thanh lý ký quỹ',
        path: config.ROUTES.THANH_LY_KY_QUY_LAI_XE_REACT,
        icon: FileText
      },
      {
        id: 'ban-giao-so-bhxh',
        text: 'Bàn giao sổ BHXH',
        path: config.ROUTES.BAN_GIAO_SO_BHXH_REACT,
        icon: BookMarked
      },
      {
        id: 'hdld-nhan-vien-lai-xe',
        text: 'HĐLĐ nhân viên lái xe',
        path: config.ROUTES.HDLD_NHAN_VIEN_LAI_XE_REACT,
        icon: ScrollText
      },
      {
        id: 'cham-dut-hop-dong-lao-dong',
        text: 'Chấm dứt HĐLĐ',
        path: config.ROUTES.CHAM_DUT_HOP_DONG_LAO_DONG_REACT,
        icon: FileText
      },
      {
        id: 'thanh-ly-hop-dong-lao-dong',
        text: 'Thanh lý HĐLĐ',
        path: config.ROUTES.THANH_LY_HOP_DONG_LAO_DONG_REACT,
        icon: FileText
      }
    ]
  }
];

export const menuItems = menuSections.flatMap((section) => section.items);

export const getPageTitleByPath = (path) => {
  const matched = menuItems.find((item) => item.path === path);
  return matched ? matched.text : 'TAXI 123_HN';
};
