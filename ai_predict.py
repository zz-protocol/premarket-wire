# -*- coding: utf-8 -*-
"""
AI 预测层. OpenAI-compatible POST. Keys from env only, never from committed files.
JSON: direction, up_prob, down_prob, confidence, summary, up_factors, down_factors.
up+down=100. On failure the tape still renders and the verdict is 研判未出.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

import market_data as md

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

DEFAULT_ENDPOINT = "https://api.edgefn.net/v1/chat/completions"
DEFAULT_MODEL = "DeepSeek-V4-Flash-0731"
LLM_TIMEOUT = 60

FAILED_PRED = {
    "direction": "未能预测",
    "up_prob": None,
    "down_prob": None,
    "confidence": "",
    "summary": "模型本次未能给出可解析结论。下方纸带仍记录当前快照，可稍后刷新再试。",
    "up_factors": [],
    "down_factors": [],
}

SYSTEM_PROMPT = """你是A股开盘前的美股与亚太映射分析助手。你会收到美股科技板块、韩日指标、以及日内核心宏观指标的夜盘快照。
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
up_prob 与 down_prob 之和应等于100。"""


def load_config(path=None):
    """Env only. path is ignored; kept so older callers do not break."""
    del path
    return {
        "api": {
            "key": (os.environ.get("LLM_API_KEY") or "").strip(),
            "endpoint": (os.environ.get("LLM_ENDPOINT") or DEFAULT_ENDPOINT).strip(),
            "model": (os.environ.get("LLM_MODEL") or DEFAULT_MODEL).strip(),
        }
    }


def build_context(sectors, macro_groups):
    lines = []
    lines.append("【美股科技板块现价（北京时间夜盘）】")
    for s in sectors:
        parts = []
        for e in s["items"]:
            if e.get("missing") or e.get("change_pct") is None:
                parts.append(f"{e['name']}=暂无")
            else:
                price = e.get("price")
                price_s = "" if price is None else str(price)
                parts.append(f"{e['name']} {price_s} ({e['change_pct']:+.2f}%)")
        lines.append(f"- {s['section']}: " + "；".join(parts))
    lines.append("")
    lines.append("【日内核心指标（夜盘，含韩日）】")
    for g in macro_groups:
        for e in g["items"]:
            note = e.get("desc", "")
            if e.get("missing") or e.get("change_pct") is None:
                lines.append(f"- {e['name']}: 暂无 ｜含义:{note}")
                continue
            price = e.get("price")
            price_s = "" if price is None else str(price)
            lines.append(f"- {e['name']}: {price_s} ({e['change_pct']:+.2f}%) ｜含义:{note}")
    return "\n".join(lines)


def call_llm(context, config, timeout=LLM_TIMEOUT):
    endpoint = config["api"]["endpoint"]
    key = config["api"]["key"]
    model = config["api"]["model"]
    payload = {
        "model": model,
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "以下是当前夜盘实时数据：\n\n" + context},
        ],
    }
    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
        },
    )
    resp = urllib.request.urlopen(req, timeout=timeout).read().decode("utf-8")
    data = json.loads(resp)
    return data["choices"][0]["message"]["content"]


def parse_prediction(content):
    text = (content or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        return json.loads(text)
    except Exception:
        pass
    try:
        start = text.index("{")
        end = text.rindex("}")
        return json.loads(text[start:end + 1])
    except Exception:
        return None


def _normalize(pred):
    if not pred or not isinstance(pred, dict):
        return dict(FAILED_PRED)
    out = dict(FAILED_PRED)
    out.update({k: pred.get(k, out.get(k)) for k in (
        "direction", "up_prob", "down_prob", "confidence",
        "summary", "up_factors", "down_factors",
    )})
    direction = str(out.get("direction") or "").strip()
    if direction not in ("高开", "平开", "低开"):
        return dict(FAILED_PRED)
    out["direction"] = direction
    conf = str(out.get("confidence") or "").strip()
    if conf not in ("高", "中", "低"):
        out["confidence"] = "中"
    else:
        out["confidence"] = conf
    try:
        up = float(out.get("up_prob"))
        dn = float(out.get("down_prob"))
        if up + dn > 0:
            tot = up + dn
            out["up_prob"] = int(round(up / tot * 100))
            out["down_prob"] = int(round(dn / tot * 100))
            if out["up_prob"] + out["down_prob"] != 100:
                out["down_prob"] = 100 - out["up_prob"]
        else:
            return dict(FAILED_PRED)
    except (TypeError, ValueError):
        return dict(FAILED_PRED)
    up_f = out.get("up_factors") or []
    dn_f = out.get("down_factors") or []
    if not isinstance(up_f, list):
        up_f = [str(up_f)]
    if not isinstance(dn_f, list):
        dn_f = [str(dn_f)]
    out["up_factors"] = [str(x) for x in up_f]
    out["down_factors"] = [str(x) for x in dn_f]
    out["summary"] = str(out.get("summary") or "")
    return out


def predict():
    """抓数据 -> 组装 context -> 调模型 -> (预测dict, context, sectors, macro, 抓取时间)"""
    sectors, macro_groups, fetch_time = md.fetch_all()
    context = build_context(sectors, macro_groups)
    config = load_config()
    key = config["api"]["key"]
    if not key:
        pred = dict(FAILED_PRED)
        pred["summary"] = "未配置 LLM_API_KEY，研判未出。下方纸带仍记录当前快照。"
        return pred, context, sectors, macro_groups, fetch_time
    try:
        raw = call_llm(context, config)
        pred = _normalize(parse_prediction(raw))
    except (urllib.error.URLError, TimeoutError, OSError, KeyError, json.JSONDecodeError, Exception):
        pred = dict(FAILED_PRED)
    return pred, context, sectors, macro_groups, fetch_time


if __name__ == "__main__":
    p, ctx, sec, mac, t = predict()
    print("抓取时间:", t)
    print("预测:", json.dumps(p, ensure_ascii=False, indent=2))
