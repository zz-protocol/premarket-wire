import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  CORS, PLACEHOLDER, type Pred, type Quote, YAHOO_HYNIX,
  inCronWindow, jsonResponse, htmlResponse,
} from "./quotes.ts";
import { predict } from "./predict.ts";
import { renderPage } from "./render.ts";

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
