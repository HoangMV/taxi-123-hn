<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<base target="_top">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<title>QLVT — Executive Transport Command Center</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<style>
/* ============================================================
   QLVT PREMIUM DASHBOARD UI — redesigned for Google Apps Script
   Mục tiêu: giao diện quản trị hiện đại, rõ dữ liệu, responsive,
   giữ nguyên toàn bộ ID/hàm JS đang gọi google.script.run.
   ============================================================ */
:root{
  --navy:#071a33;
  --navy-2:#0b2a55;
  --navy-3:#0f3b78;
  --primary:#2563eb;
  --primary-2:#1d4ed8;
  --primary-3:#60a5fa;
  --cyan:#06b6d4;
  --violet:#7c3aed;
  --ink:#0f172a;
  --text:#334155;
  --muted:#64748b;
  --soft:#f8fafc;
  --bg:#eef4ff;
  --card:#ffffff;
  --border:#dbe5f2;
  --line:#edf2f7;
  --green:#16a34a;
  --green-bg:#dcfce7;
  --amber:#d97706;
  --amber-bg:#fef3c7;
  --red:#dc2626;
  --red-bg:#fee2e2;
  --blue-bg:#dbeafe;
  --radius:18px;
  --radius-lg:24px;
  --radius-xl:30px;
  --shadow-xs:0 1px 2px rgba(15,23,42,.06);
  --shadow:0 18px 45px rgba(15,23,42,.09),0 2px 8px rgba(15,23,42,.04);
  --shadow-lg:0 30px 80px rgba(15,23,42,.16);
  --ring:0 0 0 4px rgba(37,99,235,.14);
  --sb-w:280px;
  --font:"Be Vietnam Pro",ui-sans-serif,system-ui,"Segoe UI",Arial,sans-serif;
}
*{box-sizing:border-box}
html{height:100%;scroll-behavior:smooth}
body{
  margin:0;min-height:100%;font-family:var(--font);font-size:14px;line-height:1.5;color:var(--text);
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
  background:
    radial-gradient(circle at 12% 8%,rgba(59,130,246,.18),transparent 28%),
    radial-gradient(circle at 88% 0%,rgba(6,182,212,.15),transparent 26%),
    linear-gradient(135deg,#f8fbff 0%,#eef4ff 45%,#f7fbff 100%);
}
body::before{
  content:"";position:fixed;inset:0;pointer-events:none;z-index:-1;
  background-image:linear-gradient(rgba(15,23,42,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(15,23,42,.035) 1px,transparent 1px);
  background-size:38px 38px;mask-image:linear-gradient(to bottom,rgba(0,0,0,.65),transparent 72%);
}
.app{display:grid;grid-template-columns:var(--sb-w) minmax(0,1fr);min-height:100vh}
:focus-visible{outline:0;box-shadow:var(--ring);border-radius:12px}
button,input,select{font:inherit}

/* ================= SIDEBAR ================= */
.sidebar{
  position:sticky;top:0;height:100vh;overflow:auto;z-index:40;padding:22px 16px;color:#d7e5ff;
  background:
    radial-gradient(circle at 20% 0%,rgba(96,165,250,.24),transparent 34%),
    linear-gradient(180deg,#06162c 0%,#0a2548 54%,#06162c 100%);
  box-shadow:inset -1px 0 0 rgba(255,255,255,.08),18px 0 50px rgba(15,23,42,.08);
}
.sidebar::-webkit-scrollbar{width:8px}.sidebar::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:999px}
.logo{
  display:flex;align-items:center;gap:13px;padding:8px 9px 22px;margin-bottom:14px;
  border-bottom:1px solid rgba(255,255,255,.12);
}
.logo .mk{
  width:46px;height:46px;border-radius:16px;display:grid;place-items:center;color:#fff;font-size:21px;font-weight:900;letter-spacing:-.03em;
  background:linear-gradient(135deg,#60a5fa 0%,#2563eb 45%,#06b6d4 100%);
  box-shadow:0 18px 38px rgba(37,99,235,.35),inset 0 1px 0 rgba(255,255,255,.35);
}
.logo b{display:inline-block;color:#fff;font-size:19px;font-weight:900;letter-spacing:.02em;line-height:1}
.logo span{display:inline-block;margin-top:5px;color:#9fc2ff;font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
.nav{display:flex;flex-direction:column;gap:6px;padding:4px}
.nav a{
  position:relative;display:flex;align-items:center;gap:12px;min-height:46px;padding:11px 13px;border-radius:15px;
  color:#c9dcfb;text-decoration:none;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s ease;
}
.nav a .ic{width:25px;height:25px;display:grid;place-items:center;border-radius:10px;background:rgba(255,255,255,.08);font-size:14px;transition:all .2s ease}
.nav a:hover{color:#fff;background:rgba(255,255,255,.08);transform:translateX(2px)}
.nav a:hover .ic{background:rgba(255,255,255,.16)}
.nav a.active{
  color:#fff;background:linear-gradient(135deg,rgba(37,99,235,.98),rgba(6,182,212,.82));
  box-shadow:0 14px 34px rgba(37,99,235,.32),inset 0 1px 0 rgba(255,255,255,.24);
}
.nav a.active::after{content:"";position:absolute;right:12px;width:7px;height:7px;border-radius:999px;background:#fff;box-shadow:0 0 0 5px rgba(255,255,255,.16)}
.nav a.active .ic{background:rgba(255,255,255,.18)}
.nav .sep{height:1px;margin:13px 8px 6px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.16),transparent)}

/* ================= MAIN / TOPBAR ================= */
.main{min-width:0;display:flex;flex-direction:column}
.topbar{
  position:sticky;top:0;z-index:30;min-height:76px;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;
  color:#fff;background:rgba(7,26,51,.82);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  border-bottom:1px solid rgba(255,255,255,.12);box-shadow:0 12px 40px rgba(7,26,51,.16);
}
.topbar::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(110deg,rgba(37,99,235,.28),transparent 38%,rgba(6,182,212,.18));pointer-events:none}
.topbar h1{margin:0;display:flex;align-items:center;gap:12px;font-size:19px;line-height:1.2;font-weight:900;letter-spacing:-.02em}
.topbar h1 .num{
  width:36px;height:36px;border-radius:13px;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;
  background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.22);box-shadow:inset 0 1px 0 rgba(255,255,255,.22);
}
.menu-btn{display:none;width:40px;height:40px;border:1px solid rgba(255,255,255,.22);border-radius:14px;background:rgba(255,255,255,.12);color:#fff;font-size:20px;cursor:pointer}
.top-right{display:flex;align-items:center;gap:12px;min-width:0}
.pill{display:inline-flex;align-items:center;min-height:34px;padding:7px 13px;border-radius:999px;color:#eaf2ff;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);font-size:11.5px;font-weight:800;white-space:nowrap}
.bell{position:relative;width:38px;height:38px;border-radius:14px;display:grid;place-items:center;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);font-size:18px}
.bell b{position:absolute;top:-7px;right:-8px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;display:grid;place-items:center;background:#ef4444;color:#fff;border:2px solid #08204a;font-size:10px;font-weight:900}
.who{display:flex;align-items:center;gap:10px;min-width:0}.who .av{width:38px;height:38px;border-radius:14px;background:linear-gradient(135deg,#fff,#dbeafe);color:#0f2f5f;display:grid;place-items:center;font-weight:900;font-size:13px}.who b{font-size:12.5px}.who small{display:block;color:#bdd7ff;font-size:10.5px;font-weight:600;white-space:nowrap}
.btn.ghost{background:rgba(255,255,255,.12)!important;color:#fff;border:1px solid rgba(255,255,255,.25);box-shadow:none}.btn.ghost:hover{background:rgba(255,255,255,.2)!important}
.content{width:100%;max-width:1720px;padding:24px 26px 54px;margin:0 auto}
.page{display:none;animation:pageIn .26s cubic-bezier(.2,.8,.2,1)}.page.active{display:block}
@keyframes pageIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

/* ================= FILTERS / BUTTONS ================= */
.filters{
  position:relative;display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) auto;gap:13px;align-items:end;
  margin-bottom:18px;padding:16px;border:1px solid rgba(219,229,242,.9);border-radius:var(--radius-lg);
  background:rgba(255,255,255,.82);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:var(--shadow-xs);
}
.filters::before{content:"";position:absolute;left:18px;right:18px;top:0;height:1px;background:linear-gradient(90deg,transparent,rgba(37,99,235,.22),transparent)}
.filters label{display:block;margin:0 0 7px;color:#64748b;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
.filters select,.filters input{
  width:100%;height:43px;border:1px solid #cfdbea;border-radius:14px;padding:0 12px;color:#0f172a;background:#fff;font-size:13px;font-weight:650;outline:none;transition:border-color .16s,box-shadow .16s,transform .16s;
}
.filters select:hover,.filters input:hover{border-color:#adc0da}.filters select:focus,.filters input:focus{border-color:#2563eb;box-shadow:var(--ring)}
.btn{
  height:43px;border:0;border-radius:14px;padding:0 18px;display:inline-flex;align-items:center;justify-content:center;gap:8px;
  color:#fff;background:linear-gradient(135deg,#2563eb,#1d4ed8);font-weight:850;font-size:13px;cursor:pointer;white-space:nowrap;
  box-shadow:0 12px 26px rgba(37,99,235,.23);transition:transform .16s ease,box-shadow .16s ease,filter .16s ease;
}
.btn:hover{filter:brightness(1.04);box-shadow:0 16px 34px rgba(37,99,235,.30);transform:translateY(-1px)}.btn:active{transform:translateY(0);box-shadow:0 8px 20px rgba(37,99,235,.22)}
.btn[style*="#64748b"]{background:linear-gradient(135deg,#64748b,#475569)!important}.btn.excel{background:linear-gradient(135deg,#16a34a,#15803d)!important;box-shadow:0 12px 26px rgba(21,128,61,.22)}.btn.pdf{background:linear-gradient(135deg,#ef4444,#dc2626)!important;box-shadow:0 12px 26px rgba(220,38,38,.22)}.btn.word{background:linear-gradient(135deg,#2563eb,#1d4ed8)!important}

/* ================= LAYOUT / CARDS ================= */
.grid{display:grid;gap:18px}.g3{grid-template-columns:repeat(3,minmax(0,1fr))}.g2{grid-template-columns:repeat(2,minmax(0,1fr))}
.card{
  position:relative;overflow:hidden;background:rgba(255,255,255,.92);border:1px solid rgba(219,229,242,.95);border-radius:var(--radius-lg);padding:19px;box-shadow:var(--shadow-xs);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease;
}
.card::before{content:"";position:absolute;inset:0 0 auto 0;height:1px;background:linear-gradient(90deg,transparent,rgba(37,99,235,.24),transparent)}
.card:hover{transform:translateY(-2px);box-shadow:var(--shadow);border-color:#c8d7ea}
.card h3{margin:0 0 16px;padding:0;display:flex;align-items:center;gap:10px;color:#0b2545;font-size:12px;font-weight:950;text-transform:uppercase;letter-spacing:.08em;border:0}
.card h3::before{content:"";width:9px;height:24px;border-radius:999px;background:linear-gradient(180deg,#2563eb,#06b6d4);box-shadow:0 0 0 5px rgba(37,99,235,.08)}
.card h3 .tag{margin-left:auto;border:1px solid rgba(37,99,235,.14);border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:900;padding:4px 10px}

/* ================= KPI ================= */
.kpi-main{display:flex;align-items:flex-end;gap:11px;padding:5px 0 2px}.kpi-main .n{font-size:42px;font-weight:950;color:#0f172a;line-height:.95;letter-spacing:-.055em}.kpi-main .l{padding-bottom:4px;color:#64748b;font-size:12px;font-weight:750}.kpi-main .l b{color:#0f172a}
.kpi-sub{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;margin-top:15px}.kpi-box{position:relative;padding:13px 13px 12px;border:1px solid #e5edf6;border-radius:17px;background:linear-gradient(180deg,#fff,#f8fbff);box-shadow:inset 0 1px 0 rgba(255,255,255,.9)}.kpi-box::after{content:"";position:absolute;right:12px;top:12px;width:8px;height:8px;border-radius:999px;background:#cbd5e1}.kpi-box .v{font-size:25px;font-weight:950;line-height:1;letter-spacing:-.04em}.kpi-box .k{margin-top:6px;color:#64748b;font-size:11px;font-weight:750}.kpi-box .p{margin-top:2px;font-size:11px;font-weight:850}
.kpi-strip{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:15px;margin-bottom:18px}.kpi-c{position:relative;overflow:hidden;min-height:112px;padding:18px 17px 15px;border:1px solid rgba(219,229,242,.95);border-radius:var(--radius-lg);background:rgba(255,255,255,.92);box-shadow:var(--shadow-xs);transition:transform .18s ease,box-shadow .18s ease}.kpi-c:hover{transform:translateY(-2px);box-shadow:var(--shadow)}.kpi-c::before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:#2563eb}.kpi-c::after{content:"";position:absolute;right:-30px;top:-35px;width:88px;height:88px;border-radius:999px;background:rgba(37,99,235,.09)}.kpi-c .v{font-size:31px;font-weight:950;line-height:1;letter-spacing:-.055em}.kpi-c .k{margin-top:9px;color:#64748b;font-size:11.5px;font-weight:850}.kpi-c .p{font-size:11px;font-weight:850;margin-top:4px;color:#64748b}.kpi-c.k-green::before{background:var(--green)}.kpi-c.k-green::after{background:rgba(22,163,74,.11)}.kpi-c.k-amber::before{background:var(--amber)}.kpi-c.k-amber::after{background:rgba(217,119,6,.12)}.kpi-c.k-red::before{background:var(--red)}.kpi-c.k-red::after{background:rgba(220,38,38,.10)}.kpi-c.k-blue::before{background:var(--primary)}.kpi-c.k-cyan::before{background:var(--cyan)}.kpi-c.k-ink::before{background:#334155}
.c-green{color:var(--green)}.c-amber{color:var(--amber)}.c-red{color:var(--red)}.c-blue{color:var(--primary)}.c-ink{color:var(--ink)}

/* ================= ALERTS / GAUGES ================= */
.alert-head{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-bottom:15px}.alert-box{position:relative;overflow:hidden;border-radius:20px;padding:18px;color:#fff;box-shadow:0 18px 42px rgba(15,23,42,.12)}.alert-box::after{content:"";position:absolute;right:-28px;top:-32px;width:100px;height:100px;border-radius:999px;background:rgba(255,255,255,.18)}.alert-box.r{background:linear-gradient(135deg,#fb7185,#dc2626)}.alert-box.a{background:linear-gradient(135deg,#fbbf24,#d97706)}.alert-box .n{font-size:38px;font-weight:950;line-height:.95;letter-spacing:-.055em}.alert-box .l{margin-top:7px;font-size:11.5px;font-weight:950;letter-spacing:.08em;opacity:.96}.alert-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 18px}.alert-row{display:flex;justify-content:space-between;gap:14px;padding:9px 0;border-bottom:1px dashed #d8e3f1;font-size:12.5px;font-weight:650}.alert-row span:last-child{white-space:nowrap;color:#475569}.alert-row b{color:#dc2626;font-weight:950}
.gauges{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:13px}.gauge{text-align:center;padding:6px 2px}.gauge .wrap{position:relative;width:86px;height:86px;margin:0 auto}.gauge .val{position:absolute;inset:0;display:grid;place-items:center;color:#0f172a;font-size:15px;font-weight:950}.gauge .nm{margin-top:8px;color:#334155;font-size:11.5px;font-weight:850;line-height:1.35}

/* ================= CHART / TABLE ================= */
.placeholder{text-align:center;padding:58px 22px;color:#64748b}.placeholder .big{font-size:50px;filter:drop-shadow(0 10px 20px rgba(15,23,42,.1))}.placeholder h2{margin:12px 0 6px;color:#0b2545;font-size:20px;font-weight:950}.chart-box{position:relative;height:250px}.chart-box.sm{height:210px}
.cb-scroll{max-height:392px;overflow:auto;border:1px solid #dbe5f2;border-radius:18px;background:#fff}.cb-scroll::-webkit-scrollbar{height:9px;width:9px}.cb-scroll::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:999px}.cb-table,.tt-table,.diag-table{width:100%;border-collapse:separate;border-spacing:0;font-size:12.5px}.cb-table th,.cb-table td,.tt-table th,.tt-table td{padding:11px 12px;text-align:left;border-bottom:1px solid #edf2f7}.cb-table th,.tt-table th{position:sticky;top:0;z-index:2;color:#0b2545;background:#f4f8ff;font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.04em}.cb-table tbody tr,.tt-table tbody tr{transition:background .14s ease}.cb-table tbody tr:hover,.tt-table tbody tr:hover{background:#f8fbff}.tt-table td.num{text-align:center;font-weight:900}.days{display:inline-flex;align-items:center;justify-content:center;min-width:54px;padding:4px 9px;border-radius:999px;font-size:11.5px;font-weight:950}.days.qua{background:var(--red-bg);color:#b91c1c}.days.sap{background:var(--amber-bg);color:#92400e}
.tabs{display:inline-flex;gap:5px;margin-bottom:16px;padding:5px;border-radius:16px;background:#e9f0fb;border:1px solid #dbe5f2}.tabs button{border:0;background:transparent;padding:10px 18px;border-radius:12px;color:#64748b;font-size:13px;font-weight:900;cursor:pointer}.tabs button.on{background:#fff;color:#1d4ed8;box-shadow:0 8px 20px rgba(15,23,42,.08)}.bar-tt{display:inline-block;width:160px;min-width:120px;height:18px;vertical-align:middle;overflow:hidden;border-radius:999px;background:#eaf0f7}.bar-tt span{display:block;height:100%;border-radius:999px}.legend{display:flex;flex-wrap:wrap;gap:18px;margin-top:14px;color:#475569;font-size:12.5px;font-weight:800}.legend i{display:inline-block;width:12px;height:12px;margin-right:7px;border-radius:4px;vertical-align:-1px}

/* ================= REPORT / DIAG ================= */
.rp-grid{display:grid;grid-template-columns:330px minmax(0,1fr);gap:18px}.rp-list{display:flex;flex-direction:column;gap:6px}.rp-group{margin:14px 4px 6px;color:#64748b;font-size:10.5px;font-weight:950;text-transform:uppercase;letter-spacing:.08em}.rp-item{position:relative;padding:13px 14px;border:1px solid #dbe5f2;border-radius:15px;background:#fff;color:#334155;font-size:13px;font-weight:800;cursor:pointer;transition:all .16s ease}.rp-item:hover{border-color:#9eb8df;background:#f5f9ff;color:#1d4ed8;transform:translateX(2px)}.rp-item.on{color:#fff;border-color:transparent;background:linear-gradient(135deg,#2563eb,#06b6d4);box-shadow:0 14px 30px rgba(37,99,235,.25)}.rp-tools{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 14px}.diag-table{border:1px solid #dbe5f2;border-radius:18px;overflow:hidden;background:#fff}.diag-table th,.diag-table td{border-right:1px solid #edf2f7;border-bottom:1px solid #edf2f7;padding:11px 12px}.diag-table th{background:#eff6ff;color:#0b2545;font-weight:950}.ok-pill,.err-pill{display:inline-flex;align-items:center;min-height:24px;border-radius:999px;padding:2px 10px;font-size:11.5px;font-weight:950}.ok-pill{background:var(--green-bg);color:#15803d}.err-pill{background:var(--red-bg);color:#b91c1c}.msg{margin:12px 0;text-align:center;font-weight:850}.msg.err{color:#dc2626}.msg.ok{color:#15803d}.note{margin-top:9px;color:#64748b;font-size:12.5px;line-height:1.6;font-weight:600}.loading{padding:48px;text-align:center;color:#64748b;font-weight:850}.loading::before{content:"";display:block;width:34px;height:34px;margin:0 auto 13px;border-radius:999px;border:3px solid #dbeafe;border-top-color:#2563eb;animation:spin .82s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}

/* ================= PRINT / RESPONSIVE ================= */
@media print{body{background:#fff}.sidebar,.topbar,.filters,.rp-tools,.tabs{display:none!important}.app{display:block}.content{padding:0;max-width:none}.card{box-shadow:none;border:1px solid #ddd;break-inside:avoid}.page{display:block!important}.page:not(.active){display:none!important}.cb-scroll{max-height:none;overflow:visible}}
@media(max-width:1400px){.kpi-strip{grid-template-columns:repeat(3,minmax(0,1fr))}.gauges{grid-template-columns:repeat(3,minmax(0,1fr))}.g3{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:1100px){:root{--sb-w:82px}.logo{justify-content:center}.logo b,.logo span,.nav a span:not(.ic){display:none}.nav a{justify-content:center}.nav a.active::after{display:none}.content{padding:20px}.topbar{padding:13px 18px}.who small{display:none}.rp-grid{grid-template-columns:1fr}}
@media(max-width:900px){.app{grid-template-columns:1fr}.menu-btn{display:grid;place-items:center}.sidebar{position:fixed;left:-310px;top:0;width:280px;transition:left .22s ease}.sidebar.open{left:0}.sidebar .logo{justify-content:flex-start}.sidebar .logo b,.sidebar .logo span,.sidebar .nav a span:not(.ic){display:inline-block}.sidebar .nav a{justify-content:flex-start}.topbar{min-height:68px}.topbar h1{font-size:16px}.topbar h1 .num{width:32px;height:32px}.top-right{gap:8px}.pill,.who{display:none}.grid.g3,.grid.g2{grid-template-columns:1fr}.filters,.filters[style]{grid-template-columns:1fr 1fr!important}.kpi-sub,.kpi-strip{grid-template-columns:1fr 1fr}.alert-list{grid-template-columns:1fr}.content{padding:16px}.card{border-radius:20px;padding:16px}.chart-box{height:260px}}
@media(max-width:560px){body{font-size:13px}.filters,.filters[style],.kpi-sub,.kpi-strip{grid-template-columns:1fr!important}.alert-head{grid-template-columns:1fr}.gauges{grid-template-columns:repeat(2,minmax(0,1fr))}.topbar{gap:10px}.btn{width:100%}.top-right .btn.ghost{display:none}.card h3{font-size:11px}.kpi-main .n{font-size:36px}.kpi-c .v{font-size:28px}.cb-table,.tt-table{font-size:12px}.rp-tools .btn{width:auto}}
</style>
</head>
<body>
<div class="app">
  <!-- SIDEBAR -->
  <aside class="sidebar">
    <div class="logo"><div class="mk">Q</div><div><b>QLVT</b><br><span>TAXI 123</span></div></div>
    <nav class="nav" id="nav">
      <a data-page="tongquan" class="active" onclick="go('tongquan')"><span class="ic">📊</span><span>Tổng quan</span></a>
      <a data-page="phuongtien" onclick="go('phuongtien')"><span class="ic">🚗</span><span>Phương tiện</span></a>
      <a data-page="nhansu" onclick="go('nhansu')"><span class="ic">👥</span><span>Nhân sự</span></a>
      <a data-page="tuanthu" onclick="go('tuanthu')"><span class="ic">⚖️</span><span>Tuân thủ pháp lý</span></a>
      <a data-page="biendong" onclick="go('biendong')"><span class="ic">📈</span><span>Biến động</span></a>
      <a data-page="baocao" onclick="go('baocao')"><span class="ic">📄</span><span>Báo cáo</span></a>
      <div class="sep"></div>
      <a data-page="chandoan" onclick="go('chandoan')"><span class="ic">🩺</span><span>Chẩn đoán dữ liệu</span></a>
    </nav>
  </aside>

  <!-- MAIN -->
  <div class="main">
    <header class="topbar">
      <button class="menu-btn" onclick="toggleSidebar()" aria-label="Mở menu">☰</button>
      <h1><span class="num" id="hNum">1</span><span id="hTitle">Tổng quan quản trị</span></h1>
      <div class="top-right">
        <span class="pill" id="hCapNhat">—</span>
        <button class="btn ghost" onclick="lamMoi()">↻ Cập nhật</button>
        <div class="bell">🔔<b id="hCanhBao">0</b></div>
        <div class="who"><div class="av">QT</div><div><b style="color:#fff">Quản trị</b><small>Sở Xây dựng Bắc Ninh</small></div></div>
      </div>
    </header>

    <div class="content">

      <!-- ===== MÀN 1: TỔNG QUAN ===== -->
      <section id="page_tongquan" class="page active">
        <div class="filters" style="grid-template-columns:1fr 1fr 1fr auto auto">
          <div><label>Đơn vị</label><select id="f1_donVi"></select></div>
          <div><label>Đội xe</label><select id="f1_doiXe"></select></div>
          <div><label>Ngày chốt số liệu (trống = hôm nay)</label><input type="date" id="f1_chot"></div>
          <button class="btn" onclick="apDung('tongquan')">Áp dụng</button>
          <button class="btn" style="background:#64748b" onclick="xoaLoc('tongquan')">Xóa lọc</button>
        </div>
        <div id="tqLoading" class="loading">Đang tải số liệu tổng quan…</div>
        <div id="tqBody" style="display:none">
          <div class="grid g3" style="margin-bottom:14px">
            <!-- PHƯƠNG TIỆN -->
            <div class="card">
              <h3>🚗 Phương tiện <span class="tag" id="pt_tong">0</span></h3>
              <div class="kpi-main"><div class="n c-ink" id="pt_dhd">0</div><div class="l">đang hoạt động · <b id="pt_dhd_p">0%</b></div></div>
              <div class="kpi-sub">
                <div class="kpi-box"><div class="v c-amber" id="pt_xh">0</div><div class="k">Xuất hàng</div><div class="p c-amber" id="pt_xh_p">0%</div></div>
                <div class="kpi-box"><div class="v c-red" id="pt_ng">0</div><div class="k">Ngừng hoạt động</div><div class="p c-red" id="pt_ng_p">0%</div></div>
                <div class="kpi-box"><div class="v c-blue" id="pt_cpc">0</div><div class="k">Chưa phân công</div><div class="p c-blue" id="pt_cpc_p">0%</div></div>
                <div class="kpi-box"><div class="v c-ink" id="pt_nlx">0</div><div class="k">Có nhiều lái xe</div><div class="p c-ink" id="pt_nlx_p">0%</div></div>
              </div>
            </div>
            <!-- NHÂN SỰ -->
            <div class="card">
              <h3>👥 Nhân sự <span class="tag" id="ns_tong">0</span></h3>
              <div class="kpi-main"><div class="n c-ink" id="ns_dl">0</div><div class="l">đang làm việc · <b id="ns_dl_p">0%</b></div></div>
              <div class="kpi-sub">
                <div class="kpi-box"><div class="v c-amber" id="ns_tn">0</div><div class="k">Tạm nghỉ</div><div class="p c-amber" id="ns_tn_p">0%</div></div>
                <div class="kpi-box"><div class="v c-red" id="ns_nv">0</div><div class="k">Nghỉ việc</div><div class="p c-red" id="ns_nv_p">0%</div></div>
                <div class="kpi-box"><div class="v c-blue" id="ns_cx">0</div><div class="k">Chưa có xe</div><div class="p c-blue" id="ns_cx_p">0%</div></div>
                <div class="kpi-box"><div class="v c-ink" id="ns_bh">0</div><div class="k">Chưa tham gia BHXH</div><div class="p c-ink" id="ns_bh_p">0%</div></div>
              </div>
            </div>
            <!-- HỒ SƠ PHÁP LÝ -->
            <div class="card">
              <h3>📁 Hồ sơ pháp lý <span class="tag" id="hs_tong">0</span></h3>
              <div class="kpi-main"><div class="n c-green" id="hs_con">0</div><div class="l">còn hiệu lực · <b id="hs_con_p">0%</b></div></div>
              <div class="kpi-sub">
                <div class="kpi-box"><div class="v c-amber" id="hs_sap">0</div><div class="k">Sắp hết hạn (≤30 ngày)</div><div class="p c-amber" id="hs_sap_p">0%</div></div>
                <div class="kpi-box"><div class="v c-red" id="hs_qua">0</div><div class="k">Quá hạn</div><div class="p c-red" id="hs_qua_p">0%</div></div>
                <div class="kpi-box" style="grid-column:1/-1"><div class="v c-blue" id="hs_thieu">0</div><div class="k">Đối tượng đang hoạt động còn thiếu hồ sơ</div></div>
              </div>
            </div>
          </div>

          <div class="grid g2" style="margin-bottom:14px">
            <!-- CẢNH BÁO -->
            <div class="card">
              <h3>⚠️ Cảnh báo hết hạn</h3>
              <div class="alert-head">
                <div class="alert-box r"><div class="n" id="cb_qua">0</div><div class="l">QUÁ HẠN</div></div>
                <div class="alert-box a"><div class="n" id="cb_sap">0</div><div class="l">SẮP HẾT HẠN (≤30 NGÀY)</div></div>
              </div>
              <div class="alert-list" id="cb_list"></div>
            </div>
            <!-- TỶ LỆ TUÂN THỦ -->
            <div class="card">
              <h3>✅ Tỷ lệ tuân thủ theo hạng mục</h3>
              <div class="gauges" id="tt_gauges"></div>
              <div class="note">Tỷ lệ = hồ sơ còn hiệu lực / số đối tượng đang hoạt động cần có hồ sơ.</div>
            </div>
          </div>

          <div class="card">
            <h3>📈 Biến động tháng này <span class="tag" id="bd_ky">—</span></h3>
            <div class="kpi-strip" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px">
              <div class="kpi-c k-green"><div class="v c-green" id="bd_xenhap">0</div><div class="k">Xe vào mới</div></div>
              <div class="kpi-c k-red"><div class="v c-red" id="bd_xexuat">0</div><div class="k">Xe xuất hàng</div></div>
              <div class="kpi-c k-green"><div class="v c-green" id="bd_nstuyen">0</div><div class="k">Nhân sự tuyển mới</div></div>
              <div class="kpi-c k-red"><div class="v c-red" id="bd_nsnghi">0</div><div class="k">Nhân sự nghỉ việc</div></div>
            </div>
            <div class="chart-box" style="height:240px"><canvas id="bd_line"></canvas></div>
            <div class="note">Đường thể hiện số luỹ kế cuối kỳ 6 tháng gần nhất (xe đang vận hành & nhân sự đang làm việc).</div>
          </div>
        </div>
        <div id="tqErr" class="msg err" style="display:none"></div>
      </section>

      <!-- ===== Các màn Giai đoạn sau ===== -->
      <section id="page_phuongtien" class="page">
        <div class="filters" style="grid-template-columns:repeat(3,1fr) auto auto">
          <div><label>Đơn vị</label><select id="f2_donVi"></select></div>
          <div><label>Đội xe</label><select id="f2_doiXe"></select></div>
          <div><label>Trạng thái</label><select id="f2_trangThai"></select></div>
          <button class="btn" onclick="apDung('phuongtien')">Áp dụng</button>
          <button class="btn" style="background:#64748b" onclick="xoaLoc('phuongtien')">Xóa lọc</button>
        </div>
        <div id="ptLoading" class="loading">Đang tải dữ liệu phương tiện…</div>
        <div id="ptBody" style="display:none">
          <div class="kpi-strip">
            <div class="kpi-c k-ink"><div class="v c-ink" id="m2_tong">0</div><div class="k">Tổng số xe</div></div>
            <div class="kpi-c k-green"><div class="v c-green" id="m2_dhd">0</div><div class="k">Đang hoạt động</div><div class="p c-green" id="m2_dhd_p">0%</div></div>
            <div class="kpi-c k-amber"><div class="v c-amber" id="m2_xh">0</div><div class="k">Xuất hàng</div><div class="p c-amber" id="m2_xh_p">0%</div></div>
            <div class="kpi-c k-red"><div class="v c-red" id="m2_ng">0</div><div class="k">Ngừng hoạt động</div><div class="p c-red" id="m2_ng_p">0%</div></div>
            <div class="kpi-c k-blue"><div class="v c-blue" id="m2_cpc">0</div><div class="k">Chưa phân công</div><div class="p c-blue" id="m2_cpc_p">0%</div></div>
            <div class="kpi-c k-ink"><div class="v c-ink" id="m2_nlx">0</div><div class="k">Có nhiều lái xe</div><div class="p c-ink" id="m2_nlx_p">0%</div></div>
          </div>
          <div class="grid g3" style="margin-bottom:14px">
            <div class="card"><h3>🏷️ Cơ cấu theo nhãn hiệu</h3><div class="chart-box"><canvas id="m2_pie"></canvas></div></div>
            <div class="card"><h3>📅 Xe theo năm sản xuất</h3><div class="chart-box"><canvas id="m2_nam"></canvas></div></div>
            <div class="card"><h3>🟢 Tình trạng hoạt động</h3><div class="chart-box"><canvas id="m2_tt"></canvas></div></div>
          </div>
          <div class="grid g2">
            <div class="card"><h3>⚠️ Danh sách cảnh báo phương tiện <span class="tag" id="m2_cb_n">0</span></h3>
              <div class="cb-scroll"><table class="cb-table"><thead><tr><th>Biển số</th><th>Nhãn hiệu</th><th>Đội xe</th><th>Trạng thái</th><th>Hạng mục</th><th>Ngày hết hạn</th><th>Còn lại</th></tr></thead><tbody id="m2_cb"></tbody></table></div>
            </div>
            <div class="card"><h3>🚚 Phân bố theo đội xe</h3><div class="chart-box" style="height:360px"><canvas id="m2_doi"></canvas></div></div>
          </div>
          <div class="card" style="margin-top:14px"><h3>🏢 Thống kê theo đơn vị</h3>
            <div style="overflow:auto"><table class="tt-table"><thead><tr><th>Đơn vị</th><th class="num">Tổng số xe</th><th class="num">Đang hoạt động</th><th class="num">Xuất hàng</th><th class="num">Ngừng HĐ</th><th class="num">Chưa phân công</th></tr></thead><tbody id="m2_tkdv"></tbody></table></div>
          </div>
          <div class="grid g2" style="margin-top:14px">
            <div class="card"><h3>🚀 Top 10 xe nhiều chuyến nhất</h3><div class="chart-box" style="height:320px"><canvas id="m2_topchuyen"></canvas></div></div>
            <div class="card"><h3>🛣️ Top 10 xe chạy nhiều km nhất</h3><div class="chart-box" style="height:320px"><canvas id="m2_topkm"></canvas></div></div>
          </div>
        </div>
        <div id="ptErr" class="msg err" style="display:none"></div>
      </section>
      <section id="page_nhansu" class="page">
        <div class="filters" style="grid-template-columns:repeat(4,1fr) auto auto">
          <div><label>Đơn vị</label><select id="f3_donVi"></select></div>
          <div><label>Đội xe</label><select id="f3_doiXe"></select></div>
          <div><label>Giới tính</label><select id="f3_gioiTinh"></select></div>
          <div><label>Trạng thái</label><select id="f3_trangThai"></select></div>
          <button class="btn" onclick="apDung('nhansu')">Áp dụng</button>
          <button class="btn" style="background:#64748b" onclick="xoaLoc('nhansu')">Xóa lọc</button>
        </div>
        <div id="nsLoading" class="loading">Đang tải dữ liệu nhân sự…</div>
        <div id="nsBody" style="display:none">
          <div class="kpi-strip">
            <div class="kpi-c k-ink"><div class="v c-ink" id="m3_tong">0</div><div class="k">Tổng nhân sự</div></div>
            <div class="kpi-c k-green"><div class="v c-green" id="m3_dl">0</div><div class="k">Đang làm việc</div><div class="p c-green" id="m3_dl_p">0%</div></div>
            <div class="kpi-c k-amber"><div class="v c-amber" id="m3_tn">0</div><div class="k">Tạm nghỉ</div><div class="p c-amber" id="m3_tn_p">0%</div></div>
            <div class="kpi-c k-red"><div class="v c-red" id="m3_nv">0</div><div class="k">Nghỉ việc</div><div class="p c-red" id="m3_nv_p">0%</div></div>
            <div class="kpi-c k-blue"><div class="v c-blue" id="m3_cx">0</div><div class="k">Chưa có xe</div><div class="p c-blue" id="m3_cx_p">0%</div></div>
            <div class="kpi-c k-ink"><div class="v c-ink" id="m3_bh">0</div><div class="k">Chưa tham gia BHXH</div><div class="p c-ink" id="m3_bh_p">0%</div></div>
          </div>
          <div class="grid g3" style="margin-bottom:14px">
            <div class="card"><h3>⚧ Cơ cấu theo giới tính</h3><div class="chart-box"><canvas id="m3_gt"></canvas></div></div>
            <div class="card"><h3>🎂 Cơ cấu theo độ tuổi</h3><div class="chart-box"><canvas id="m3_tuoi"></canvas></div><div class="note">Tuổi bình quân: <b id="m3_tuoibq">—</b></div></div>
            <div class="card"><h3>📇 Cơ cấu theo loại nhân sự</h3><div class="chart-box"><canvas id="m3_loai"></canvas></div><div class="note">Dữ liệu nguồn chưa có trường “trình độ học vấn” nên thay bằng loại nhân sự.</div></div>
          </div>
          <div class="grid g2" style="margin-bottom:14px">
            <div class="card"><h3>📈 Thâm niên làm việc</h3><div class="chart-box" style="height:240px"><canvas id="m3_thamnien"></canvas></div></div>
            <div class="card"><h3>👥 Nhân sự theo đội xe</h3><div class="chart-box" style="height:240px"><canvas id="m3_doi2"></canvas></div></div>
          </div>
          <div class="card">
            <h3>⚠️ Danh sách nhân sự cảnh báo <span class="tag" id="m3_cb_n">0</span></h3>
            <div class="cb-scroll"><table class="cb-table"><thead><tr><th>Họ và tên</th><th>Đội xe</th><th>Chức danh</th><th>Hạng mục</th><th>Ngày hết hạn</th><th>Còn lại</th></tr></thead><tbody id="m3_cb"></tbody></table></div>
          </div>
        </div>
        <div id="nsErr" class="msg err" style="display:none"></div>
      </section>
      <section id="page_tuanthu" class="page">
        <div id="ttLoading" class="loading">Đang tải dữ liệu tuân thủ…</div>
        <div id="ttBody" style="display:none">
          <div class="tabs">
            <button class="on" id="tab_all" onclick="ttTab('all')">Tất cả</button>
            <button id="tab_pt" onclick="ttTab('pt')">Phương tiện</button>
            <button id="tab_ns" onclick="ttTab('ns')">Nhân sự</button>
          </div>
          <div class="grid g2" id="ttCards">
            <div class="card" id="ttCardPT"><h3>🚗 Tuân thủ pháp lý phương tiện</h3>
              <div style="overflow:auto"><table class="tt-table"><thead><tr><th>Hạng mục</th><th class="num">Đủ điều kiện</th><th class="num">Sắp hết hạn</th><th class="num">Quá hạn</th><th>Tỷ lệ tuân thủ</th></tr></thead><tbody id="ttPT"></tbody></table></div>
            </div>
            <div class="card" id="ttCardNS"><h3>👥 Tuân thủ pháp lý nhân sự</h3>
              <div style="overflow:auto"><table class="tt-table"><thead><tr><th>Hạng mục</th><th class="num">Đủ điều kiện</th><th class="num">Sắp hết hạn</th><th class="num">Quá hạn</th><th>Tỷ lệ tuân thủ</th></tr></thead><tbody id="ttNS"></tbody></table></div>
            </div>
          </div>
          <div class="legend"><span><i style="background:#16a34a"></i>Đủ điều kiện</span><span><i style="background:#f59e0b"></i>Sắp hết hạn (≤30 ngày)</span><span><i style="background:#ef4444"></i>Quá hạn</span></div>
        </div>
        <div id="ttErr" class="msg err" style="display:none"></div>
      </section>
      <section id="page_biendong" class="page">
        <div id="bdLoading" class="loading">Đang tải dữ liệu biến động…</div>
        <div id="bdBody" style="display:none">
          <div class="note" id="bdNote" style="margin-bottom:12px"></div>
          <div class="grid g3" style="margin-bottom:14px">
            <div class="card"><h3>🚗 Biến động phương tiện</h3><div class="chart-box"><canvas id="bd_pt"></canvas></div></div>
            <div class="card"><h3>👥 Biến động nhân sự</h3><div class="chart-box"><canvas id="bd_ns"></canvas></div></div>
            <div class="card"><h3>📁 Biến động hồ sơ</h3><div class="chart-box"><canvas id="bd_hs"></canvas></div></div>
          </div>
          <div class="grid g3">
            <div class="card"><h3>Tổng hợp phương tiện</h3><div id="bd_t_pt"></div></div>
            <div class="card"><h3>Tổng hợp nhân sự</h3><div id="bd_t_ns"></div></div>
            <div class="card"><h3>Tổng hợp hồ sơ</h3><div id="bd_t_hs"></div></div>
          </div>
        </div>
        <div id="bdErr" class="msg err" style="display:none"></div>
      </section>
      <section id="page_baocao" class="page">
        <div class="rp-grid">
          <div class="card">
            <h3>📑 Nhóm báo cáo</h3>
            <div class="rp-list" id="rpList"><div class="loading">Đang tải…</div></div>
          </div>
          <div class="card">
            <div id="rpEmpty" class="placeholder"><div class="big">📄</div><h2>Chọn một báo cáo bên trái</h2><div class="note">Xem trước dữ liệu thật, rồi xuất Excel / PDF / Word.</div></div>
            <div id="rpView" style="display:none">
              <h3 id="rpTitle">Báo cáo</h3>
              <div class="filters" style="grid-template-columns:repeat(2,minmax(0,220px)) auto auto;margin-bottom:10px">
                <div><label>Từ ngày (mốc thời gian của báo cáo)</label><input type="date" id="bc_tu"></div>
                <div><label>Đến ngày</label><input type="date" id="bc_den"></div>
                <button class="btn" onclick="locBaoCao()">Lọc theo thời gian</button>
                <button class="btn" style="background:#64748b" onclick="xoaLocBaoCao()">Bỏ lọc</button>
              </div>
              <div class="rp-tools">
                <button class="btn excel" onclick="xuat('excel')">⬇ Xuất Excel (CSV)</button>
                <button class="btn pdf" onclick="xuat('pdf')">⬇ Xuất PDF</button>
                <button class="btn word" onclick="xuat('word')">⬇ Xuất Word</button>
                <span class="note" id="rpInfo"></span>
              </div>
              <div class="cb-scroll" style="max-height:520px"><table class="cb-table" id="rpTable"></table></div>
            </div>
            <div id="rpErr" class="msg err"></div>
          </div>
        </div>
      </section>

      <!-- ===== CHẨN ĐOÁN ===== -->
      <section id="page_chandoan" class="page">
        <div class="card">
          <h3>🩺 Chẩn đoán dữ liệu — đối chiếu sheet/cột với hợp đồng dữ liệu</h3>
          <button class="btn" onclick="chanDoan()">Chạy chẩn đoán</button>
          <div id="cdMsg" class="msg"></div>
          <div id="cdResult" style="margin-top:12px"></div>
          <div class="note">Nếu có dòng "LỖI", mở Config.gs sửa lại tên sheet/cột cho khớp Google Sheet rồi chạy lại.</div>
        </div>
      </section>

    </div>
  </div>
</div>
<script>
var $ = function(id){ return document.getElementById(id); };
var PAGE_TITLE = { tongquan:['1','Tổng quan quản trị'], phuongtien:['2','Quản lý phương tiện'], nhansu:['3','Quản lý nhân sự'], tuanthu:['4','Quản trị tuân thủ pháp lý'], biendong:['5','Phân tích biến động'], baocao:['6','Báo cáo quản trị'], chandoan:['🩺','Chẩn đoán dữ liệu'] };
var gaugeCharts = [];

var loaded = { tongquan:false, phuongtien:false, nhansu:false, tuanthu:false, biendong:false, baocao:false };
var charts = {};
var PALETTE = ['#2563eb','#06b6d4','#16a34a','#f59e0b','#ef4444','#7c3aed','#ec4899','#14b8a6','#64748b','#0f766e'];
if(window.Chart){
  Chart.defaults.font.family = '"Be Vietnam Pro", system-ui, -apple-system, Segoe UI, Arial, sans-serif';
  Chart.defaults.color = '#475569';
  Chart.defaults.borderColor = '#e5edf6';
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.pointStyle = 'circle';
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15,23,42,.92)';
  Chart.defaults.plugins.tooltip.padding = 12;
  Chart.defaults.plugins.tooltip.cornerRadius = 12;
}

function toggleSidebar(){ var s=document.querySelector('.sidebar'); if(s) s.classList.toggle('open'); }
function go(page){
  var sb=document.querySelector('.sidebar'); if(sb) sb.classList.remove('open');
  document.querySelectorAll('.nav a').forEach(function(a){ a.classList.toggle('active', a.getAttribute('data-page')===page); });
  document.querySelectorAll('.page').forEach(function(s){ s.classList.remove('active'); });
  var el = $('page_'+page); if(el) el.classList.add('active');
  var t = PAGE_TITLE[page] || ['','']; $('hNum').textContent = t[0]; $('hTitle').textContent = t[1];
  if(page==='phuongtien' && !loaded.phuongtien) taiPhuongTien();
  if(page==='nhansu' && !loaded.nhansu) taiNhanSu();
  if(page==='tuanthu' && !loaded.tuanthu) taiTuanThu();
  if(page==='biendong' && !loaded.biendong) taiBienDong();
  if(page==='baocao' && !loaded.baocao) taiDanhMucBaoCao();
}

function fmt(n){ return (n==null?0:n).toLocaleString('vi-VN'); }
function pctTxt(v){ return (v==null?0:v) + '%'; }

window.onload = function(){ taiDanhMucBoLoc(); taiTongQuan(); };

/* ===== BỘ LỌC ===== */
var BL_DM = null;
function taiDanhMucBoLoc(){
  google.script.run.withSuccessHandler(function(res){
    if(!res.ok) return; BL_DM = res.data; dungBoLoc();
  }).withFailureHandler(function(){}).getDanhMucBoLoc();
}
function opt(val, text, sel){ return '<option value="'+esc(val)+'"'+(sel?' selected':'')+'>'+esc(text)+'</option>'; }
function fillSelect(id, items, placeholder){
  var el=$(id); if(!el) return;
  var html=opt('', placeholder||'Tất cả', true);
  items.forEach(function(it){ html += (typeof it==='string') ? opt(it,it) : opt(it.id,it.ten); });
  el.innerHTML=html;
}
function dungBoLoc(){
  if(!BL_DM) return;
  ['f1_donVi','f2_donVi','f3_donVi'].forEach(function(id){ fillSelect(id, BL_DM.donVi, 'Tất cả'); });
  ['f1_doiXe','f2_doiXe','f3_doiXe'].forEach(function(id){ fillSelect(id, BL_DM.doiXe, 'Tất cả'); });
  fillSelect('f2_trangThai', BL_DM.trangThaiXe, 'Tất cả');
  fillSelect('f3_trangThai', BL_DM.trangThaiNS, 'Tất cả');
  fillSelect('f3_gioiTinh', BL_DM.gioiTinh, 'Tất cả');
}
function val(id){ var el=$(id); return el? String(el.value||'').trim() : ''; }
function layBoLoc(screen){
  if(screen==='tongquan') return { donVi:val('f1_donVi'), doiXe:val('f1_doiXe'), denNgay:val('f1_chot') };
  if(screen==='phuongtien') return { donVi:val('f2_donVi'), doiXe:val('f2_doiXe'), trangThai:val('f2_trangThai') };
  if(screen==='nhansu') return { donVi:val('f3_donVi'), doiXe:val('f3_doiXe'), gioiTinh:val('f3_gioiTinh'), trangThai:val('f3_trangThai') };
  return {};
}
function apDung(screen){
  if(screen==='tongquan') taiTongQuan();
  else if(screen==='phuongtien') taiPhuongTien();
  else if(screen==='nhansu') taiNhanSu();
}
function xoaLoc(screen){
  var ids={ tongquan:['f1_donVi','f1_doiXe','f1_chot'],
            phuongtien:['f2_donVi','f2_doiXe','f2_trangThai'],
            nhansu:['f3_donVi','f3_doiXe','f3_gioiTinh','f3_trangThai'] }[screen]||[];
  ids.forEach(function(id){ var el=$(id); if(el) el.value=''; });
  apDung(screen);
}

function taiTongQuan(){
  $('tqLoading').style.display='block'; $('tqBody').style.display='none'; $('tqErr').style.display='none';
  google.script.run.withSuccessHandler(function(res){
    if(!res.ok){ $('tqLoading').style.display='none'; $('tqErr').style.display='block'; $('tqErr').textContent = 'Lỗi: '+(res.message||'không tải được dữ liệu'); return; }
    renderTongQuan(res.data);
  }).withFailureHandler(function(e){ $('tqLoading').style.display='none'; $('tqErr').style.display='block'; $('tqErr').textContent = e.message; }).getTongQuan(layBoLoc('tongquan'));
}
function lamMoi(){
  var active = document.querySelector('.nav a.active').getAttribute('data-page');
  google.script.run.withSuccessHandler(function(){
    loaded.tongquan=false; loaded.phuongtien=false; loaded.nhansu=false; loaded.tuanthu=false; loaded.biendong=false;
    if(active==='phuongtien') taiPhuongTien();
    else if(active==='nhansu') taiNhanSu();
    else if(active==='tuanthu') taiTuanThu();
    else if(active==='biendong') taiBienDong();
    else if(active==='baocao'){ if(curBaoCao) xemBaoCao(curBaoCao, curBaoCaoTen); }
    else taiTongQuan();
  }).withFailureHandler(function(e){ alert(e.message); }).lamMoiTatCa();
}

/* ---- Chart helpers ---- */
function chart(id, cfg){ if(charts[id]){ try{charts[id].destroy();}catch(e){} } charts[id]=new Chart($(id).getContext('2d'), cfg); }
function pieChart(id, list, doughnut){
  chart(id, { type:'doughnut', data:{ labels:list.map(function(x){return x.nhan;}), datasets:[{ data:list.map(function(x){return x.soLuong;}), backgroundColor:PALETTE, borderWidth:1, borderColor:'#fff' }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout: doughnut?'58%':0, plugins:{ legend:{ position:'right', labels:{ boxWidth:12, font:{size:11} } } } } });
}
function barChart(id, list, color, horizontal){
  chart(id, { type:'bar', data:{ labels:list.map(function(x){return x.nhan||x.nam;}), datasets:[{ data:list.map(function(x){return x.soLuong;}), backgroundColor:color||'#2563eb', borderRadius:5, maxBarThickness:34 }] },
    options:{ indexAxis: horizontal?'y':'x', responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false} }, scales:{ x:{ grid:{display:!horizontal} }, y:{ grid:{display:horizontal} } } } });
}
function cbRowsXe(list){
  if(!list.length) return '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:18px">Không có cảnh báo.</td></tr>';
  return list.map(function(x){
    var qua = x.soNgayConLai<0; var d = qua ? ('Quá '+Math.abs(x.soNgayConLai)+'n') : (x.soNgayConLai+'n');
    return '<tr><td><b>'+esc(x.ten)+'</b></td><td>'+esc(x.phu)+'</td><td>'+esc(x.doiXe)+'</td><td>'+esc(x.trangThai)+'</td><td>'+esc(x.hangMuc)+'</td><td>'+esc(x.ngayHetHan)+'</td><td><span class="days '+(qua?'qua':'sap')+'">'+d+'</span></td></tr>';
  }).join('');
}
function cbRowsNS(list){
  if(!list.length) return '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:18px">Không có cảnh báo.</td></tr>';
  return list.map(function(x){
    var qua = x.soNgayConLai<0; var d = qua ? ('Quá '+Math.abs(x.soNgayConLai)+'n') : (x.soNgayConLai+'n');
    return '<tr><td><b>'+esc(x.ten)+'</b></td><td>'+esc(x.doiXe)+'</td><td>'+esc(x.phu)+'</td><td>'+esc(x.hangMuc)+'</td><td>'+esc(x.ngayHetHan)+'</td><td><span class="days '+(qua?'qua':'sap')+'">'+d+'</span></td></tr>';
  }).join('');
}
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ---- MÀN 2 ---- */
function taiPhuongTien(){
  $('ptLoading').style.display='block'; $('ptBody').style.display='none'; $('ptErr').style.display='none';
  google.script.run.withSuccessHandler(function(res){
    if(!res.ok){ $('ptLoading').style.display='none'; $('ptErr').style.display='block'; $('ptErr').textContent='Lỗi: '+(res.message||''); return; }
    renderPhuongTien(res.data); loaded.phuongtien=true;
  }).withFailureHandler(function(e){ $('ptLoading').style.display='none'; $('ptErr').style.display='block'; $('ptErr').textContent=e.message; }).getPhuongTien(layBoLoc('phuongtien'));
}
function renderPhuongTien(d){
  $('ptLoading').style.display='none'; $('ptBody').style.display='block';
  $('hCapNhat').textContent='Cập nhật: '+(d.capNhat||'');
  var k=d.kpi;
  $('m2_tong').textContent=fmt(k.tong); $('m2_dhd').textContent=fmt(k.dangHoatDong); $('m2_dhd_p').textContent=pctTxt(k.tlDangHoatDong);
  $('m2_xh').textContent=fmt(k.xuatHang); $('m2_xh_p').textContent=pctTxt(k.tlXuatHang);
  $('m2_ng').textContent=fmt(k.ngung); $('m2_ng_p').textContent=pctTxt(k.tlNgung);
  $('m2_cpc').textContent=fmt(k.chuaPhanCong); $('m2_cpc_p').textContent=pctTxt(k.tlChuaPhanCong);
  $('m2_nlx').textContent=fmt(k.nhieuLaiXe); $('m2_nlx_p').textContent=pctTxt(k.tlNhieuLaiXe);
  pieChart('m2_pie', d.coCauNhanHieu, true);
  barChart('m2_nam', (d.theoNam||[]).map(function(x){return {nhan:x.nam,soLuong:x.soLuong};}), '#2563eb', false);
  pieChart('m2_tt', d.tinhTrang, true);
  barChart('m2_doi', d.phanBoDoi, '#0ea5b7', true);
  $('m2_cb_n').textContent=fmt(d.canhBaoTong||0); $('m2_cb').innerHTML=cbRowsXe(d.canhBao||[]);
  // Thống kê theo đơn vị
  var rows=(d.thongKeDonVi||[]).map(function(x){
    return '<tr><td><b>'+esc(x.donVi)+'</b></td><td class="num">'+fmt(x.tong)+'</td><td class="num c-green">'+fmt(x.dangHD)+'</td><td class="num c-amber">'+fmt(x.xuatHang)+'</td><td class="num c-red">'+fmt(x.ngung)+'</td><td class="num c-blue">'+fmt(x.chuaPC)+'</td></tr>';
  }).join('');
  $('m2_tkdv').innerHTML = rows || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:14px">Không có dữ liệu.</td></tr>';
  barChart('m2_topchuyen', d.topChuyen||[], '#2563eb', true);
  barChart('m2_topkm', d.topKm||[], '#0ea5b7', true);
}

/* ---- MÀN 3 ---- */
function taiNhanSu(){
  $('nsLoading').style.display='block'; $('nsBody').style.display='none'; $('nsErr').style.display='none';
  google.script.run.withSuccessHandler(function(res){
    if(!res.ok){ $('nsLoading').style.display='none'; $('nsErr').style.display='block'; $('nsErr').textContent='Lỗi: '+(res.message||''); return; }
    renderNhanSu(res.data); loaded.nhansu=true;
  }).withFailureHandler(function(e){ $('nsLoading').style.display='none'; $('nsErr').style.display='block'; $('nsErr').textContent=e.message; }).getNhanSu(layBoLoc('nhansu'));
}
function renderNhanSu(d){
  $('nsLoading').style.display='none'; $('nsBody').style.display='block';
  $('hCapNhat').textContent='Cập nhật: '+(d.capNhat||'');
  var k=d.kpi;
  $('m3_tong').textContent=fmt(k.tong); $('m3_dl').textContent=fmt(k.dangLam); $('m3_dl_p').textContent=pctTxt(k.tlDangLam);
  $('m3_tn').textContent=fmt(k.tamNghi); $('m3_tn_p').textContent=pctTxt(k.tlTamNghi);
  $('m3_nv').textContent=fmt(k.nghiViec); $('m3_nv_p').textContent=pctTxt(k.tlNghiViec);
  $('m3_cx').textContent=fmt(k.chuaCoXe); $('m3_cx_p').textContent=pctTxt(k.tlChuaCoXe);
  $('m3_bh').textContent=fmt(k.chuaBHXH); $('m3_bh_p').textContent=pctTxt(k.tlChuaBHXH);
  pieChart('m3_gt', d.gioiTinh, true);
  barChart('m3_tuoi', d.doTuoi, '#8b5cf6', false);
  $('m3_tuoibq').textContent=(d.tuoiBinhQuan||0)+' tuổi';
  pieChart('m3_loai', d.loaiNhanSu, true);
  barChart('m3_thamnien', d.thamNien, '#0ea5b7', true);
  barChart('m3_doi2', d.phanBoDoi, '#16a34a', true);
  $('m3_cb_n').textContent=fmt(d.canhBaoTong||0); $('m3_cb').innerHTML=cbRowsNS(d.canhBao||[]);
}

/* ---- MÀN 4: TUÂN THỦ ---- */
function taiTuanThu(){
  $('ttLoading').style.display='block'; $('ttBody').style.display='none'; $('ttErr').style.display='none';
  google.script.run.withSuccessHandler(function(res){
    if(!res.ok){ $('ttLoading').style.display='none'; $('ttErr').style.display='block'; $('ttErr').textContent='Lỗi: '+(res.message||''); return; }
    renderTuanThu(res.data); loaded.tuanthu=true;
  }).withFailureHandler(function(e){ $('ttLoading').style.display='none'; $('ttErr').style.display='block'; $('ttErr').textContent=e.message; }).getTuanThu();
}
function ttRows(list){
  return list.map(function(x){
    var color = x.tyLe>=90?'#16a34a':(x.tyLe>=75?'#f59e0b':'#ef4444');
    return '<tr><td><b>'+esc(x.nhom)+'</b></td><td class="num c-green">'+fmt(x.duDieuKien)+'</td><td class="num c-amber">'+fmt(x.sapHet)+'</td><td class="num c-red">'+fmt(x.quaHan)+'</td>'
      +'<td><span class="bar-tt"><span style="width:'+x.tyLe+'%;background:'+color+'"></span></span> <b>'+x.tyLe+'%</b></td></tr>';
  }).join('');
}
function renderTuanThu(d){
  $('ttLoading').style.display='none'; $('ttBody').style.display='block';
  $('hCapNhat').textContent='Cập nhật: '+(d.capNhat||'');
  $('ttPT').innerHTML=ttRows(d.phuongTien||[]); $('ttNS').innerHTML=ttRows(d.nhanSu||[]);
}
function ttTab(which){
  ['all','pt','ns'].forEach(function(k){ $('tab_'+k).classList.toggle('on', k===which); });
  $('ttCardPT').style.display = (which==='ns')?'none':'block';
  $('ttCardNS').style.display = (which==='pt')?'none':'block';
  $('ttCards').style.gridTemplateColumns = (which==='all')?'1fr 1fr':'1fr';
}

/* ---- MÀN 5: BIẾN ĐỘNG ---- */
function taiBienDong(){
  $('bdLoading').style.display='block'; $('bdBody').style.display='none'; $('bdErr').style.display='none';
  google.script.run.withSuccessHandler(function(res){
    if(!res.ok){ $('bdLoading').style.display='none'; $('bdErr').style.display='block'; $('bdErr').textContent='Lỗi: '+(res.message||''); return; }
    renderBienDong(res.data); loaded.biendong=true;
  }).withFailureHandler(function(e){ $('bdLoading').style.display='none'; $('bdErr').style.display='block'; $('bdErr').textContent=e.message; }).getBienDong();
}
function comboChart(id, s, lblNhap, lblXuat){
  chart(id, { data:{ labels:s.map(function(x){return x.ky;}),
    datasets:[
      { type:'bar', label:lblNhap, data:s.map(function(x){return x.nhap;}), backgroundColor:'#16a34a', borderRadius:4, maxBarThickness:18 },
      { type:'bar', label:lblXuat, data:s.map(function(x){return x.xuat;}), backgroundColor:'#ef4444', borderRadius:4, maxBarThickness:18 },
      { type:'line', label:'Cuối kỳ', data:s.map(function(x){return x.cuoiKy;}), borderColor:'#2563eb', backgroundColor:'#2563eb', tension:.3, yAxisID:'y1', pointRadius:3 }
    ]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ boxWidth:12, font:{size:10} } } },
      scales:{ y:{ beginAtZero:true, position:'left' }, y1:{ position:'right', grid:{display:false} } } } });
}
function tongTable(t, l1, l2){
  return '<table class="tt-table"><tr><td>Đầu kỳ</td><td class="num">'+fmt(t.dauKy)+'</td></tr>'
    +'<tr><td>'+l1+'</td><td class="num c-green">+'+fmt(t.nhap)+'</td></tr>'
    +'<tr><td>'+l2+'</td><td class="num c-red">-'+fmt(t.xuat)+'</td></tr>'
    +'<tr><td><b>Cuối kỳ</b></td><td class="num"><b>'+fmt(t.cuoiKy)+'</b></td></tr>'
    +'<tr><td>Tăng/giảm</td><td class="num '+(t.tangGiam>=0?'c-green':'c-red')+'">'+(t.tangGiam>=0?'+':'')+fmt(t.tangGiam)+'</td></tr></table>';
}
function renderBienDong(d){
  $('bdLoading').style.display='none'; $('bdBody').style.display='block';
  $('hCapNhat').textContent='Cập nhật: '+(d.capNhat||'');
  $('bdNote').textContent='Phân tích '+d.soThang+' tháng gần nhất. Cột = phát sinh trong tháng; đường = số luỹ kế cuối kỳ.';
  comboChart('bd_pt', d.phuongTien.series, 'Xe nhập mới', 'Xe xuất hàng');
  comboChart('bd_ns', d.nhanSu.series, 'Tuyển mới', 'Nghỉ việc');
  comboChart('bd_hs', d.hoSo.series, 'Hồ sơ mới', 'Hồ sơ hết hạn');
  $('bd_t_pt').innerHTML=tongTable(d.phuongTien.tong,'Nhập mới','Xuất hàng');
  $('bd_t_ns').innerHTML=tongTable(d.nhanSu.tong,'Tuyển mới','Nghỉ việc');
  $('bd_t_hs').innerHTML=tongTable(d.hoSo.tong,'Hồ sơ mới','Hồ sơ hết hạn');
}

/* ---- MÀN 6: BÁO CÁO ---- */
var curBaoCao=null, curBaoCaoTen='', curData=null;
function taiDanhMucBaoCao(){
  google.script.run.withSuccessHandler(function(res){
    if(!res.ok) return;
    var html='';
    (res.data||[]).forEach(function(g){
      html+='<div class="rp-group">'+esc(g.nhom)+'</div>';
      g.items.forEach(function(it){ html+='<div class="rp-item" id="rp_'+it.key+'" onclick="xemBaoCao(\''+it.key+'\',\''+esc(it.ten).replace(/'/g,"")+'\')">'+esc(it.ten)+'</div>'; });
    });
    $('rpList').innerHTML=html; loaded.baocao=true;
  }).withFailureHandler(function(e){ $('rpList').innerHTML='<div class="msg err">'+e.message+'</div>'; }).getDanhMucBaoCao();
}
function xemBaoCao(key, ten){
  curBaoCao=key; curBaoCaoTen=ten;
  document.querySelectorAll('.rp-item').forEach(function(x){ x.classList.remove('on'); });
  var it=$('rp_'+key); if(it) it.classList.add('on');
  $('rpEmpty').style.display='none'; $('rpView').style.display='block'; $('rpErr').textContent='';
  $('rpTitle').textContent='Đang tải…'; $('rpTable').innerHTML='';
  var bl={ tuNgay:val('bc_tu'), denNgay:val('bc_den') };
  google.script.run.withSuccessHandler(function(res){
    if(!res.ok){ $('rpErr').textContent=res.message; return; }
    curData=res.data; renderBaoCao(res.data);
  }).withFailureHandler(function(e){ $('rpErr').textContent=e.message; }).getBaoCao(key, bl);
}
function locBaoCao(){ if(curBaoCao) xemBaoCao(curBaoCao, curBaoCaoTen); }
function xoaLocBaoCao(){ var a=$('bc_tu'),b=$('bc_den'); if(a)a.value=''; if(b)b.value=''; if(curBaoCao) xemBaoCao(curBaoCao, curBaoCaoTen); }
function renderBaoCao(d){
  $('rpTitle').textContent=d.tieuDe;
  $('rpInfo').textContent='Số dòng: '+fmt(d.soDong)+' · Cập nhật: '+d.capNhat;
  var html='<thead><tr>'+d.cols.map(function(c){return '<th>'+esc(c)+'</th>';}).join('')+'</tr></thead><tbody>';
  if(!d.rows.length) html+='<tr><td colspan="'+d.cols.length+'" style="text-align:center;color:#94a3b8;padding:18px">Không có dữ liệu.</td></tr>';
  else html+=d.rows.map(function(r){ return '<tr>'+r.map(function(c){return '<td>'+esc(c)+'</td>';}).join('')+'</tr>'; }).join('');
  $('rpTable').innerHTML=html+'</tbody>';
}
function xuat(dinhDang){
  if(!curData){ alert('Chưa chọn báo cáo.'); return; }
  if(dinhDang==='pdf'){ window.print(); return; }
  var sep = dinhDang==='excel' ? ',' : '\t';
  var head = curData.cols.join(sep);
  var body = curData.rows.map(function(r){ return r.map(function(c){ var s=String(c==null?'':c); return (s.indexOf(sep)>=0||s.indexOf('"')>=0)?('"'+s.replace(/"/g,'""')+'"'):s; }).join(sep); }).join('\n');
  var ten = (curData.tieuDe||'bao_cao').replace(/[^0-9A-Za-z]+/g,'_');
  if(dinhDang==='excel'){
    taiXuong('\ufeff'+head+'\n'+body, ten+'.csv', 'text/csv;charset=utf-8');
  } else {
    var hd = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"></head><body>'
      +'<h2>'+esc(curData.tieuDe)+'</h2><table border="1" cellspacing="0" cellpadding="4"><tr>'+curData.cols.map(function(c){return '<th>'+esc(c)+'</th>';}).join('')+'</tr>'
      +curData.rows.map(function(r){return '<tr>'+r.map(function(c){return '<td>'+esc(c)+'</td>';}).join('')+'</tr>';}).join('')+'</table></body></html>';
    taiXuong(hd, ten+'.doc', 'application/msword');
  }
}
function taiXuong(noiDung, tenFile, mime){
  try{
    var blob=new Blob([noiDung],{type:mime});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a'); a.href=url; a.download=tenFile; document.body.appendChild(a); a.click();
    setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 800);
  }catch(e){ alert('Trình duyệt chặn tải tệp trong khung nhúng. Anh có thể dùng nút Xuất PDF (in) hoặc mở web app ở thẻ mới.'); }
}

function renderTongQuan(d){
  $('tqLoading').style.display='none'; $('tqBody').style.display='block'; loaded.tongquan=true;
  $('hCapNhat').textContent = 'Cập nhật: ' + (d.capNhat||'');

  var pt=d.kpiPhuongTien;
  $('pt_tong').textContent=fmt(pt.tong); $('pt_dhd').textContent=fmt(pt.dangHoatDong); $('pt_dhd_p').textContent=pctTxt(pt.tlDangHoatDong);
  $('pt_xh').textContent=fmt(pt.xuatHang); $('pt_xh_p').textContent=pctTxt(pt.tlXuatHang);
  $('pt_ng').textContent=fmt(pt.ngung); $('pt_ng_p').textContent=pctTxt(pt.tlNgung);
  $('pt_cpc').textContent=fmt(pt.chuaPhanCong); $('pt_cpc_p').textContent=pctTxt(pt.tlChuaPhanCong);
  $('pt_nlx').textContent=fmt(pt.nhieuLaiXe); $('pt_nlx_p').textContent=pctTxt(pt.tlNhieuLaiXe);

  var ns=d.kpiNhanSu;
  $('ns_tong').textContent=fmt(ns.tong); $('ns_dl').textContent=fmt(ns.dangLam); $('ns_dl_p').textContent=pctTxt(ns.tlDangLam);
  $('ns_tn').textContent=fmt(ns.tamNghi); $('ns_tn_p').textContent=pctTxt(ns.tlTamNghi);
  $('ns_nv').textContent=fmt(ns.nghiViec); $('ns_nv_p').textContent=pctTxt(ns.tlNghiViec);
  $('ns_cx').textContent=fmt(ns.chuaCoXe); $('ns_cx_p').textContent=pctTxt(ns.tlChuaCoXe);
  $('ns_bh').textContent=fmt(ns.chuaBHXH); $('ns_bh_p').textContent=pctTxt(ns.tlChuaBHXH);

  var hs=d.kpiHoSo;
  $('hs_tong').textContent=fmt(hs.tong); $('hs_con').textContent=fmt(hs.conHieuLuc); $('hs_con_p').textContent=pctTxt(hs.tlConHieuLuc);
  $('hs_sap').textContent=fmt(hs.sapHetHan); $('hs_sap_p').textContent=pctTxt(hs.tlSapHetHan);
  $('hs_qua').textContent=fmt(hs.quaHan); $('hs_qua_p').textContent=pctTxt(hs.tlQuaHan);
  $('hs_thieu').textContent=fmt(hs.thieuHoSo);

  $('cb_qua').textContent=fmt(d.canhBao.tongQuaHan); $('cb_sap').textContent=fmt(d.canhBao.tongSapHet);
  $('hCanhBao').textContent=fmt(d.canhBao.tongQuaHan);
  $('cb_list').innerHTML = (d.canhBao.chiTiet||[]).map(function(x){
    return '<div class="alert-row"><span>'+x.nhom+'</span><span>Quá hạn <b>'+fmt(x.quaHan)+'</b> · Sắp hết '+fmt(x.sapHet)+'</span></div>';
  }).join('');

  renderGauges(d.tyLeTuanThu||[]);

  // Biến động tháng này
  var bd=d.bienDongThang;
  if(bd){
    $('bd_ky').textContent=bd.kyLabel||'';
    $('bd_xenhap').textContent=fmt(bd.xeNhap); $('bd_xexuat').textContent=fmt(bd.xeXuat);
    $('bd_nstuyen').textContent=fmt(bd.nsTuyen); $('bd_nsnghi').textContent=fmt(bd.nsNghi);
    var s=bd.series||[];
    chart('bd_line', { data:{ labels:s.map(function(x){return x.ky;}),
      datasets:[
        { type:'line', label:'Xe đang vận hành', data:s.map(function(x){return x.xe;}), borderColor:'#2563eb', backgroundColor:'#2563eb', tension:.3, pointRadius:3 },
        { type:'line', label:'Nhân sự đang làm việc', data:s.map(function(x){return x.ns;}), borderColor:'#16a34a', backgroundColor:'#16a34a', tension:.3, pointRadius:3 }
      ]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ boxWidth:12, font:{size:11} } } }, scales:{ y:{ beginAtZero:false } } } });
  }
}

function renderGauges(list){
  var box=$('tt_gauges'); box.innerHTML='';
  gaugeCharts.forEach(function(c){ try{c.destroy();}catch(e){} }); gaugeCharts=[];
  list.forEach(function(x,i){
    var color = x.tyLe>=90?'#16a34a':(x.tyLe>=75?'#d97706':'#dc2626');
    var d=document.createElement('div'); d.className='gauge';
    d.innerHTML='<div class="wrap"><canvas id="g'+i+'"></canvas><div class="val">'+x.tyLe+'%</div></div><div class="nm">'+x.nhom+'</div>';
    box.appendChild(d);
    var ctx=$('g'+i).getContext('2d');
    gaugeCharts.push(new Chart(ctx,{type:'doughnut',data:{datasets:[{data:[x.tyLe,Math.max(0,100-x.tyLe)],backgroundColor:[color,'#e5e7eb'],borderWidth:0}]},options:{cutout:'72%',plugins:{legend:{display:false},tooltip:{enabled:false}},responsive:true,maintainAspectRatio:true}}));
  });
}

function chanDoan(){
  $('cdMsg').className='msg'; $('cdMsg').textContent='Đang chẩn đoán…'; $('cdResult').innerHTML='';
  google.script.run.withSuccessHandler(function(res){
    if(!res.ok){ $('cdMsg').className='msg err'; $('cdMsg').textContent=res.message; return; }
    var rows=res.data||[]; var loi=rows.filter(function(x){return !x.ok;}).length;
    $('cdMsg').className='msg '+(loi?'err':'ok');
    $('cdMsg').textContent= loi? ('Có '+loi+' bảng/cột chưa khớp — xem chi tiết bên dưới.') : ('Tất cả '+rows.length+' bảng khớp hợp đồng dữ liệu.');
    var html='<table class="diag-table"><tr><th>Sheet</th><th>Số dòng</th><th>Kết quả</th><th>Cột thiếu</th></tr>';
    rows.forEach(function(x){
      html+='<tr><td><b>'+x.sheet+'</b></td><td>'+fmt(x.soDong)+'</td><td>'+(x.ok?'<span class="ok-pill">OK</span>':'<span class="err-pill">LỖI</span>')+'</td><td>'+(x.cotThieu.length?x.cotThieu.join(', '):'—')+'</td></tr>';
    });
    $('cdResult').innerHTML=html+'</table>';
  }).withFailureHandler(function(e){ $('cdMsg').className='msg err'; $('cdMsg').textContent=e.message; }).getChanDoan();
}
</script>
</body>
</html>
