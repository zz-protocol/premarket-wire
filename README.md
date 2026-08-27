# 盘前电讯

清晨从行情电讯机打出的记录单：用美股夜盘、韩日指标与宏观纸带，推演 A 股科技开盘倾向（高开 / 平开 / 低开）。

暖白纸面、油墨黑、一枚红章。不是暗色仪表盘。

## 本地运行

需要 Python 3.11+。

```bash
cd premarket-wire
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env，填入 LLM_API_KEY 与 REFRESH_TOKEN
```

离线生成一页 HTML（不启动服务）：

```bash
export $(grep -v '^#' .env | xargs)
python market_dashboard.py
# 打开 dashboard.html 或 data/dashboard.html
```

托管路径：

```bash
export $(grep -v '^#' .env | xargs)
python server.py
# 或
uvicorn server:app --host 0.0.0.0 --port 8080
```

- `GET /` 最新快照 HTML
- `GET /api/snapshot` 快照 JSON
- `POST /api/refresh` 请求头 `X-Refresh-Token: $REFRESH_TOKEN`，抓数 + 研判 + 落盘
- 盘中冻结窗口内 POST 返回 `{frozen: true}`；加 `?force=1` 且带令牌可强制刷新
- `GET /health` 当前窗口与是否已有快照

单测（冻结窗口，构造 datetime，不打网）：

```bash
PYTHONPATH=. python -m unittest tests.test_freeze
```

## Zeabur Docker 部署

1. 用本仓库根目录的 `Dockerfile` 创建服务（构建上下文即本目录）。
2. Zeabur 会注入 `PORT`，镜像默认监听 `0.0.0.0:$PORT`（缺省 8080）。
3. 在控制台配置环境变量（不要写进镜像）：
   - `LLM_API_KEY` 必填才会出研判；缺省时纸带仍生成，电头显示「研判未出」
   - `LLM_ENDPOINT` 缺省 `https://api.edgefn.net/v1/chat/completions`
   - `LLM_MODEL` 缺省 `DeepSeek-V4-Flash-0731`
   - `REFRESH_TOKEN` 必填，否则刷新接口 503
   - `ENABLE_SCHEDULER=1` 在容器内用 APScheduler 按窗口自动刷新；多实例时请改为 0，改用平台 Cron 调 `POST /api/refresh`
4. 文件系统默认非持久。重启后 `data/` 会空，启动时若无快照会尝试 bootstrap 抓一次。若要保留上一份纸带，请挂载持久卷到 `/app/data`。
5. 平台若拦截出站，需放行 `hq.sinajs.cn`、`query1.finance.yahoo.com` 以及 `LLM_ENDPOINT` 主机。

## 刷新窗口（北京时间）

| 窗口 | 行为 |
| --- | --- |
| 工作日 07:30–09:29 | 高频，每 15 分钟 |
| 工作日 09:30–21:29 | 冻结。POST 空操作 `{frozen:true}`，除非 `?force=1` + 令牌 |
| 工作日 21:30–04:00 | 低频，整点（含 21:30） |
| 工作日 04:00–07:29 | 跳过 |
| 周末 | 跳过，除非 force |

## 行情清单

夜盘核心六行：纳指100期货、SOX、CNQQ、日经225、SK海力士、离岸人民币。

板块色带（不再增名）：

- 光模块：COHR、LITE
- 通信：AVGO
- 算力：NVDA、AMD
- 半导体/晶圆：TSM
- 存储：MU、SK海力士、WDC
- 创新药：IBB
- 机器人：TSLA
- 商业航天：RKLB
- 电力：GEV、ETN、VRT

VXX / TLT 只出现在下方宏观纸带。A 股代理为美股上市的沪深300 ETF（ASHR）；本页拿不到 MSCI A50 期货，脚注已标明。日经225 与 SK海力士走 Yahoo，不用新浪 `int_nikkei`（该源会过期）。缺报价一律写「暂无」，不删行、不编数字。

## 免责

本页由模型基于公开快照推演，仅供参考，不构成投资建议。数据是生成时刻的切片，不是连续实时行情。
