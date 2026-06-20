const runtimeConfig =
  typeof window !== 'undefined' && window.__APPSHEET_RUNTIME_CONFIG__
    ? window.__APPSHEET_RUNTIME_CONFIG__
    : {};

const config = {
  APP_NAME: 'TAXI 123_HN',
  LOGO_URL: '/logo-taxi-123.png',
  DEFAULT_TABLE: runtimeConfig.DEFAULT_TABLE || '',
  API_BASE_URL: runtimeConfig.API_BASE_URL || '/api',
  ROUTES: {
    HOME: '/',
    DASHBOARD: '/dashboard',
    THONG_KE_PHU_HIEU_REACT: '/thong-ke-phu-hieu-don-vi',
    DE_NGHI_CAP_PHU_HIEU_XE_REACT: '/de-nghi-cap-phu-hieu-xe',
    THONG_BAO_NGUNG_PHU_HIEU_REACT: '/thong-bao-ngung-phu-hieu',
    DE_NGHI_DAO_TAO_LAI_XE_REACT: '/de-nghi-dao-tao-lai-xe',
    DE_NGHI_CAP_BAO_HIEM_REACT: '/de-nghi-cap-bao-hiem',
    DE_NGHI_KIEM_DINH_TAXIMET_REACT: '/de-nghi-kiem-dinh-taximet',
    DE_NGHI_THE_CHAP_REACT: '/de-nghi-the-chap',
    QUYET_DINH_THU_HOI_GPKD_REACT: '/quyet-dinh-thu-hoi-gpkd',
    BAN_GIAO_XE_REACT: '/ban-giao-xe',
    KY_QUY_LAI_XE_REACT: '/ky-quy-lai-xe',
    THANH_LY_KY_QUY_LAI_XE_REACT: '/thanh-ly-ky-quy-lai-xe',
    BAN_GIAO_SO_BHXH_REACT: '/ban-giao-so-bhxh',
    HDLD_NHAN_VIEN_LAI_XE_REACT: '/hdld-nhan-vien-lai-xe',
    CHAM_DUT_HOP_DONG_LAO_DONG_REACT: '/cham-dut-hop-dong-lao-dong',
    THANH_LY_HOP_DONG_LAO_DONG_REACT: '/thanh-ly-hop-dong-lao-dong',
    THOA_THUAN_DAN_SU_REACT: '/thoa-thuan-dan-su'
  }
};

export default config;
