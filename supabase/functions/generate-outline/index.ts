import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OUTLINE_SYSTEM_PROMPT = `You are the Outline Architect for "The Gloam Courts," a dark-comedy gothic gamebook. Return JSON ONLY. No markdown. No explanations.

You MUST produce 30-40 sections. No more. No less.

HARD RULES:
- Stats: STEEL, GUILE, WITS, GRACE, HEX
- TN: 2-10, pools: 1-8, enemy hp: 2-12
- stakes MUST be one of: "safe"|"risky"|"bleak"|"tempting"|"unknown"
- Item tags: Sharp, Key, Ranged, Light, Holy, Poison, Coin, Seal, or "Clue:*"
- beat: max 60 characters. label: max 30 characters. No prose anywhere.
- Keep ALL strings as short as possible. Brevity is mandatory.

STRUCTURE:
- 30-40 sections ONLY. Section numbers: unique integers 1..100.
- Every non-death/non-ending section: 2 choices (not 3).
- ALL nx/ok/no values MUST point to existing section n values. ZERO broken links.
- start_section MUST be 1.
- 3-5 combat, 4-6 WITS tests, 3-5 GUILE tests, 2-4 HEX tests.
- 2-4 gated choices, 4-6 clue items (Clue:* tags).
- 3-4 endings, exactly 1 true ending (true_end=true).
- Exactly 1 twist section in Act II.
- Start section MUST have plate=true.

WORLD BIBLE (compact):
- 3 courts: {name, motto, taboo} — each field max 50 chars
- 4 factions: {name, goal, tell} — each field max 50 chars
- 3 recurring_npcs: {name, role, voice_tick, tell} — each field max 50 chars
- 6 signature_places: {name, one_line} — each field max 50 chars

OUTPUT exactly this JSON shape:
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
      "n": number,
      "loc": string,
      "beat": string,
      "plate": boolean,
      "boss": boolean,
      "death": boolean,
      "end": boolean,
      "end_key": string|null,
      "true_end": boolean,
      "twist": boolean,
      "twist_type": string|null,
      "act": "I"|"II"|"III",
      "codex": string|null,
      "inv": [{"name":string,"tags":string[],"clue":boolean}],
      "choices": [
        {
          "id": string,
          "label": string,
          "t": "free"|"test"|"combat"|"gated",
          "nx": number|null,
          "ok": number|null,
          "no": number|null,
          "test": {"stat":string,"tn":number,"opp":number,"stakes":string,"fx_ok":null,"fx_no":null}|null,
          "gate": {"tag":string}|{"codex":string}|{"clues":string[],"min":number}|null,
          "enemy": {"name":string,"pool":number,"tn":number,"hp":number,"eng":number,"boss":boolean}|null
        }
      ]
    }
  ],
  "opening_plate_prompt": string
}

opening_plate_prompt: REQUIRED. Max 80 chars. Gritty ink-wash illustration of the opening scene. Style: "black ink wash, crosshatch, gothic". No text in image.`;

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
    const userId = user.id;

    const { seed } = await req.json();
    if (!seed) {
      return new Response(JSON.stringify({ error: "seed is required" }), { status: 400, headers: corsHeaders });
    }

    // Rate limit: max 10 outlines per day
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    const { count } = await supabase
      .from("runs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneDayAgo);

    if ((count || 0) >= 10) {
      return new Response(JSON.stringify({ error: "rate_limited", message: "Maximum 10 runs per day. The Courts need rest." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: corsHeaders });
    }

    // Fetch required codex keys
    const { data: codexKeys } = await supabase
      .from("codex_entries")
      .select("codex_key")
      .eq("is_true_ending_required", true);
    const requiredKeys = (codexKeys || []).map((k: any) => k.codex_key).slice(0, 5);

    const outlinePrompt = `Generate the slim outline for seed: "${seed}".
Required codex keys for true ending: ${JSON.stringify(requiredKeys)}
IMPORTANT: Exactly 30-40 sections. 2 choices per section. Keep ALL strings under 50 chars. Return ONLY JSON, no markdown.`;

    console.log("Generating slim outline for seed:", seed);
    const wallClockStart = Date.now();

    // ====== HARD WALL-CLOCK TIMEOUT: 45s for entire AI call + body + parse ======
    const WALL_CLOCK_LIMIT_MS = 45_000;

    let outline: any;
    try {
      outline = await Promise.race([
        callAIAndParse(LOVABLE_API_KEY, outlinePrompt),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("WALL_CLOCK_TIMEOUT")), WALL_CLOCK_LIMIT_MS)
        ),
      ]);
    } catch (err: any) {
      const elapsed = Date.now() - wallClockStart;
      if (err.message === "WALL_CLOCK_TIMEOUT") {
        console.error(`Wall-clock timeout after ${elapsed}ms`);
        return new Response(JSON.stringify({
          error: "timeout",
          message: "The Author's quill moved too slowly. Try again.",
          timing: { wall_clock_ms: elapsed },
        }), { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw err;
    }

    const aiElapsed = Date.now() - wallClockStart;
    console.log(`AI call + parse completed in ${aiElapsed}ms`);

    // Ensure seed and required keys
    outline.seed = seed;
    if (requiredKeys.length > 0) {
      outline.required_codex_keys = requiredKeys;
    }

    // Server-side validation with auto-repair
    const result = validateAndRepairOutline(outline);
    if (result.fatal) {
      console.error("Outline fatal errors:", result.errors);
      return new Response(JSON.stringify({ error: "validation_error", message: "The outline had fatal structural problems.", details: result.errors }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (result.warnings.length > 0) console.warn("Outline warnings:", result.warnings);
    if (result.repaired > 0) console.log(`Auto-repaired ${result.repaired} broken links`);

    const totalElapsed = Date.now() - wallClockStart;
    console.log(`Outline validated: ${outline.sections.length} sections, total: ${totalElapsed}ms`);

    return new Response(JSON.stringify({
      outline,
      timing: { outline_ms: aiElapsed, total_ms: totalElapsed },
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

/** Fetches AI, reads full body, parses JSON — all as one awaitable unit */
async function callAIAndParse(apiKey: string, prompt: string): Promise<any> {
  const t0 = Date.now();

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: OUTLINE_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
    }),
  });

  const headersMs = Date.now() - t0;
  console.log(`AI headers in ${headersMs}ms, status: ${response.status}`);

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI gateway error:", response.status, errText);
    throw new Error(`AI_HTTP_${response.status}`);
  }

  // Read full body
  const data = await response.json();
  const bodyMs = Date.now() - t0;
  console.log(`AI full body in ${bodyMs}ms`);

  let content = data.choices?.[0]?.message?.content || "";
  content = content.replace(/^[\s\S]*?```(?:json)?\s*/i, "").replace(/\s*```[\s\S]*$/i, "").trim();
  if (!content.startsWith("{")) {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) content = jsonMatch[0];
  }

  try {
    return JSON.parse(content);
  } catch {
    console.error("Failed to parse outline JSON:", content.substring(0, 300));
    throw new Error("PARSE_ERROR");
  }
}

function validateAndRepairOutline(o: any): { fatal: boolean; errors: string[]; warnings: string[]; repaired: number } {
  const errors: string[] = [];
  const warnings: string[] = [];
  let repaired = 0;

  if (!o || typeof o !== "object") return { fatal: true, errors: ["Not an object"], warnings, repaired };
  if (!o.title) errors.push("Missing title");
  if (!o.start_section) errors.push("Missing start_section");
  if (!Array.isArray(o.sections)) return { fatal: true, errors: ["sections is not an array"], warnings, repaired };
  
  if (o.sections.length < 20) {
    errors.push(`Too few sections: ${o.sections.length} (need at least 20)`);
    return { fatal: true, errors, warnings, repaired };
  }
  
  if (o.sections.length < 30) warnings.push(`Low section count: ${o.sections.length}`);
  if (o.sections.length > 120) warnings.push(`High section count: ${o.sections.length}`);
  if (!o.opening_plate_prompt) warnings.push("Missing opening_plate_prompt");

  const nums = new Set<number>();
  for (const s of o.sections) {
    const sn = s.n ?? s.section_number;
    if (typeof sn !== "number") { errors.push("Section missing n"); continue; }
    if (nums.has(sn)) warnings.push(`Duplicate section: ${sn}`);
    nums.add(sn);
  }

  if (!nums.has(o.start_section)) {
    errors.push(`start_section ${o.start_section} not in sections`);
    return { fatal: true, errors, warnings, repaired };
  }

  const sortedNums = Array.from(nums).sort((a, b) => a - b);
  function findNearest(target: number): number {
    let best = sortedNums[0];
    let bestDist = Math.abs(target - best);
    for (const n of sortedNums) {
      const d = Math.abs(target - n);
      if (d < bestDist) { best = n; bestDist = d; }
    }
    return best;
  }

  for (const s of o.sections) {
    for (const c of (s.choices || [])) {
      for (const key of ["nx", "ok", "no", "next_section", "success_section", "fail_section"]) {
        const val = c[key];
        if (val != null && !nums.has(val)) {
          c[key] = findNearest(val);
          repaired++;
        }
      }
    }
  }

  const endings = o.sections.filter((s: any) => s.end || s.is_ending);
  if (endings.length < 3) warnings.push(`Only ${endings.length} endings`);
  const trueEndings = o.sections.filter((s: any) => s.true_end || s.is_true_ending);
  if (trueEndings.length !== 1) warnings.push(`${trueEndings.length} true endings`);

  const fatal = errors.length > 0;
  return { fatal, errors, warnings, repaired };
}
