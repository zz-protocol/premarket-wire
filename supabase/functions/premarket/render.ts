import { CORE_KEYS, type Group, type Pred, type Quote, metaOf } from "./quotes.ts";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function fmtPct(v: number | null, digits = 2): string {
  if (v == null) return "暂无";
  const body = v.toFixed(digits);
  return (v >= 0 ? "+" + body : body) + "%";
}

function tone(v: number | null): string {
  if (v == null) return "t-flat";
  if (v > 0.05) return "t-up";
  if (v < -0.05) return "t-down";
  return "t-flat";
}

function svgArrow(direction: "up" | "down" | "flat"): string {
  let path = "M1 3.4 H7 V4.6 H1 Z";
  if (direction === "up") path = "M4 1.2 L7.2 6.8 H0.8 Z";
  else if (direction === "down") path = "M4 6.8 L0.8 1.2 H7.2 Z";
  return (
    `<svg class="arr" viewBox="0 0 8 8" aria-hidden="true">` +
    `<path d="${path}" fill="currentColor"/></svg>`
  );
}

function arrowFor(v: number | null): string {
  if (v == null) return svgArrow("flat");
  if (v > 0.05) return svgArrow("up");
  if (v < -0.05) return svgArrow("down");
  return svgArrow("flat");
}

function anomalyTag(v: number | null): string {
  if (v == null || Math.abs(v) < 3) return "";
  return `<span class="anomaly" title="异动: 波幅≥3%"></span>`;
}

function catalogOf(macroGroups: Group[], sectors: Group[] | null): Record<string, Quote> {
  const cat: Record<string, Quote> = {};
  for (const g of macroGroups || []) {
    for (const e of g.items) cat[e.id] = e;
  }
  for (const s of sectors || []) {
    for (const e of s.items) {
      if (!(e.id in cat)) cat[e.id] = e;
    }
  }
  return cat;
}

function renderCoreRows(macroGroups: Group[], sectors: Group[] | null): string {
  const cat = catalogOf(macroGroups, sectors);
  const rows: string[] = [];
  for (const kid of CORE_KEYS) {
    const e = cat[kid] || {
      id: kid,
      name: metaOf(kid)[0],
      price: null,
      change_pct: null,
      desc: metaOf(kid)[1],
      missing: true,
    };
    const cls = tone(e.change_pct);
    rows.push(`
        <div class="wire-row">
          <span class="wr-name">${escapeHtml(e.name)}${anomalyTag(e.change_pct)}</span>
          <span class="wr-val">${arrowFor(e.change_pct)}<span class="num ${cls}">${fmtPct(e.change_pct)}</span></span>
          <span class="wr-note">${escapeHtml(e.desc || "")}</span>
        </div>`);
  }
  return rows.join("\n");
}

function renderSectorBand(sec: Group): string {
  const items: string[] = [];
  for (const e of sec.items) {
    if (e.missing || e.change_pct == null) {
      items.push(
        `<span class="tk"><span class="tk-name">${escapeHtml(e.name)}</span>
              <span class="num t-flat">暂无</span></span>`,
      );
      continue;
    }
    const cls = tone(e.change_pct);
    items.push(
      `<span class="tk"><span class="tk-name">${escapeHtml(e.name)}</span>
          <span class="num ${cls}">${arrowFor(e.change_pct)}${fmtPct(e.change_pct)}</span></span>`,
    );
  }
  const inner = items.join("\n          ");
  return `
      <div class="band">
        <div class="band-name">${escapeHtml(sec.section)}</div>
        <div class="band-tks">
          ${inner}
        </div>
      </div>`;
}

function renderMacroWire(macroGroups: Group[]): string {
  const out: string[] = [];
  for (const g of macroGroups) {
    const rows: string[] = [];
    for (const e of g.items) {
      const cls = tone(e.change_pct);
      rows.push(`
        <div class="wire-row">
          <span class="wr-name">${escapeHtml(e.name)}${anomalyTag(e.change_pct)}</span>
          <span class="wr-val">${arrowFor(e.change_pct)}<span class="num ${cls}">${fmtPct(e.change_pct)}</span></span>
          <span class="wr-note">${escapeHtml(e.desc || "")}</span>
        </div>`);
    }
    out.push(`
      <div class="m-sec">
        <h3 class="m-head">${escapeHtml(g.section)}</h3>
        ${rows.join("")}
      </div>`);
  }
  return out.join("\n");
}

function renderVerdict(pred: Pred): string {
  const up = pred.up_prob;
  const dn = pred.down_prob;
  const direction = pred.direction || "";
  const confidence = pred.confidence || "";
  if (up == null || dn == null || direction === "" || direction === "未能预测") {
    return `
        <div class="verdict">
          <div class="v-dir ink-1">研判未出</div>
          <p class="v-summary">模型本次返回无法解析。数据照常记录于下方纸带，可稍后刷新再试。</p>
        </div>`;
  }
  const sealMap: Record<string, string> = { "高开": "偏强", "低开": "偏弱", "平开": "中性" };
  const sealWord = sealMap[direction] || direction;
  const confLabel = { "高": "高", "中": "中", "低": "低" }[confidence] || confidence;
  const upItems = (pred.up_factors || []).map(
    (x) =>
      `<li><span class="fac-mark fac-plus">+</span>${escapeHtml(String(x))}</li>`,
  ).join("");
  const dnItems = (pred.down_factors || []).map(
    (x) =>
      `<li><span class="fac-mark fac-minus">−</span>${escapeHtml(String(x))}</li>`,
  ).join("");
  return `
      <div class="verdict">
        <div class="v-topline">
          <span class="v-dir">${escapeHtml(direction)}倾向</span>
          <span class="seal" aria-label="AI判定印章:${escapeHtml(sealWord)}, 置信度${escapeHtml(String(confLabel))}">
            <span class="seal-word">${escapeHtml(sealWord)}</span>
            <span class="seal-conf">置信${escapeHtml(String(confLabel))}</span>
          </span>
        </div>
        <div class="v-odds">
          <span class="odd"><i class="odd-lab">高开</i><b class="num">${up}</b><i class="odd-pct">%</i></span>
          <span class="odds-sep">:</span>
          <span class="odd odd-b"><i class="odd-lab">低开</i><b class="num">${dn}</b><i class="odd-pct">%</i></span>
        </div>
        <p class="v-summary">${escapeHtml(pred.summary || "")}</p>
        <div class="v-factors">
          <ul class="fac-list">${upItems}</ul>
          <ul class="fac-list">${dnItems}</ul>
        </div>
      </div>`;
}

const CONTRACT = `<!--
DIRECTION CONTRACT - 行情电讯纸带 (seed 6d2f8534, operate, code-led)
THESIS: 这块看板是一份清晨从行情电讯机打出的记录单；拒绝通用后台的暗色卡片脸与进度条仪表。
OWN-WORLD: 暖白纸底、油墨黑、单一A股红信号色、跌绿为唯一次语义色；等宽数据行+时间戳；
平面色块分区（无圆角卡片）；宋体报头；方形判定印章；异动行斜纹标记。
STORY: 访客十秒内读到电头导语与盖章判定，再沿纸带扫过板块与指标，每个数字可回溯到快照时间。
FIRST VIEWPORT: 报头（刊名+期号+快照时间）之下左右对等双栏，左为AI电头（大号方向词、
概率对偶数字、印章、导语、多空因子），右为夜盘核心六行（数值+趋势+一行含义）。
FORM: 行情电讯纸带，抽签指定方向；六个落选挑战者各捐一纪律（趋势随值、墨色分层、平面分区、
斜纹异动标记、无彩文本域、全局token一致）已融入。
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review,
the verdict, DESIGN.md, and every shipping raster carrying its provenance.
-->`;

const CSS = `
/* ===== 盘前电讯 · 行情电讯纸带 world ===== */
:root{
  --paper:#FBF9F4; --paper-deep:#F3EFE6; --ink:#1C1915;
  --ink-70:rgba(28,25,21,.72); --ink-45:rgba(28,25,21,.46); --ink-15:rgba(28,25,21,.14);
  --red:#BF3126; --red-dim:rgba(191,49,38,.08);
  --green:#256B47;
  --mono:'Consolas','SF Mono','Menlo','Roboto Mono',monospace;
  --serif:'Noto Serif SC','SimSun','Songti SC',serif;
  --sans:'PingFang SC','Microsoft YaHei','Segoe UI',sans-serif;
}
*{margin:0;padding:0;box-sizing:border-box}
::selection{background:var(--red-dim);color:var(--red)}
html{background:var(--paper);overflow-x:hidden;max-width:100%}
body{
  font-family:var(--sans); color:var(--ink); background:var(--paper);
  font-size:.9375rem; line-height:1.65;
  overflow-x:hidden; max-width:100%;
}
.num{font-family:var(--mono);font-feature-settings:'tnum' 1;font-variant-numeric:tabular-nums}
.ink-1{color:var(--ink)} .ink-2{color:var(--ink-70)} .ink-3{color:var(--ink-45)}
.t-up{color:var(--red)} .t-down{color:var(--green)} .t-flat{color:var(--ink-45)}
.arr{width:.55em;height:.55em;display:inline-block;vertical-align:baseline;margin-right:.18em}

.sheet{max-width:1120px;margin:0 auto;padding:40px 32px 56px;overflow-x:hidden;width:100%}

/* 报头 */
.masthead{border-bottom:3px double var(--ink);padding-bottom:14px;margin-bottom:0}
.mast-title{font-family:var(--serif);font-weight:900;font-size:1.75rem;letter-spacing:.14em}
.mast-sub{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;
  font-size:.8125rem;color:var(--ink-45);margin-top:6px}
.mast-sub .num{letter-spacing:0}

/* 电头双栏 */
.lead{display:grid;grid-template-columns:11fr 9fr;gap:0;
  border-bottom:1px solid var(--ink-15)}
.verdict-col{padding:26px 28px 26px 0;border-right:1px solid var(--ink-15);min-width:0}
.core{padding:26px 0 26px 28px;min-width:0}

.v-topline{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:nowrap}
.v-dir{font-size:2.6rem;font-weight:800;line-height:1.15;letter-spacing:-.01em;
  flex:1 1 auto;min-width:0}
.seal{
  flex:none;flex-shrink:0;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;
  width:76px;height:76px;border:2.5px solid var(--red);color:var(--red);
  transform:rotate(-4deg);border-radius:2px;background:transparent;
  animation:thump .22s cubic-bezier(.16,1,.3,1) both;
  margin-left:8px;
}
.seal-word{font-family:var(--serif);font-weight:900;font-size:1.35rem;line-height:1.1;letter-spacing:.08em}
.seal-conf{font-size:.625rem;letter-spacing:.2em;margin-top:2px}
@keyframes thump{from{transform:rotate(-9deg) scale(1.28);opacity:0}
  to{transform:rotate(-4deg) scale(1);opacity:1}}
@media (prefers-reduced-motion:reduce){.seal{animation:none}}

.v-odds{display:flex;align-items:baseline;gap:14px;margin:14px 0 10px;flex-wrap:wrap}
.odd{display:inline-flex;align-items:baseline;gap:6px}
.odd b{font-size:2.1rem;font-weight:700;color:var(--red)}
.odd-b b{color:var(--green)}
.odd-lab{font-style:normal;font-size:.875rem;color:var(--ink-70)}
.odd-pct{font-style:normal;font-size:.875rem;color:var(--ink-45)}
.odds-sep{color:var(--ink-15);font-size:1.75rem}

.v-summary{max-width:52ch;color:var(--ink-70);margin-bottom:14px;overflow-wrap:break-word}
.v-factors{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.fac-list{list-style:none}
.fac-list li{position:relative;padding-left:1.1em;font-size:.8438rem;color:var(--ink-70);
  padding-top:3px;padding-bottom:3px;overflow-wrap:break-word}
.fac-mark{position:absolute;left:0;top:3px;font-family:var(--mono);font-weight:700}
.fac-plus{color:var(--red)} .fac-minus{color:var(--green)}

/* 纸带行 (核心栏与宏观区共用) */
.wire-row{display:grid;grid-template-columns:minmax(7.5em,auto) 7em 1fr;gap:12px;
  align-items:baseline;padding:7px 0;border-bottom:1px dotted var(--ink-15)}
.wire-row:last-child{border-bottom:none}
.wr-name{font-size:.875rem;color:var(--ink);overflow-wrap:anywhere}
.wr-val{text-align:right;white-space:nowrap}
.wr-note{font-size:.75rem;color:var(--ink-45);line-height:1.5;overflow-wrap:break-word;min-width:0}
.core h2,.m-head{font-size:.8125rem;font-weight:700;letter-spacing:.18em;
  color:var(--ink-45);margin-bottom:8px}
.core h2{margin-bottom:12px}

/* 异动斜纹标记 */
.anomaly{display:inline-block;width:14px;height:.72em;margin-left:7px;vertical-align:-.06em;
  background:repeating-linear-gradient(45deg,var(--red) 0 1.5px,transparent 1.5px 4px)}

/* 板块平面色带 */
.block{padding:26px 0 6px}
.block-head{display:flex;justify-content:space-between;align-items:baseline;
  margin-bottom:14px;gap:8px;flex-wrap:wrap}
.block-head h2{font-size:1.0625rem;font-weight:800;letter-spacing:.06em}
.block-head .bh-meta{font-size:.75rem;color:var(--ink-45)}
.band{display:grid;grid-template-columns:8.5em 1fr;gap:16px;align-items:center;
  padding:11px 14px;border-bottom:1px solid var(--ink-15)}
.band:nth-child(odd){background:var(--paper-deep)}
.band-name{font-weight:700;font-size:.9063rem;letter-spacing:.04em}
.band-tks{display:flex;flex-wrap:wrap;gap:6px 26px;min-width:0}
.tk{display:inline-flex;align-items:baseline;gap:8px;font-size:.875rem}
.tk-name{color:var(--ink-70)}

/* 宏观全表 */
.macro-block{padding:26px 0 6px}
.m-sec{margin-bottom:22px}
.m-sec:last-child{margin-bottom:0}

/* 版本脚注 */
.colophon{margin-top:34px;border-top:1px solid var(--ink-15);padding-top:14px;
  font-size:.75rem;color:var(--ink-45);line-height:1.8;overflow-wrap:break-word}
.colophon b{color:var(--ink-70);font-weight:600}

:focus-visible{outline:2px solid var(--red);outline-offset:2px}

@media (max-width:760px){
  .sheet{padding:24px 16px 44px}
  .lead{grid-template-columns:1fr}
  .verdict-col{border-right:none;border-bottom:1px solid var(--ink-15);
    padding:22px 0 20px}
  .core{padding:20px 0 22px}
  .v-dir{font-size:2rem}
  .v-factors{grid-template-columns:1fr}
  .band{grid-template-columns:1fr;gap:6px;padding:11px 10px}
  .wire-row{grid-template-columns:minmax(0,1fr) auto;gap:6px 12px}
  .wr-note{grid-column:1 / -1}
}

/* 390px: zero horizontal scroll, readable odds, seal must not cover the direction word */
@media (max-width:420px){
  .sheet{padding:16px 12px 36px}
  .mast-title{font-size:1.4rem;letter-spacing:.08em}
  .mast-sub{font-size:.75rem;gap:8px}
  .v-topline{gap:10px;align-items:flex-start}
  .v-dir{font-size:1.55rem;line-height:1.2;padding-right:2px}
  .seal{width:56px;height:56px;margin-left:4px}
  .seal-word{font-size:1.05rem;letter-spacing:.04em}
  .seal-conf{font-size:.5rem;letter-spacing:.12em}
  .v-odds{gap:8px 10px;margin:12px 0 8px}
  .odd{gap:4px}
  .odd b{font-size:1.5rem}
  .odd-lab,.odd-pct{font-size:.75rem}
  .odds-sep{font-size:1.15rem}
  .v-summary{font-size:.875rem}
  .band-tks{gap:6px 14px}
  .tk{font-size:.8125rem}
  .wr-name{font-size:.8125rem}
  .wr-val{font-size:.8125rem}
}
`;

export function renderPage(
  pred: Pred,
  sectors: Group[],
  macroGroups: Group[],
  fetchTime: string,
): string {
  const coreRows = renderCoreRows(macroGroups, sectors);
  const bands = sectors.map(renderSectorBand).join("");
  const macroWire = renderMacroWire(macroGroups);
  const verdictHtml = renderVerdict(pred);
  const ft = fetchTime || "未知";
  const issueNo = ft.includes(" ") ? ft.split(" ")[0] : ft;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>盘前电讯 · A股科技开盘决策</title>
<style>${CSS}</style>
</head>
<body>
${CONTRACT}
<div class="sheet">

  <header class="masthead">
    <div class="mast-title">盘前电讯</div>
    <div class="mast-sub">
      <span>美股科技 · A股科技开盘决策参考</span>
      <span>${escapeHtml(issueNo)} 期 · 快照 <span class="num">${escapeHtml(ft)}</span> 北京时间 · 非连续实时</span>
    </div>
  </header>

  <section class="lead">
    <div class="verdict-col">
      ${verdictHtml}
    </div>
    <div class="core">
      <h2>夜盘核心</h2>
      ${coreRows}
    </div>
  </section>

  <section class="block">
    <div class="block-head">
      <h2>美股科技板块</h2>
      <span class="bh-meta">红涨绿跌 · 斜纹为波幅≥3%异动</span>
    </div>
    ${bands}
  </section>

  <section class="macro-block">
    <div class="block-head">
      <h2>日内核心指标</h2>
      <span class="bh-meta">夜盘 → A股开盘传导</span>
    </div>
    ${macroWire}
  </section>

  <footer class="colophon">
    <b>免责</b> 本页由 AI 基于上方公开快照数据推演，仅供参考，不构成投资建议；数据为生成时刻快照。<br>
    <b>代理说明</b> 恐慌情绪以 VXX 代理（VXX升即恐慌升）；十年期美债以 TLT 代理（TLT升即收益率降）；美元指数以 UUP 代理（UUP降即美元弱）。离岸人民币报价下行即人民币升值。沪深300 ETF（ASHR）为美股上市的A股代理，并非 MSCI A50 期货。<br>
    <b>来源</b> 新浪财经实时行情 hq.sinajs.cn · 日经225与SK海力士来自 Yahoo Finance · 研判 DeepSeek · 刷新 python market_dashboard.py 或 POST /api/refresh
  </footer>

</div>
</body>
</html>`;
}
