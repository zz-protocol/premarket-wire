# premarket (盘前电讯) Edge Function

Serves the paper-tape HTML from Postgres and refreshes it on an authenticated cron POST.
Do not put secrets in this repo; set them in the Supabase function environment.

## Environment variables

| Variable | Required | Default / notes |
| --- | --- | --- |
| `CRON_SECRET` | yes (POST) | Must match request header `x-cron-secret`. Empty secret is never accepted. |
| `SUPABASE_URL` | yes | Project URL, e.g. `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-side only. Used to upsert `public.tape_snapshot`. Never expose to the browser. |
| `LLM_API_KEY` | for verdict | If missing, the tape still renders; summary is `未配置 LLM_API_KEY，研判未出。` |
| `LLM_ENDPOINT` | no | `https://api.edgefn.net/v1/chat/completions` |
| `LLM_MODEL` | no | `DeepSeek-V4-Flash-0731` |

`verify_jwt` can be off; POST still checks `CRON_SECRET`.

## Behaviour

- **GET** (or any method without the cron header): return latest `tape_snapshot.html` as `text/html; charset=utf-8`. If the row is empty, run a refresh then return HTML. CORS `*`.
- **POST** + `x-cron-secret: $CRON_SECRET`: fetch quotes, call the LLM, render HTML, upsert `id=1`. JSON `{ok, snapshot_at, direction, up_prob, down_prob, hynix}`.
- **Cron window** (`Asia/Shanghai`): weekdays **07:30–09:29 inclusive**. Outside that window POST skips fetch/LLM unless `?force=1`, and returns `{ok:true, skipped:true, reason:"outside_window"}`.
- **OPTIONS**: CORS preflight.

## Decode caveat

Sina payloads are GB18030. This function tries `TextDecoder("gb18030")`, then `gbk` / `gb2312` / `utf-8`. Deno/V8 on Supabase Edge may not ship `gb18030`. Quote prices and percents are ASCII, and display names come from the built-in META map (not Sina’s Chinese name field), so a UTF-8 fallback still parses numbers. Only unused payload names would be garbled.
