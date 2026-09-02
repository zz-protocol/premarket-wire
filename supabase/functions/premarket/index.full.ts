import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SINA_URL = "https://hq.sinajs.cn/list=";
const SINA_REFERER = "https://finance.sina.com.cn";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const YAHOO_CHART =
  "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1d";

const TIMEOUT_SINA_MS = 15_000;
const TIMEOUT_YAHOO_MS = 15_000;
const LLM_TIMEOUT_MS = 60_000;

const DEFAULT_ENDPOINT = "https://api.edgefn.net/v1/chat/completions";
const DEFAULT_MODEL = "DeepSeek-V4-Flash-0731";

const SINA_CODES = [
  "hf_NQ",
  "gb_soxx",
  "gb_cnqq",
  "fx_susdcnh",
  "gb_vxx",
  "gb_tlt",
  "gb_uup",
  "hf_CL",
  "hf_GC",
  "gb_nvda",
  "gb_tsla",
  "gb_mu",
  "gb_wdc",
  "gb_cohr",
  "gb_lite",
  "gb_ibb",
  "gb_rklb",
  "gb_gev",
  "gb_etn",
  "gb_vrt",
  "gb_tsm",
  "gb_avgo",
  "gb_amd",
  "gb_ashr",
] as const;

const YAHOO_N225 = "yahoo_n225";
const YAHOO_HYNIX = "ks_hynix";

const CORE_KEYS = [
  "hf_NQ",
  "gb_soxx",
  "gb_cnqq",
  YAHOO_N225,
  YAHOO_HYNIX,
  "fx_susdcnh",
] as const;

type Quote = {
  id: string;
  name: string;
  price: number | null;
  change_pct: number | null;
  desc: string;
  missing: boolean;
};

type Group = { section: string; items: Quote[] };

type Pred = {
  direction: string;
  up_prob: number | null;
  down_prob: number | null;
  confidence: string;
  summary: string;
  up_factors: string[];
  down_factors: string[];
};

const META: Record<string, [string, string]> = {
  hf_NQ: ["纳指100期货", "直接反映美股科技情绪，A股科技联动"],
  gb_soxx: ["SOX", "半导体是A股科技映射核心锚点"],
  gb_cnqq: ["CNQQ", "直接追踪A+H科技，比纳指更贴近"],
  [YAHOO_N225]: ["日经225", "日股风险偏好，开盘前与A股科技联动"],
  [YAHOO_HYNIX]: ["SK海力士", "韩股存储旗舰，与美光共振/背离会导向A股存储与光模块"],
  fx_susdcnh: ["离岸人民币", "报价下行即人民币升值，外资流入偏多"],
  gb_vxx: ["VXX", "VXX上涨即恐慌升，避险浓则A股科技低开概率大"],
  gb_tlt: ["TLT", "TLT上涨即美债收益率下行，利好成长股估值"],
  gb_uup: ["UUP", "美元弱则利好新兴市场；美元强则A股承压"],
  hf_CL: ["原油", "急涨推升通胀预期，利空整体；利好石油板块"],
  hf_GC: ["黄金", "黄金急涨即避险升温，对风险资产偏空"],
  gb_ashr: ["沪深300 ETF", "美股上市的A股代理，非MSCI A50期货；外资对A股大盘态度"],
  gb_cohr: ["COHR", "美股光模块龙头，映射中际旭创、新易盛"],
  gb_lite: ["LITE", "光模块器件，与A股光通信联动"],
  gb_avgo: ["AVGO", "博通，网络交换与定制芯片，映射A股通信与算力"],
  gb_nvda: ["NVDA", "算力旗舰，导向A股算力与PCB"],
  gb_amd: ["AMD", "GPU与CPU，与英伟达共同标定算力风险偏好"],
  gb_tsm: ["TSM", "台积电，晶圆代工锚点，映射A股半导体设备与材料"],
  gb_mu: ["MU", "美光，存储周期旗舰，与海力士对照"],
  gb_wdc: ["WDC", "西部数据，存储与硬盘，映射A股存储"],
  gb_ibb: ["IBB", "美股创新药ETF，映射A股创新药"],
  gb_tsla: ["TSLA", "人形机器人与智驾情绪，映射A股机器人"],
  gb_rklb: ["RKLB", "商业航天，映射A股商业航天链条"],
  gb_gev: ["GEV", "发电设备，映射A股电力设备"],
  gb_etn: ["ETN", "电气设备，数据中心供电相关"],
  gb_vrt: ["VRT", "液冷与电源，映射A股算力电力"],
};

const SECTORS_SPEC: [string, string[]][] = [
  ["光模块", ["gb_cohr", "gb_lite"]],
  ["通信", ["gb_avgo"]],
  ["算力", ["gb_nvda", "gb_amd"]],
  ["半导体/晶圆", ["gb_tsm"]],
  ["存储", ["gb_mu", YAHOO_HYNIX, "gb_wdc"]],
  ["创新药", ["gb_ibb"]],
  ["机器人", ["gb_tsla"]],
  ["商业航天", ["gb_rklb"]],
  ["电力", ["gb_gev", "gb_etn", "gb_vrt"]],
];

const MACRO_SPEC: [string, string[]][] = [
  ["一、美股夜盘（最直接）", ["hf_NQ", "gb_soxx", "gb_cnqq"]],
  ["二、亚太风险偏好", [YAHOO_N225, YAHOO_HYNIX]],
  ["三、汇率（外资流向信号）", ["fx_susdcnh", "gb_uup"]],
  ["四、避险/风险情绪", ["gb_vxx", "hf_GC"]],
  ["五、商品（通胀/成本）", ["hf_CL"]],
  ["六、美债（流动性/估值）", ["gb_tlt"]],
  ["七、A股映射代理", ["gb_ashr"]],
];

const SYSTEM_PROMPT = `你是A股开盘前的美股与亚太映射分析助手。你会收到美股科技板块、韩日指标、以及日内核心宏观指标的夜盘快照。
请严格基于这些数据，客观推演：明日（或即将到来的）A股科技板块开盘（高开/平开/低开）的倾向。

规则：
- 科技板块整体弱（光模块/半导体等普跌）则偏A股科技低开；整体强则偏高开。
- 纳指100期货、SOX、CNQQ 是美股科技核心锚点。
- 韩日：日经225代表日股风险偏好，开盘前与A股科技联动；SK海力士是韩股存储旗舰，对A股科技尤其是存储与光模块权重大。海力士与美光同向（共振）加强存储映射，背离则降低置信、提示分化。
- TSM（台积电晶圆代工）、AVGO（博通/通信与定制芯片）、AMD（与NVDA共同标定算力）必须纳入科技判断，不得忽略。
- 离岸人民币 CNH 报价下行 = 人民币升值 = 外资流入偏多，对A股科技偏建设性；CNH 报价上行则相反。
- VXX 上涨 = 恐慌升，利空风险资产；TLT 上涨 = 美债收益率下行，利好成长股。
- 沪深300 ETF（ASHR）是美股上市的A股代理，不是 MSCI A50 期货，只能作大盘外资态度的近似。
- 不要臆造数据之外的信息，只基于给定数字。缺失报价（暂无）不得编造。

只输出一个JSON对象，不要任何其它文字、不要代码块标记：
{
 "direction": "高开|平开|低开",
 "up_prob": 0到100的整数，
 "down_prob": 0到100的整数，
 "confidence": "高|中|低",
 "summary": "用30-60字概括主要依据与结论",
 "up_factors": ["支持A股科技高开/偏强的因素，2-4条"],
 "down_factors": ["支持A股科技低开/偏弱的因素，2-4条"]
}
up_prob 与 down_prob 之和应等于100。`;

const FAILED_SUMMARY =
  "模型本次未能给出可解析结论。下方纸带仍记录当前快照，可稍后刷新再试。";
const NO_KEY_SUMMARY = "未配置 LLM_API_KEY，研判未出。";

function failedPred(summary = FAILED_SUMMARY): Pred {
  return {
    direction: "未能预测",
    up_prob: null,
    down_prob: null,
    confidence: "",
    summary,
    up_factors: [],
    down_factors: [],
  };
}

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-cron-secret, content-type, authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const PLACEHOLDER = `<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>盘前电讯</title>
<style>
html,body{background:#FBF9F4;color:#1C1915;font-family:'PingFang SC','Microsoft YaHei',sans-serif;
  margin:0;padding:40px 20px;overflow-x:hidden}
.t{font-family:'Noto Serif SC','SimSun',serif;font-weight:900;letter-spacing:.14em;font-size:1.75rem;
  border-bottom:3px double #1C1915;padding-bottom:14px}
p{color:rgba(28,25,21,.72);max-width:52ch;line-height:1.65}
</style></head>
<body>
<div class="t">盘前电讯</div>
<p>尚无快照。工作日 07:30-09:29 将自动生成；也可持令牌 POST ?force=1。</p>
</body></html>
`;


function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { ...CORS, "Content-Type": "text/html; charset=utf-8" },
  });
}

function toFloat(value: unknown): number | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (s === "" || s === "--") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function roundPct(v: number | null): number | null {
  if (v == null) return null;
  return Math.round(v * 100) / 100;
}

function metaOf(qid: string): [string, string] {
  return META[qid] ?? [qid, ""];
}

function item(
  qid: string,
  price: number | null,
  changePct: number | null,
  missing?: boolean | null,
): Quote {
  const [name, desc] = metaOf(qid);
  const miss = missing != null
    ? Boolean(missing)
    : price == null && changePct == null;
  return {
    id: qid,
    name,
    price,
    change_pct: miss ? null : roundPct(changePct),
    desc,
    missing: miss,
  };
}

type ShanghaiClock = {
  weekday: number;
  hour: number;
  minute: number;
  second: number;
  stamp: string;
  iso: string;
};

function shanghaiNow(d = new Date()): ShanghaiClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const g = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  const wdMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const hour = Number(g("hour"));
  const minute = Number(g("minute"));
  const second = Number(g("second"));
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  const ss = String(second).padStart(2, "0");
  return {
    weekday: wdMap[g("weekday")] ?? 0,
    hour,
    minute,
    second,
    stamp: `${g("year")}-${g("month")}-${g("day")} ${hh}:${mm}:${ss}`,
    iso: d.toISOString(),
  };
}

/** Weekday 07:30–09:29 inclusive, Asia/Shanghai. */
function inCronWindow(d = new Date()): boolean {
  const t = shanghaiNow(d);
  if (t.weekday === 0 || t.weekday === 6) return false;
  const mins = t.hour * 60 + t.minute;
  return mins >= 7 * 60 + 30 && mins <= 9 * 60 + 29;
}

function decodeSinaBytes(buf: ArrayBuffer): string {
  for (const enc of ["gb18030", "gbk", "gb2312", "utf-8"]) {
    try {
      return new TextDecoder(enc).decode(buf);
    } catch {
      // encoding not available in this runtime
    }
  }
  return new TextDecoder().decode(buf);
}

function yahooQuote(symbol: string): string {
  // Match urllib.parse.quote(symbol, safe="") so "^N225" and "." are encoded.
  return encodeURIComponent(symbol).replace(/[!'()*]/g, (c) =>
    "%" + c.charCodeAt(0).toString(16).toUpperCase()
  ).replace(/\./g, "%2E");
}

function parseGb(fields: string[]): [number | null, number | null] {
  if (!fields || fields.length < 3) return [null, null];
  return [toFloat(fields[1]), toFloat(fields[2])];
}

function parseHf(fields: string[]): [number | null, number | null] {
  if (!fields || fields.length < 8) return [null, null];
  const price = toFloat(fields[0]);
  const prev = toFloat(fields[7]);
  if (price == null || prev == null || prev === 0) return [price, null];
  return [price, (price - prev) / prev * 100];
}

function parseFxCnh(fields: string[]): [number | null, number | null] {
  if (!fields || fields.length < 11) return [null, null];
  return [toFloat(fields[1]), toFloat(fields[10])];
}

function parseSinaCode(
  code: string,
  fields: string[],
): [number | null, number | null] {
  if (!fields) return [null, null];
  if (code.startsWith("gb_")) return parseGb(fields);
  if (code.startsWith("hf_")) return parseHf(fields);
  if (code === "fx_susdcnh") return parseFxCnh(fields);
  return [null, null];
}

async function fetchSina(): Promise<Record<string, string[]>> {
  const url = SINA_URL + SINA_CODES.join(",");
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Referer: SINA_REFERER },
      signal: AbortSignal.timeout(TIMEOUT_SINA_MS),
    });
    if (!res.ok) return {};
    const text = decodeSinaBytes(await res.arrayBuffer());
    const out: Record<string, string[]> = {};
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || !line.includes("=")) continue;
      const eq = line.indexOf("=");
      const left = line.slice(0, eq);
      const right = line.slice(eq + 1);
      const code = left.replace("var hq_str_", "").trim();
      const payload = right.trim().replace(/;$/, "").trim().replace(/^"|"$/g, "");
      if (!payload) continue;
      out[code] = payload.split(",").map((p) => p.trim());
    }
    return out;
  } catch {
    return {};
  }
}

async function fetchYahooChart(
  symbol: string,
): Promise<[number | null, number | null]> {
  const url = YAHOO_CHART.replace("{symbol}", yahooQuote(symbol));
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_YAHOO_MS),
    });
    if (!res.ok) return [null, null];
    const data = await res.json();
    const meta = (((data || {}).chart || {}).result || [null])[0];
    if (!meta) return [null, null];
    const m = meta.meta || {};
    const price = toFloat(m.regularMarketPrice);
    const prev = toFloat(m.chartPreviousClose);
    if (price == null || prev == null || prev === 0) return [price, null];
    return [price, (price - prev) / prev * 100];
  } catch {
    return [null, null];
  }
}

function fromSinaMap(quotes: Record<string, string[]>, qid: string): Quote {
  const fields = quotes[qid];
  if (!fields) return item(qid, null, null, true);
  const [price, pct] = parseSinaCode(qid, fields);
  if (price == null && pct == null) return item(qid, null, null, true);
  return item(qid, price, pct, false);
}

async function fetchAll(): Promise<{
  sectors: Group[];
  macroGroups: Group[];
  fetchTime: string;
  snapshotAt: string;
  catalog: Record<string, Quote>;
}> {
  const [quotes, hynix, nikkei] = await Promise.all([
    fetchSina(),
    fetchYahooChart("000660.KS"),
    fetchYahooChart("^N225"),
  ]);
  const catalog: Record<string, Quote> = {};
  for (const code of SINA_CODES) {
    catalog[code] = fromSinaMap(quotes, code);
  }
  const [hp, hc] = hynix;
  catalog[YAHOO_HYNIX] = item(YAHOO_HYNIX, hp, hc, hp == null && hc == null);
  const [np, nc] = nikkei;
  catalog[YAHOO_N225] = item(YAHOO_N225, np, nc, np == null && nc == null);

  const sectors: Group[] = SECTORS_SPEC.map(([section, ids]) => ({
    section,
    items: ids.map((i) => catalog[i] ?? item(i, null, null, true)),
  }));
  const macroGroups: Group[] = MACRO_SPEC.map(([section, ids]) => ({
    section,
    items: ids.map((i) => catalog[i] ?? item(i, null, null, true)),
  }));
  const clock = shanghaiNow();
  return {
    sectors,
    macroGroups,
    fetchTime: clock.stamp,
    snapshotAt: clock.iso,
    catalog,
  };
}

function signedPct(v: number): string {
  const body = v.toFixed(2);
  return (v >= 0 ? "+" + body : body) + "%";
}

function buildContext(sectors: Group[], macroGroups: Group[]): string {
  const lines: string[] = [];
  lines.push("【美股科技板块现价（北京时间夜盘）】");
  for (const s of sectors) {
    const parts: string[] = [];
    for (const e of s.items) {
      if (e.missing || e.change_pct == null) {
        parts.push(`${e.name}=暂无`);
      } else {
        const priceS = e.price == null ? "" : String(e.price);
        parts.push(`${e.name} ${priceS} (${signedPct(e.change_pct)})`);
      }
    }
    lines.push(`- ${s.section}: ` + parts.join("；"));
  }
  lines.push("");
  lines.push("【日内核心指标（夜盘，含韩日）】");
  for (const g of macroGroups) {
    for (const e of g.items) {
      const note = e.desc || "";
      if (e.missing || e.change_pct == null) {
        lines.push(`- ${e.name}: 暂无 ｜含义:${note}`);
        continue;
      }
      const priceS = e.price == null ? "" : String(e.price);
      lines.push(
        `- ${e.name}: ${priceS} (${signedPct(e.change_pct)}) ｜含义:${note}`,
      );
    }
  }
  return lines.join("\n");
}

function stripTicks(s: string): string {
  let i = 0;
  let j = s.length;
  while (i < j && s[i] === "`") i++;
  while (j > i && s[j - 1] === "`") j--;
  return s.slice(i, j);
}

function parsePrediction(content: string | null | undefined): Record<string, unknown> | null {
  let text = (content || "").trim();
  if (text.startsWith("```")) {
    text = stripTicks(text).trim();
    if (text.toLowerCase().startsWith("json")) text = text.slice(4).trim();
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    // fall through
  }
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalize(pred: Record<string, unknown> | null): Pred {
  if (!pred || typeof pred !== "object") return failedPred();
  const out: Pred = {
    ...failedPred(),
    direction: String(pred.direction ?? ""),
    up_prob: pred.up_prob as number | null,
    down_prob: pred.down_prob as number | null,
    confidence: String(pred.confidence ?? ""),
    summary: pred.summary == null ? "" : String(pred.summary),
    up_factors: [],
    down_factors: [],
  };
  const direction = String(out.direction || "").trim();
  if (!["高开", "平开", "低开"].includes(direction)) return failedPred();
  out.direction = direction;
  const conf = String(out.confidence || "").trim();
  out.confidence = ["高", "中", "低"].includes(conf) ? conf : "中";
  try {
    const up = Number(pred.up_prob);
    const dn = Number(pred.down_prob);
    if (!Number.isFinite(up) || !Number.isFinite(dn)) return failedPred();
    if (up + dn > 0) {
      const tot = up + dn;
      out.up_prob = Math.round(up / tot * 100);
      out.down_prob = Math.round(dn / tot * 100);
      if (out.up_prob + out.down_prob !== 100) {
        out.down_prob = 100 - out.up_prob;
      }
    } else {
      return failedPred();
    }
  } catch {
    return failedPred();
  }
  let upF = pred.up_factors ?? [];
  let dnF = pred.down_factors ?? [];
  if (!Array.isArray(upF)) upF = [String(upF)];
  if (!Array.isArray(dnF)) dnF = [String(dnF)];
  out.up_factors = (upF as unknown[]).map((x) => String(x));
  out.down_factors = (dnF as unknown[]).map((x) => String(x));
  out.summary = String(pred.summary ?? "");
  return out;
}

async function callLlm(context: string): Promise<string> {
  const endpoint = (Deno.env.get("LLM_ENDPOINT") || DEFAULT_ENDPOINT).trim();
  const key = (Deno.env.get("LLM_API_KEY") || "").trim();
  const model = (Deno.env.get("LLM_MODEL") || DEFAULT_MODEL).trim();
  const payload = {
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: "以下是当前夜盘实时数据：\n\n" + context },
    ],
  };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content as string;
}

async function predict(): Promise<{
  pred: Pred;
  sectors: Group[];
  macroGroups: Group[];
  fetchTime: string;
  snapshotAt: string;
  catalog: Record<string, Quote>;
}> {
  const fetched = await fetchAll();
  const context = buildContext(fetched.sectors, fetched.macroGroups);
  const key = (Deno.env.get("LLM_API_KEY") || "").trim();
  if (!key) {
    return { ...fetched, pred: failedPred(NO_KEY_SUMMARY) };
  }
  try {
    const raw = await callLlm(context);
    const pred = normalize(parsePrediction(raw));
    return { ...fetched, pred };
  } catch {
    return { ...fetched, pred: failedPred() };
  }
}


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

function renderPage(
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


function sbUrl(): string {
  return (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
}

function sbKey(): string {
  const legacy = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return (parsed.default || parsed.service_role || Object.values(parsed)[0] || "").trim();
  } catch {
    return "";
  }
}

function restAuthHeaders(): Record<string, string> {
  const key = sbKey();
  return {
    apikey: key,
    Authorization: "Bearer " + key,
    Accept: "application/json",
  };
}

type SnapshotRow = {
  html: string;
  snapshot_at: string | null;
  pred: Pred | null;
  updated_at?: string | null;
};

async function loadSnapshot(): Promise<SnapshotRow | null> {
  const base = sbUrl();
  if (!base || !sbKey()) return null;
  const url =
    `${base}/rest/v1/tape_snapshot?id=eq.1&select=html,snapshot_at,pred,updated_at`;
  const res = await fetch(url, { headers: restAuthHeaders() });
  if (!res.ok) return null;
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0] as SnapshotRow;
}

async function upsertSnapshot(
  html: string,
  snapshotAt: string,
  pred: Pred,
): Promise<void> {
  const base = sbUrl();
  const key = sbKey();
  if (!base || !key) throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
  const updatedAt = new Date().toISOString();
  const body = JSON.stringify({
    id: 1,
    html,
    snapshot_at: snapshotAt,
    pred,
    updated_at: updatedAt,
  });
  const headers = {
    ...restAuthHeaders(),
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=representation",
  };
  let res = await fetch(`${base}/rest/v1/tape_snapshot?id=eq.1`, {
    method: "PATCH",
    headers,
    body,
  });
  let patched = false;
  if (res.ok) {
    const rows = await res.json().catch(() => []);
    patched = Array.isArray(rows) && rows.length > 0;
  }
  if (!patched) {
    res = await fetch(`${base}/rest/v1/tape_snapshot?on_conflict=id`, {
      method: "POST",
      headers,
      body,
    });
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`db upsert ${res.status} ${text.slice(0, 300)}`);
  }
}

async function generateTape(): Promise<{
  html: string;
  snapshot_at: string;
  pred: Pred;
  hynix: Quote;
}> {
  const { pred, sectors, macroGroups, fetchTime, snapshotAt, catalog } =
    await predict();
  const html = renderPage(pred, sectors, macroGroups, fetchTime);
  return {
    html,
    snapshot_at: snapshotAt,
    pred,
    hynix: catalog[YAHOO_HYNIX],
  };
}

async function runRefresh(): Promise<{
  html: string;
  snapshot_at: string;
  pred: Pred;
  hynix: Quote;
}> {
  const result = await generateTape();
  await upsertSnapshot(result.html, result.snapshot_at, result.pred);
  return result;
}

function cronAuthorized(req: Request): "ok" | "missing_secret" | "unauthorized" {
  const expected = (Deno.env.get("CRON_SECRET") || "").trim();
  if (!expected) return "missing_secret";
  const got = (req.headers.get("x-cron-secret") || "").trim();
  if (got !== expected) return "unauthorized";
  return "ok";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(req.url);

  if (req.method === "POST") {
    const auth = cronAuthorized(req);
    if (auth === "missing_secret") {
      return jsonResponse({ ok: false, error: "CRON_SECRET is not configured" }, 503);
    }
    if (auth === "unauthorized") {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    }
    const force = url.searchParams.get("force") === "1";
    if (!force && !inCronWindow()) {
      return jsonResponse({
        ok: true,
        skipped: true,
        reason: "outside_window",
      });
    }
    try {
      const result = await runRefresh();
      return jsonResponse({
        ok: true,
        snapshot_at: result.snapshot_at,
        direction: result.pred.direction,
        up_prob: result.pred.up_prob,
        down_prob: result.pred.down_prob,
        hynix: result.hynix,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonResponse({ ok: false, error: msg }, 502);
    }
  }

  // GET (and any non-POST): serve latest HTML. Empty row -> refresh then return.
  try {
    const row = await loadSnapshot();
    if (row && typeof row.html === "string" && row.html.trim() !== "") {
      return htmlResponse(row.html);
    }
    try {
      const result = await generateTape();
      try {
        await upsertSnapshot(result.html, result.snapshot_at, result.pred);
      } catch {
        // still return the tape if persistence fails
      }
      return htmlResponse(result.html);
    } catch {
      return htmlResponse(PLACEHOLDER);
    }
  } catch {
    return htmlResponse(PLACEHOLDER);
  }
});
