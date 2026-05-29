const runtimeConfig =
  typeof window !== 'undefined' && window.__APPSHEET_RUNTIME_CONFIG__
    ? window.__APPSHEET_RUNTIME_CONFIG__
    : {};

const config = {
  APP_NAME: 'TAXI 123_HN',
  LOGO_URL: '/logo-taxi-123.png',
  APP_ID: runtimeConfig.APP_ID || '',
  REGION: runtimeConfig.REGION || 'www',
  DEFAULT_TABLE: runtimeConfig.DEFAULT_TABLE || '',
  API_PROXY_URL: runtimeConfig.API_PROXY_URL || '/api/appsheet',
  get API_URL() {
    return `https://${this.REGION}.appsheet.com/api/v2/apps/${this.APP_ID}/tables`;
  },
  ROUTES: {
    HOME: '/',
    DASHBOARD: '/dashboard',
    THONG_KE_PHU_HIEU_REACT: '/thong-ke-phu-hieu-don-vi',
    QUYET_DINH_THU_HOI_GPKD_REACT: '/quyet-dinh-thu-hoi-gpkd',
    BAN_GIAO_XE_REACT: '/ban-giao-xe',
    KY_QUY_LAI_XE_REACT: '/ky-quy-lai-xe',
    BAN_GIAO_SO_BHXH_REACT: '/ban-giao-so-bhxh'
  }
};

export default config;
