import React from 'react';
import { Navigate } from 'react-router-dom';
import config from '../config/config';
import BanGiaoXePage from '../pages/BanGiaoXePage';
import BanGiaoSoBHXHPage from '../pages/BanGiaoSoBHXHPage';
import ChamDutHopDongLaoDongPage from '../pages/ChamDutHopDongLaoDongPage';
import DeNghiDaoTaoLaiXePage from '../pages/DeNghiDaoTaoLaiXePage';
import DeNghiCapPhuHieuXePage from '../pages/DeNghiCapPhuHieuXePage';
import DashboardPage from '../pages/DashboardPage';
import HdldNhanVienLaiXePage from '../pages/HdldNhanVienLaiXePage';
import KyQuyLaiXePage from '../pages/KyQuyLaiXePage';
import QuyetDinhThuHoiGPKDPage from '../pages/QuyetDinhThuHoiGPKDPage';
import ThanhLyHopDongLaoDongPage from '../pages/ThanhLyHopDongLaoDongPage';
import ThanhLyKyQuyLaiXePage from '../pages/ThanhLyKyQuyLaiXePage';
import ThongBaoNgungPhuHieuPage from '../pages/ThongBaoNgungPhuHieuPage';
import ThongKePhuHieuDonViPage from '../pages/ThongKePhuHieuDonViPage';

export const appRoutes = [
  { path: config.ROUTES.HOME, element: <Navigate to={config.ROUTES.DASHBOARD} replace /> },
  { path: config.ROUTES.DASHBOARD, element: <DashboardPage /> },
  { path: config.ROUTES.THONG_KE_PHU_HIEU_REACT, element: <ThongKePhuHieuDonViPage /> },
  { path: config.ROUTES.DE_NGHI_CAP_PHU_HIEU_XE_REACT, element: <DeNghiCapPhuHieuXePage /> },
  { path: config.ROUTES.THONG_BAO_NGUNG_PHU_HIEU_REACT, element: <ThongBaoNgungPhuHieuPage /> },
  { path: config.ROUTES.DE_NGHI_DAO_TAO_LAI_XE_REACT, element: <DeNghiDaoTaoLaiXePage /> },
  { path: config.ROUTES.QUYET_DINH_THU_HOI_GPKD_REACT, element: <QuyetDinhThuHoiGPKDPage /> },
  { path: config.ROUTES.BAN_GIAO_XE_REACT, element: <BanGiaoXePage /> },
  { path: config.ROUTES.KY_QUY_LAI_XE_REACT, element: <KyQuyLaiXePage /> },
  { path: config.ROUTES.THANH_LY_KY_QUY_LAI_XE_REACT, element: <ThanhLyKyQuyLaiXePage /> },
  { path: config.ROUTES.BAN_GIAO_SO_BHXH_REACT, element: <BanGiaoSoBHXHPage /> },
  { path: config.ROUTES.HDLD_NHAN_VIEN_LAI_XE_REACT, element: <HdldNhanVienLaiXePage /> },
  { path: config.ROUTES.CHAM_DUT_HOP_DONG_LAO_DONG_REACT, element: <ChamDutHopDongLaoDongPage /> },
  { path: config.ROUTES.THANH_LY_HOP_DONG_LAO_DONG_REACT, element: <ThanhLyHopDongLaoDongPage /> },
  { path: '*', element: <Navigate to={config.ROUTES.DASHBOARD} replace /> }
];
