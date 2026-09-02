import {
  DEFAULT_ENDPOINT, DEFAULT_MODEL, LLM_TIMEOUT_MS,
  type Group, type Pred, type Quote,
  fetchAll, failedPred, NO_KEY_SUMMARY, SYSTEM_PROMPT,
} from "./quotes.ts";

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

export async function predict(): Promise<{
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
