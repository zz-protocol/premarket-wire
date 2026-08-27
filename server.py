# -*- coding: utf-8 -*-
"""
Hosted path: uvicorn server:app
GET  /              latest snapshot HTML
POST /api/refresh   header X-Refresh-Token, fetch+predict+save
GET  /api/snapshot  JSON
"""
from __future__ import annotations

import json
import os
import threading
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.responses import HTMLResponse, JSONResponse

import ai_predict
import market_dashboard as dash
from refresh_policy import allow_refresh, now_shanghai, refresh_mode, should_run_scheduled

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
HTML_PATH = DATA_DIR / "dashboard.html"
SNAP_PATH = DATA_DIR / "snapshot.json"

REFRESH_LOCK = threading.Lock()
_scheduler = None

PLACEHOLDER = """<!DOCTYPE html>
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
<p>尚无快照。工作日 07:30-09:29 将自动生成；也可持令牌 POST /api/refresh?force=1。</p>
</body></html>
"""


def _token() -> str:
    return (os.environ.get("REFRESH_TOKEN") or "").strip()


def _check_token(header_val: str | None) -> None:
    expected = _token()
    if not expected:
        raise HTTPException(status_code=503, detail="REFRESH_TOKEN is not configured")
    if not header_val or header_val != expected:
        raise HTTPException(status_code=401, detail="invalid refresh token")


def do_refresh() -> dict:
    """Fetch, predict, persist. Caller holds policy checks."""
    with REFRESH_LOCK:
        pred, context, sectors, macro_groups, fetch_time = ai_predict.predict()
        dash.write_outputs(pred, sectors, macro_groups, fetch_time, context)
        return {
            "ok": True,
            "fetch_time": fetch_time,
            "direction": pred.get("direction"),
            "up_prob": pred.get("up_prob"),
            "down_prob": pred.get("down_prob"),
            "confidence": pred.get("confidence"),
        }


app = FastAPI(title="盘前电讯", docs_url=None, redoc_url=None)


@app.get("/", response_class=HTMLResponse)
def index():
    if HTML_PATH.exists():
        return HTMLResponse(HTML_PATH.read_text(encoding="utf-8"))
    return HTMLResponse(PLACEHOLDER)


@app.get("/health")
def health():
    return {
        "ok": True,
        "mode": refresh_mode(),
        "has_snapshot": HTML_PATH.exists(),
        "now": now_shanghai().strftime("%Y-%m-%d %H:%M:%S"),
    }


@app.get("/api/snapshot")
def snapshot():
    if not SNAP_PATH.exists():
        return JSONResponse({"ok": False, "reason": "no snapshot"}, status_code=404)
    data = json.loads(SNAP_PATH.read_text(encoding="utf-8"))
    return data


@app.post("/api/refresh")
def refresh(
    force: int = Query(0),
    x_refresh_token: str | None = Header(default=None, alias="X-Refresh-Token"),
):
    _check_token(x_refresh_token)
    forced = bool(force)
    allowed, reason = allow_refresh(force=forced)
    if not allowed:
        payload = {"frozen": True, "reason": reason, "mode": refresh_mode()}
        return JSONResponse(payload)
    result = do_refresh()
    result["mode"] = reason
    result["forced"] = forced
    return result


def _scheduled_tick():
    if not should_run_scheduled():
        return
    try:
        do_refresh()
    except Exception:
        pass


def _maybe_start_scheduler():
    global _scheduler
    flag = (os.environ.get("ENABLE_SCHEDULER") or "").strip()
    if flag != "1":
        return
    from apscheduler.schedulers.background import BackgroundScheduler
    from refresh_policy import SHANGHAI

    _scheduler = BackgroundScheduler(timezone=SHANGHAI)
    _scheduler.add_job(
        _scheduled_tick,
        "cron",
        minute="0,15,30,45",
        id="premarket-tick",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()


@app.on_event("startup")
def on_startup():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    _maybe_start_scheduler()
    if not HTML_PATH.exists():
        # Bootstrap so a fresh deploy is not a blank page.
        try:
            do_refresh()
        except Exception:
            pass


@app.on_event("shutdown")
def on_shutdown():
    global _scheduler
    if _scheduler is not None:
        try:
            _scheduler.shutdown(wait=False)
        except Exception:
            pass
        _scheduler = None


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT") or 8080)
    uvicorn.run("server:app", host="0.0.0.0", port=port)
