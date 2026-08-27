# -*- coding: utf-8 -*-
"""
Live quotes for 盘前电讯.
Sina hq.sinajs.cn (GB18030) for US/FX/futures; Yahoo chart API for KR/JP.
Missing quote -> missing=True, never skip the row, never invent numbers.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from zoneinfo import ZoneInfo

SHANGHAI = ZoneInfo("Asia/Shanghai")

SINA_URL = "https://hq.sinajs.cn/list="
SINA_REFERER = "https://finance.sina.com.cn"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1d"

TIMEOUT_SINA = 15
TIMEOUT_YAHOO = 15

# Sina list. gb_* [0]=name [1]=price [2]=change_pct (already percent).
# hf_* price=[0] prev_close=[7] (live-verified 2026-08-27).
# fx_susdcnh percent-change is payload field [10] (already percent).
SINA_CODES = [
    "hf_NQ", "gb_soxx", "gb_cnqq", "fx_susdcnh", "gb_vxx", "gb_tlt",
    "gb_uup", "hf_CL", "hf_GC",
    "gb_nvda", "gb_tsla", "gb_mu", "gb_wdc", "gb_cohr", "gb_lite",
    "gb_ibb", "gb_rklb", "gb_gev", "gb_etn", "gb_vrt",
    "gb_tsm", "gb_avgo", "gb_amd", "gb_ashr",
]

YAHOO_N225 = "yahoo_n225"
YAHOO_HYNIX = "ks_hynix"

# Night-core six rows, in display order. VXX/TLT stay in the lower macro wire only.
CORE_KEYS = ["hf_NQ", "gb_soxx", "gb_cnqq", YAHOO_N225, YAHOO_HYNIX, "fx_susdcnh"]

# id -> (label, one-line 传导含义)
META = {
    "hf_NQ": ("纳指100期货", "直接反映美股科技情绪，A股科技联动"),
    "gb_soxx": ("SOX", "半导体是A股科技映射核心锚点"),
    "gb_cnqq": ("CNQQ", "直接追踪A+H科技，比纳指更贴近"),
    YAHOO_N225: ("日经225", "日股风险偏好，开盘前与A股科技联动"),
    YAHOO_HYNIX: ("SK海力士", "韩股存储旗舰，与美光共振/背离会导向A股存储与光模块"),
    "fx_susdcnh": ("离岸人民币", "报价下行即人民币升值，外资流入偏多"),
    "gb_vxx": ("VXX", "VXX上涨即恐慌升，避险浓则A股科技低开概率大"),
    "gb_tlt": ("TLT", "TLT上涨即美债收益率下行，利好成长股估值"),
    "gb_uup": ("UUP", "美元弱则利好新兴市场；美元强则A股承压"),
    "hf_CL": ("原油", "急涨推升通胀预期，利空整体；利好石油板块"),
    "hf_GC": ("黄金", "黄金急涨即避险升温，对风险资产偏空"),
    "gb_ashr": ("沪深300 ETF", "美股上市的A股代理，非MSCI A50期货；外资对A股大盘态度"),
    "gb_cohr": ("COHR", "美股光模块龙头，映射中际旭创、新易盛"),
    "gb_lite": ("LITE", "光模块器件，与A股光通信联动"),
    "gb_avgo": ("AVGO", "博通，网络交换与定制芯片，映射A股通信与算力"),
    "gb_nvda": ("NVDA", "算力旗舰，导向A股算力与PCB"),
    "gb_amd": ("AMD", "GPU与CPU，与英伟达共同标定算力风险偏好"),
    "gb_tsm": ("TSM", "台积电，晶圆代工锚点，映射A股半导体设备与材料"),
    "gb_mu": ("MU", "美光，存储周期旗舰，与海力士对照"),
    "gb_wdc": ("WDC", "西部数据，存储与硬盘，映射A股存储"),
    "gb_ibb": ("IBB", "美股创新药ETF，映射A股创新药"),
    "gb_tsla": ("TSLA", "人形机器人与智驾情绪，映射A股机器人"),
    "gb_rklb": ("RKLB", "商业航天，映射A股商业航天链条"),
    "gb_gev": ("GEV", "发电设备，映射A股电力设备"),
    "gb_etn": ("ETN", "电气设备，数据中心供电相关"),
    "gb_vrt": ("VRT", "液冷与电源，映射A股算力电力"),
}

SECTORS_SPEC = [
    ("光模块", ["gb_cohr", "gb_lite"]),
    ("通信", ["gb_avgo"]),
    ("算力", ["gb_nvda", "gb_amd"]),
    ("半导体/晶圆", ["gb_tsm"]),
    ("存储", ["gb_mu", YAHOO_HYNIX, "gb_wdc"]),
    ("创新药", ["gb_ibb"]),
    ("机器人", ["gb_tsla"]),
    ("商业航天", ["gb_rklb"]),
    ("电力", ["gb_gev", "gb_etn", "gb_vrt"]),
]

MACRO_SPEC = [
    ("一、美股夜盘（最直接）", ["hf_NQ", "gb_soxx", "gb_cnqq"]),
    ("二、亚太风险偏好", [YAHOO_N225, YAHOO_HYNIX]),
    ("三、汇率（外资流向信号）", ["fx_susdcnh", "gb_uup"]),
    ("四、避险/风险情绪", ["gb_vxx", "hf_GC"]),
    ("五、商品（通胀/成本）", ["hf_CL"]),
    ("六、美债（流动性/估值）", ["gb_tlt"]),
    ("七、A股映射代理", ["gb_ashr"]),
]


def _f(value):
    try:
        if value is None:
            return None
        s = str(value).strip()
        if s == "" or s == "--":
            return None
        return float(s)
    except (TypeError, ValueError):
        return None


def _round_pct(v):
    if v is None:
        return None
    return round(v, 2)


def _item(qid, price, change_pct, missing=None):
    name, desc = META.get(qid, (qid, ""))
    miss = bool(missing) if missing is not None else (price is None and change_pct is None)
    return {
        "id": qid,
        "name": name,
        "price": price,
        "change_pct": _round_pct(change_pct) if not miss else None,
        "desc": desc,
        "missing": miss,
    }


def _headers():
    return {"User-Agent": USER_AGENT, "Referer": SINA_REFERER}


def fetch_sina(codes=None):
    """Return {code: raw comma-fields list}. Empty payload => absent key."""
    codes = codes or SINA_CODES
    url = SINA_URL + ",".join(codes)
    req = urllib.request.Request(url, headers=_headers())
    try:
        raw = urllib.request.urlopen(req, timeout=TIMEOUT_SINA).read()
        text = raw.decode("gb18030", errors="replace")
    except (urllib.error.URLError, TimeoutError, OSError):
        return {}
    out = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or "=" not in line:
            continue
        left, right = line.split("=", 1)
        code = left.replace("var hq_str_", "").strip()
        payload = right.strip().strip(";").strip().strip('"')
        if not payload:
            continue
        out[code] = [p.strip() for p in payload.split(",")]
    return out


def parse_gb(fields):
    """gb_* : [0]=name [1]=price [2]=change_pct already in percent."""
    if not fields or len(fields) < 3:
        return None, None
    return _f(fields[1]), _f(fields[2])


def parse_hf(fields):
    """hf_* : price[0], previous close/settle[7]. Live-verified, do not guess."""
    if not fields or len(fields) < 8:
        return None, None
    price = _f(fields[0])
    prev = _f(fields[7])
    if price is None or prev is None or prev == 0:
        return price, None
    return price, (price - prev) / prev * 100.0


def parse_fx_cnh(fields):
    """fx_susdcnh: percent-change is in the payload (field 10, already percent).
    CNH quote down = RMB up = constructive; we do not invert the printed number.
    """
    if not fields or len(fields) < 11:
        return None, None
    price = _f(fields[1])
    pct = _f(fields[10])
    return price, pct


def parse_sina_code(code, fields):
    if not fields:
        return None, None
    if code.startswith("gb_"):
        return parse_gb(fields)
    if code.startswith("hf_"):
        return parse_hf(fields)
    if code == "fx_susdcnh":
        return parse_fx_cnh(fields)
    return None, None


def fetch_yahoo_chart(symbol):
    """% = (regularMarketPrice - chartPreviousClose) / chartPreviousClose * 100"""
    quoted = urllib.parse.quote(symbol, safe="")
    url = YAHOO_CHART.format(symbol=quoted)
    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    try:
        raw = urllib.request.urlopen(req, timeout=TIMEOUT_YAHOO).read().decode("utf-8")
        data = json.loads(raw)
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError, ValueError):
        return None, None
    try:
        meta = (((data or {}).get("chart") or {}).get("result") or [None])[0]
        if not meta:
            return None, None
        meta = meta.get("meta") or {}
        price = _f(meta.get("regularMarketPrice"))
        prev = _f(meta.get("chartPreviousClose"))
        if price is None or prev is None or prev == 0:
            return price, None
        return price, (price - prev) / prev * 100.0
    except (TypeError, AttributeError, IndexError, KeyError):
        return None, None


def fetch_yahoo_pair():
    hynix = (None, None)
    nikkei = (None, None)

    def _h():
        return fetch_yahoo_chart("000660.KS")

    def _n():
        return fetch_yahoo_chart("^N225")

    with ThreadPoolExecutor(max_workers=2) as ex:
        fh = ex.submit(_h)
        fn = ex.submit(_n)
        try:
            hynix = fh.result()
        except Exception:
            hynix = (None, None)
        try:
            nikkei = fn.result()
        except Exception:
            nikkei = (None, None)
    return hynix, nikkei


def _from_sina_map(quotes, qid):
    fields = quotes.get(qid)
    if not fields:
        return _item(qid, None, None, missing=True)
    price, pct = parse_sina_code(qid, fields)
    if price is None and pct is None:
        return _item(qid, None, None, missing=True)
    return _item(qid, price, pct, missing=False)


def fetch_all():
    """Return (sectors, macro_groups, fetch_time_str). Never omit a configured row."""
    quotes = fetch_sina()
    hynix, nikkei = fetch_yahoo_pair()

    catalog = {}
    for code in SINA_CODES:
        catalog[code] = _from_sina_map(quotes, code)

    hp, hc = hynix
    catalog[YAHOO_HYNIX] = _item(
        YAHOO_HYNIX, hp, hc, missing=(hp is None and hc is None)
    )
    np, nc = nikkei
    catalog[YAHOO_N225] = _item(
        YAHOO_N225, np, nc, missing=(np is None and nc is None)
    )

    sectors = []
    for section, ids in SECTORS_SPEC:
        sectors.append({"section": section, "items": [catalog[i] for i in ids]})

    macro_groups = []
    for section, ids in MACRO_SPEC:
        macro_groups.append({"section": section, "items": [catalog[i] for i in ids]})

    fetch_time = datetime.now(SHANGHAI).strftime("%Y-%m-%d %H:%M:%S")
    return sectors, macro_groups, fetch_time


def flatten_quotes(sectors, macro_groups):
    seen = {}
    for g in list(macro_groups) + list(sectors):
        for e in g["items"]:
            seen[e["id"]] = e
    return seen


if __name__ == "__main__":
    secs, macs, ts = fetch_all()
    print("fetch_time", ts)
    catalog = flatten_quotes(secs, macs)
    for k in CORE_KEYS + ["gb_tsm", "gb_avgo", "gb_amd", YAHOO_HYNIX, YAHOO_N225]:
        e = catalog.get(k, {})
        print(f"{k:14} {e.get('name','')}  price={e.get('price')}  chg={e.get('change_pct')}  missing={e.get('missing')}")
