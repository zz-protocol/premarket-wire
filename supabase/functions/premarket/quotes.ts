import "jsr:@supabase/functions-js/edge-runtime.d.ts";

export const SINA_URL = "https://hq.sinajs.cn/list=";
export const SINA_REFERER = "https://finance.sina.com.cn";
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
export const YAHOO_CHART =
  "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1d";

export const TIMEOUT_SINA_MS = 15_000;
export const TIMEOUT_YAHOO_MS = 15_000;
export const LLM_TIMEOUT_MS = 60_000;

export const DEFAULT_ENDPOINT = "https://api.edgefn.net/v1/chat/completions";
export const DEFAULT_MODEL = "DeepSeek-V4-Flash-0731";

export const SINA_CODES = [
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

export const YAHOO_N225 = "yahoo_n225";
export const YAHOO_HYNIX = "ks_hynix";

export const CORE_KEYS = [
  "hf_NQ",
  "gb_soxx",
  "gb_cnqq",
  YAHOO_N225,
  YAHOO_HYNIX,
  "fx_susdcnh",
] as const;

export type Quote = {
  id: string;
  name: string;
  price: number | null;
  change_pct: number | null;
  desc: string;
  missing: boolean;
};

export type Group = { section: string; items: Quote[] };

export type Pred = {
  direction: string;
  up_prob: number | null;
  down_prob: number | null;
  confidence: string;
  summary: string;
  up_factors: string[];
  down_factors: string[];
};

export const META: Record<string, [string, string]> = {
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

export const SECTORS_SPEC: [string, string[]][] = [
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

export const MACRO_SPEC: [string, string[]][] = [
  ["一、美股夜盘（最直接）", ["hf_NQ", "gb_soxx", "gb_cnqq"]],
  ["二、亚太风险偏好", [YAHOO_N225, YAHOO_HYNIX]],
  ["三、汇率（外资流向信号）", ["fx_susdcnh", "gb_uup"]],
  ["四、避险/风险情绪", ["gb_vxx", "hf_GC"]],
  ["五、商品（通胀/成本）", ["hf_CL"]],
  ["六、美债（流动性/估值）", ["gb_tlt"]],
  ["七、A股映射代理", ["gb_ashr"]],
];

export const SYSTEM_PROMPT = `你是A股开盘前的美股与亚太映射分析助手。你会收到美股科技板块、韩日指标、以及日内核心宏观指标的夜盘快照。
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

export const FAILED_SUMMARY =
  "模型本次未能给出可解析结论。下方纸带仍记录当前快照，可稍后刷新再试。";
export const NO_KEY_SUMMARY = "未配置 LLM_API_KEY，研判未出。";

export function failedPred(summary = FAILED_SUMMARY): Pred {
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

export const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-cron-secret, content-type, authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export const PLACEHOLDER = `<!DOCTYPE html>
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


export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

export function htmlResponse(html: string, status = 200): Response {
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

export function metaOf(qid: string): [string, string] {
  return META[qid] ?? [qid, ""];
}

export function item(
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

export function shanghaiNow(d = new Date()): ShanghaiClock {
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
export function inCronWindow(d = new Date()): boolean {
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

export async function fetchAll(): Promise<{
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
