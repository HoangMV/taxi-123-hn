import { Car, FileText, HandCoins, IdCard, LayoutDashboard } from 'lucide-react';
import config from './config';

export const menuSections = [
  {
    id: 'operations',
    title: 'Nghiệp vụ',
    items: [
      {
        id: 'dashboard',
        text: 'Tổng quan',
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
        id: 'ky-quy-lai-xe',
        text: 'Ký quỹ lái xe',
        path: config.ROUTES.KY_QUY_LAI_XE_REACT,
        icon: HandCoins
      }
    ]
  }
];

export const menuItems = menuSections.flatMap((section) => section.items);

export const getPageTitleByPath = (path) => {
  const matched = menuItems.find((item) => item.path === path);
  return matched ? matched.text : 'TAXI 123_HN';
};
