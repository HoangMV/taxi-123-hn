/**
 * Code.gs — Điểm vào Web App QLVT Dashboard + các API cho frontend.
 *   Cache 5 phút, khóa kèm chữ ký bộ lọc và "phiên bản cache".
 *   Nút "Làm mới" tăng phiên bản => vô hiệu mọi cache (kể cả cache có bộ lọc).
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('QLVT — Bảng điều khiển quản trị vận tải')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ---- Cache có phiên bản ---- */
function _cacheVer_() {
  const c = CacheService.getScriptCache();
  let v = c.get('CACHE_VER');
  if (!v) { v = '1'; try { c.put('CACHE_VER', v, 21600); } catch (e) {} }
  return v;
}
function _cacheKey_(prefix, bl) {
  try { return prefix + '|v' + _cacheVer_() + '|' + JSON.stringify(bl || {}); } catch (e) { return prefix + '|v' + _cacheVer_(); }
}
function _layCache_(prefix, bl, builder) {
  const c = CacheService.getScriptCache(); const ck = _cacheKey_(prefix, bl);
  const hit = c.get(ck);
  if (hit) return { ok: true, data: JSON.parse(hit), tuCache: true };
  const data = builder(bl);
  try { c.put(ck, JSON.stringify(data), CACHE_GIAY); } catch (e) {}
  return { ok: true, data: data, tuCache: false };
}

/* ---- API các màn ---- */
function getTongQuan(bl)   { try { return _layCache_('TONGQUAN', bl, buildTongQuan_); }   catch (e) { return { ok: false, message: e.message }; } }
function getPhuongTien(bl) { try { return _layCache_('PHUONGTIEN', bl, buildPhuongTien_); } catch (e) { return { ok: false, message: e.message }; } }
function getNhanSu(bl)     { try { return _layCache_('NHANSU', bl, buildNhanSu_); }       catch (e) { return { ok: false, message: e.message }; } }
function getTuanThu(bl)    { try { return _layCache_('TUANTHU', bl, buildTuanThu_); }     catch (e) { return { ok: false, message: e.message }; } }
function getBienDong(bl)   { try { return _layCache_('BIENDONG', bl, buildBienDong_); }   catch (e) { return { ok: false, message: e.message }; } }

function getDanhMucBaoCao() { try { return { ok: true, data: danhMucBaoCao_() }; } catch (e) { return { ok: false, message: e.message }; } }
function getBaoCao(key, bl)     { try { return { ok: true, data: buildBaoCao_(String(key || ''), bl) }; } catch (e) { return { ok: false, message: e.message }; } }

function getChanDoan() { try { return { ok: true, data: chanDoanDuLieu_() }; } catch (e) { return { ok: false, message: e.message }; } }

/* Làm mới: tăng phiên bản cache => mọi cache cũ (mọi bộ lọc) bị bỏ qua. */
function lamMoiTatCa() {
  try { CacheService.getScriptCache().put('CACHE_VER', String(Date.now()), 21600); } catch (e) {}
  return { ok: true };
}
