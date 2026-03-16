import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Single-tier compact navigation graph prompt (~800-1200 tokens output)
const SYSTEM_PROMPT = `Return JSON ONLY. No markdown, no explanation, no commentary.

You are the Outline Architect for "The Gloam Courts," a dark-comedy gothic gamebook.

RULES:
- 10-15 sections. Section numbers n=1..20.
- 2 choices each (except endings/deaths: 0 choices).
- 2 endings. Mark exactly one true_end.
- 1 twist in act II.
- Beats: evocative, max 30 chars. Labels: max 20 chars.
- All nx must point to valid n values. ZERO broken links.
- start_section MUST be 1. First section plate=true.
- At least 1 death section (death=true, 0 choices).

JSON:
{"title":"str","start_section":1,"sections":[{"n":1,"beat":"str","act":"I","plate":true,"end":false,"true_end":false,"twist":false,"death":false,"choices":[{"id":"a","label":"str","nx":2},{"id":"b","label":"str","nx":3}]}]}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { seed } = await req.json();
    if (!seed) {
      return new Response(JSON.stringify({ error: "seed is required" }), { status: 400, headers: corsHeaders });
    }

    // Rate limit: max 10 outlines per day
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    const { count } = await supabase
      .from("runs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneDayAgo);

    if ((count || 0) >= 10) {
      return new Response(JSON.stringify({ error: "rate_limited", message: "Maximum 10 runs per day." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: corsHeaders });
    }

    const wallClockStart = Date.now();

    const userPrompt = `Navigation graph for seed: "${seed}". 12-20 sections, 2 choices each except endings. Evocative gothic beats. JSON only.`;

    console.log(`[OUTLINE] Starting generation for: ${seed}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);

    let outline: any = null;
    let failureReason: string | null = null;

    try {
      outline = await callAI(LOVABLE_API_KEY, SYSTEM_PROMPT, userPrompt, "google/gemini-2.5-flash-lite", 4096, controller.signal);
      const elapsed = Date.now() - wallClockStart;
      console.log(`[OUTLINE] AI returned in ${elapsed}ms, sections: ${outline?.sections?.length}`);
    } catch (err: any) {
      const elapsed = Date.now() - wallClockStart;
      failureReason = err.name === "AbortError" ? "TIMEOUT_ABORT" : (err.message || "UNKNOWN");
      console.error(`[OUTLINE] Failed after ${elapsed}ms: ${failureReason}`);
    } finally {
      clearTimeout(timer);
    }

    // Validate & repair
    if (outline) {
      const v = validateAndRepairOutline(outline, 8);
      if (v.fatal) {
        console.error(`[OUTLINE] Validation fatal: ${v.errors.join("; ")}`);
        failureReason = `VALIDATION: ${v.errors[0]}`;
        outline = null;
      } else {
        if (v.repaired > 0) console.log(`[OUTLINE] Auto-repaired ${v.repaired} links`);
        if (v.warnings.length > 0) console.log(`[OUTLINE] Warnings: ${v.warnings.join("; ")}`);
      }
    }

    if (!outline) {
      const elapsed = Date.now() - wallClockStart;
      console.error(`[OUTLINE] Generation failed after ${elapsed}ms. Reason: ${failureReason}`);
      return new Response(JSON.stringify({
        error: "generation_failed",
        message: "Outline generation failed. Client should use local fallback.",
        failure_reason: failureReason,
        timing: { total_ms: elapsed },
      }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Success
    outline.seed = seed;
    const totalMs = Date.now() - wallClockStart;
    console.log(`[OUTLINE] Success: ${outline.sections.length} sections in ${totalMs}ms`);

    return new Response(JSON.stringify({
      outline,
      outline_source: "primary",
      timing: { total_ms: totalMs },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-outline error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function callAI(apiKey: string, system: string, prompt: string, model: string, maxTokens: number, signal: AbortSignal): Promise<any> {
  const t0 = Date.now();
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0.15,
      max_tokens: maxTokens,
    }),
    signal,
  });

  console.log(`  AI headers: ${Date.now() - t0}ms, status: ${response.status}`);
  if (!response.ok) {
    const errText = await response.text();
    console.error("AI error:", response.status, errText);
    throw new Error(`AI_HTTP_${response.status}`);
  }

  const data = await response.json();
  const finishReason = data.choices?.[0]?.finish_reason || "unknown";
  console.log(`  AI body: ${Date.now() - t0}ms, finish_reason: ${finishReason}`);

  let content = data.choices?.[0]?.message?.content || "";
  console.log(`  Content length: ${content.length} chars`);
  
  // Strip markdown fences if present
  if (content.includes("```")) {
    content = content.replace(/^[\s\S]*?```(?:json)?\s*/i, "").replace(/\s*```[\s\S]*$/i, "").trim();
  }
  if (!content.startsWith("{")) {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) content = m[0];
  }

  try {
    return JSON.parse(content);
  } catch {
    // If truncated by token limit, try to repair
    if (finishReason === "length" || !content.endsWith("}")) {
      console.warn(`Parse failed (finish_reason=${finishReason}), attempting truncated JSON repair...`);
      const repaired = repairTruncatedJson(content);
      if (repaired) {
        try {
          const parsed = JSON.parse(repaired);
          console.log(`Truncated JSON repair succeeded: ${parsed.sections?.length || 0} sections`);
          return parsed;
        } catch (e2) {
          console.error("Repair also failed:", (e2 as Error).message);
        }
      }
    }
    console.error("Parse failed (len=" + content.length + "):", content.substring(0, 500));
    throw new Error("PARSE_ERROR");
  }
}

function repairTruncatedJson(json: string): string | null {
  let s = json.trim();
  
  // If it ends mid-string value, close the string
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '"' && (i === 0 || s[i-1] !== '\\')) inString = !inString;
  }
  if (inString) s += '"';
  
  // Find last complete "}" that could end a section object
  const lastBrace = s.lastIndexOf('}');
  if (lastBrace <= 0) return null;
  
  // Trim to last complete brace, remove trailing comma
  let trimmed = s.substring(0, lastBrace + 1).replace(/,\s*$/, '');
  
  // Count unclosed brackets and braces
  let braces = 0, brackets = 0;
  inString = false;
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (c === '"' && (i === 0 || trimmed[i-1] !== '\\')) { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{') braces++;
    else if (c === '}') braces--;
    else if (c === '[') brackets++;
    else if (c === ']') brackets--;
  }
  
  // Close remaining open brackets then braces
  for (let i = 0; i < brackets; i++) trimmed += ']';
  for (let i = 0; i < braces; i++) trimmed += '}';
  
  return trimmed;
}

function validateAndRepairOutline(o: any, minSections: number): { fatal: boolean; errors: string[]; warnings: string[]; repaired: number } {
  const errors: string[] = [];
  const warnings: string[] = [];
  let repaired = 0;

  if (!o || typeof o !== "object") return { fatal: true, errors: ["Not an object"], warnings, repaired };
  if (!o.title) o.title = "The Gloam Courts";
  if (!o.start_section) o.start_section = 1;
  if (!Array.isArray(o.sections)) return { fatal: true, errors: ["sections not array"], warnings, repaired };
  if (o.sections.length < minSections) {
    errors.push(`Too few sections: ${o.sections.length} (need ${minSections})`);
    return { fatal: true, errors, warnings, repaired };
  }

  const nums = new Set<number>();
  for (const s of o.sections) {
    const sn = s.n ?? s.section_number;
    if (typeof sn !== "number") { warnings.push("Section missing n"); continue; }
    s.n = sn;
    nums.add(sn);
  }

  if (!nums.has(o.start_section)) {
    const first = o.sections[0]?.n;
    if (first != null) {
      o.start_section = first;
      repaired++;
    } else {
      errors.push("start_section not in sections");
      return { fatal: true, errors, warnings, repaired };
    }
  }

  const sortedNums = Array.from(nums).sort((a, b) => a - b);
  function findNearest(target: number): number {
    let best = sortedNums[0], bestDist = Math.abs(target - best);
    for (const n of sortedNums) {
      const d = Math.abs(target - n);
      if (d < bestDist) { best = n; bestDist = d; }
    }
    return best;
  }

  for (const s of o.sections) {
    if (!Array.isArray(s.choices)) s.choices = [];
    for (const c of s.choices) {
      // Nav graph uses nx only
      if (c.nx != null && !nums.has(c.nx)) { c.nx = findNearest(c.nx); repaired++; }
    }
    // Backfill defaults
    if (s.plate === undefined) s.plate = false;
    if (s.death === undefined) s.death = false;
    if (s.end === undefined) s.end = s.choices.length === 0;
    if (s.true_end === undefined) s.true_end = false;
    if (s.twist === undefined) s.twist = false;
    if (s.act === undefined) s.act = "I";
  }

  // First section plate=true
  if (o.sections.length > 0) o.sections[0].plate = true;

  // Check reachability
  const adj = new Map<number, Set<number>>();
  for (const s of o.sections) {
    const targets = new Set<number>();
    for (const c of s.choices) {
      if (c.nx != null) targets.add(c.nx);
    }
    adj.set(s.n, targets);
  }
  const visited = new Set<number>();
  const queue = [o.start_section];
  visited.add(o.start_section);
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const neighbors = adj.get(curr);
    if (neighbors) {
      for (const n of neighbors) {
        if (!visited.has(n)) { visited.add(n); queue.push(n); }
      }
    }
  }
  const reachPct = visited.size / nums.size;
  if (reachPct < 0.60) {
    warnings.push(`Only ${Math.round(reachPct * 100)}% reachable (want 60%+)`);
  }

  return { fatal: errors.length > 0, errors, warnings, repaired };
}
