import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── TIER 1: Primary compact prompt (target: 15-25 sections) ───
const PRIMARY_SYSTEM = `You are the Outline Architect for "The Gloam Courts," a dark-comedy gothic gamebook. Return JSON ONLY. No markdown.

HARD RULES:
- Stats: STEEL, GUILE, WITS, GRACE, HEX
- TN: 2-10, pools: 1-8, enemy hp: 2-12
- stakes: "safe"|"risky"|"bleak"|"tempting"|"unknown"
- Item tags: Sharp, Key, Ranged, Light, Holy, Poison, Coin, Seal, or "Clue:*"
- ALL strings under 40 chars. Brevity mandatory.

STRUCTURE:
- 15-25 sections. Section numbers: 1..50.
- Every non-death/non-ending section: 2 choices.
- ALL nx/ok/no MUST point to existing section n values. ZERO broken links.
- start_section MUST be 1.
- 2-3 combat, 2-4 tests, 1-2 gated, 2-4 clue items.
- 2-3 endings, exactly 1 true ending.
- 1 twist in Act II. Start section plate=true.

OUTPUT this JSON shape ONLY:
{
  "title": string,
  "seed": string,
  "start_section": 1,
  "required_codex_keys": string[],
  "world_bible": {
    "courts": [{"name":string,"motto":string,"taboo":string}],
    "factions": [{"name":string,"goal":string,"tell":string}],
    "recurring_npcs": [{"name":string,"role":string,"voice_tick":string,"tell":string}],
    "signature_places": [{"name":string,"one_line":string}]
  },
  "sections": [
    {
      "n": number, "loc": string, "beat": string, "plate": boolean,
      "boss": boolean, "death": boolean, "end": boolean,
      "end_key": string|null, "true_end": boolean,
      "twist": boolean, "twist_type": string|null,
      "act": "I"|"II"|"III", "codex": string|null,
      "inv": [{"name":string,"tags":string[],"clue":boolean}],
      "choices": [
        {
          "id": string, "label": string,
          "t": "free"|"test"|"combat"|"gated",
          "nx": number|null, "ok": number|null, "no": number|null,
          "test": {"stat":string,"tn":number,"opp":number,"stakes":string,"fx_ok":null,"fx_no":null}|null,
          "gate": {"tag":string}|{"codex":string}|{"clues":string[],"min":number}|null,
          "enemy": {"name":string,"pool":number,"tn":number,"hp":number,"eng":number,"boss":boolean}|null
        }
      ]
    }
  ],
  "opening_plate_prompt": string
}

opening_plate_prompt: max 60 chars. "black ink wash, crosshatch, gothic" style.`;

// ─── TIER 2: Emergency ultra-minimal (target: 8 sections, ~500 tokens) ───
const EMERGENCY_SYSTEM = `Return JSON ONLY. No markdown. A tiny gamebook outline, 8 sections.

JSON shape:
{"title":"str","start_section":1,"sections":[{"n":1,"beat":"str","choices":[{"id":"a","label":"str","t":"free","nx":2}]}]}

Rules: 8 sections exactly. n=1..8. 2 choices each (except endings). Last 2 sections are endings (no choices). All nx point to valid n. Strings under 20 chars.`;

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

    const { data: codexKeys } = await supabase
      .from("codex_entries")
      .select("codex_key")
      .eq("is_true_ending_required", true);
    const requiredKeys = (codexKeys || []).map((k: any) => k.codex_key).slice(0, 5);

    const wallClockStart = Date.now();

    // ═══════════ TIER 1: Primary compact (25s budget, hard abort) ═══════════
    const primaryPrompt = `Outline for seed: "${seed}". Codex keys: ${JSON.stringify(requiredKeys)}. 15-25 sections, 2 choices each. Strings under 40 chars. JSON only.`;

    console.log(`[T1] Starting primary generation for: ${seed}`);
    let outline: any = null;
    let outlineSource = "primary";
    let failureReason: string | null = null;
    let t1Ms = 0;
    let t2Ms = 0;

    const t1Controller = new AbortController();
    const t1Timer = setTimeout(() => t1Controller.abort(), 25_000);

    try {
      outline = await callAI(LOVABLE_API_KEY, PRIMARY_SYSTEM, primaryPrompt, "google/gemini-2.5-flash-lite", 4000, t1Controller.signal);
      t1Ms = Date.now() - wallClockStart;
      console.log(`[T1] Completed in ${t1Ms}ms, sections: ${outline?.sections?.length}`);
    } catch (err: any) {
      t1Ms = Date.now() - wallClockStart;
      failureReason = err.name === "AbortError" ? "T1_TIMEOUT_ABORT" : (err.message || "T1_UNKNOWN");
      console.warn(`[T1] Failed after ${t1Ms}ms: ${failureReason}`);
    } finally {
      clearTimeout(t1Timer);
    }

    // Validate T1 result
    if (outline) {
      const v = validateAndRepairOutline(outline, 10);
      if (v.fatal) {
        console.warn(`[T1] Validation fatal: ${v.errors.join("; ")}`);
        failureReason = `T1_VALIDATION: ${v.errors[0]}`;
        outline = null;
      } else {
        if (v.repaired > 0) console.log(`[T1] Auto-repaired ${v.repaired} links`);
      }
    }

    // ═══════════ TIER 2: Emergency ultra-minimal (15s budget, hard abort) ═══════════
    if (!outline) {
      outlineSource = "emergency";
      const emergencyPrompt = `Gamebook for: "${seed}". 8 sections, n=1..8. 2 choices each except endings. JSON only.`;
      const t2Start = Date.now();
      const t2Controller = new AbortController();
      const t2Timer = setTimeout(() => t2Controller.abort(), 15_000);

      console.log(`[T2] Starting emergency generation`);
      try {
        outline = await callAI(LOVABLE_API_KEY, EMERGENCY_SYSTEM, emergencyPrompt, "google/gemini-2.5-flash-lite", 1500, t2Controller.signal);
        t2Ms = Date.now() - t2Start;
        console.log(`[T2] Completed in ${t2Ms}ms, sections: ${outline?.sections?.length}`);
      } catch (err: any) {
        t2Ms = Date.now() - t2Start;
        failureReason = `${failureReason}; ${err.name === "AbortError" ? "T2_TIMEOUT_ABORT" : (err.message || "T2_UNKNOWN")}`;
        console.error(`[T2] Failed after ${t2Ms}ms: ${err.message}`);
      } finally {
        clearTimeout(t2Timer);
      }

      // Validate T2 with lower bar (minimum 4 sections)
      if (outline) {
        const v = validateAndRepairOutline(outline, 4);
        if (v.fatal) {
          console.error(`[T2] Validation fatal: ${v.errors.join("; ")}`);
          failureReason = `${failureReason}; T2_VALIDATION: ${v.errors[0]}`;
          outline = null;
        }
      }
    }

    // ═══════════ BOTH TIERS FAILED ═══════════
    if (!outline) {
      const elapsed = Date.now() - wallClockStart;
      console.error(`[OUTLINE] Both tiers failed after ${elapsed}ms. Reason: ${failureReason}`);
      return new Response(JSON.stringify({
        error: "generation_failed",
        message: "Both generation tiers failed. Client should use local fallback.",
        outline_source: "none",
        failure_reason: failureReason,
        timing: { t1_ms: t1Ms, t2_ms: t2Ms, total_ms: elapsed },
      }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ═══════════ SUCCESS ═══════════
    outline.seed = seed;
    if (requiredKeys.length > 0) outline.required_codex_keys = requiredKeys;

    const totalMs = Date.now() - wallClockStart;
    console.log(`[OUTLINE] Success via ${outlineSource}: ${outline.sections.length} sections in ${totalMs}ms`);

    return new Response(JSON.stringify({
      outline,
      outline_source: outlineSource,
      failure_reason: outlineSource === "emergency" ? failureReason : null,
      timing: { t1_ms: t1Ms, t2_ms: t2Ms, total_ms: totalMs },
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
  console.log(`  AI body: ${Date.now() - t0}ms`);

  let content = data.choices?.[0]?.message?.content || "";
  content = content.replace(/^[\s\S]*?```(?:json)?\s*/i, "").replace(/\s*```[\s\S]*$/i, "").trim();
  if (!content.startsWith("{")) {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) content = m[0];
  }

  try {
    return JSON.parse(content);
  } catch {
    console.error("Parse failed:", content.substring(0, 200));
    throw new Error("PARSE_ERROR");
  }
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
    // Try to fix by using first section
    const first = o.sections[0]?.n;
    if (first != null) {
      o.start_section = first;
      repaired++;
    } else {
      errors.push(`start_section not in sections`);
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
    // Ensure choices array exists
    if (!Array.isArray(s.choices)) s.choices = [];
    for (const c of s.choices) {
      for (const key of ["nx", "ok", "no"]) {
        const val = c[key];
        if (val != null && !nums.has(val)) { c[key] = findNearest(val); repaired++; }
      }
    }
    // Backfill missing fields for emergency outlines
    if (s.plate === undefined) s.plate = false;
    if (s.boss === undefined) s.boss = false;
    if (s.death === undefined) s.death = false;
    if (s.end === undefined) s.end = s.choices.length === 0;
    if (s.true_end === undefined) s.true_end = false;
    if (s.twist === undefined) s.twist = false;
    if (s.act === undefined) s.act = "I";
    if (s.inv === undefined) s.inv = [];
    if (s.loc === undefined) s.loc = s.beat?.substring(0, 20) || "Unknown";
  }

  // Mark first section plate=true
  if (o.sections.length > 0) o.sections[0].plate = true;

  return { fatal: errors.length > 0, errors, warnings, repaired };
}
