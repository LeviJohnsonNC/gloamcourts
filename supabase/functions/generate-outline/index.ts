import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OUTLINE_SYSTEM_PROMPT = `You are the Outline Architect for "The Gloam Courts," a dark-comedy gothic gamebook. You output STRICT JSON only — no markdown, no commentary.

WORLD: The Gloam Courts are a lattice of decaying aristocratic domains in perpetual twilight. Factions: House Vael (decadent hosts), The Pallid Ministry (bureaucratic enforcers), Iron Saints (animated armor guardians), The Echo Vault (memory archive), The Grey Protocol (secret resistance). Lord Ashwick is the final boss — an eternally smouldering aristocrat.

TONE: Old-school "Fighting Fantasy" narrator addressing YOU. Dark comedy — genuinely tense but absurdly funny. Proper nouns ground the world.

RULES YOU MUST NOT BREAK:
- You NEVER decide dice outcomes. You only define section structure, TNs, pools, and choices.
- Item tags MUST be from: Sharp, Key, Ranged, Light, Holy, Poison, Coin, Seal
- Status effects MUST be from: Paranoia, Marked, Hollow-Eyed, Touched, Corrupted, Abomination
- Stats: STEEL, GUILE, WITS, GRACE, HEX
- TN range: 2-10, pools: 1-8, enemy health: 2-12
- No new resources, no new mechanics.

OUTPUT the outline as a single JSON object matching this schema exactly:
{
  "title": string,
  "seed": string (echo back the seed given),
  "start_section": number,
  "required_codex_keys": string[] (exactly 5 keys from: the_pallid_ministry, the_echo_vault, the_grey_protocol, the_cinder_crown, the_pallid_seal),
  "sections": [
    {
      "section_number": number (unique int 1..400),
      "outline_summary": string (1 sentence),
      "location_tag": string,
      "has_plate": boolean,
      "is_boss": boolean,
      "is_death": boolean,
      "is_ending": boolean,
      "ending_key": string|null,
      "is_true_ending": boolean,
      "codex_unlock": string|null,
      "rumor_unlock": string|null,
      "inventory_grants": [{"name":string,"tags":string[]}],
      "choices": [
        {
          "choice_id": string,
          "label": string,
          "type": "free"|"test"|"combat"|"gated",
          "next_section": number|null,
          "success_section": number|null,
          "fail_section": number|null,
          "test": {
            "stat_used": "STEEL"|"GUILE"|"WITS"|"GRACE"|"HEX",
            "tn": number,
            "opposing_pool": number,
            "stakes": string,
            "on_success": {"effects":{}},
            "on_fail": {"effects":{}}
          }|null,
          "gate": {"required_item_tag":string}|{"required_codex_key":string}|null,
          "combat_enemy": {
            "name": string,
            "pool": number,
            "tn": number,
            "health": number,
            "engaged_bonus": number,
            "is_boss": boolean
          }|null
        }
      ]
    }
  ]
}

REQUIREMENTS:
- 60-120 sections total
- Section numbers: unique integers from 1..400
- 2-4 choices per section (avg ~3)
- At least: 8 combat sections, 10 investigation (WITS), 8 social (GUILE), 6 HEX temptation, 6 gated choices
- 5-8 endings, exactly 1 true ending (is_true_ending=true)
- True ending gated by a "Sealed Door" checking 5 required codex keys
- has_plate=true for bosses and ~15% of sections
- Include death sections with epitaphs implied in outline_summary
- Link all next_section/success_section/fail_section to existing section_numbers
- Start section must exist in sections array`;

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
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;

    const { seed } = await req.json();
    if (!seed) {
      return new Response(JSON.stringify({ error: "seed is required" }), { status: 400, headers: corsHeaders });
    }

    // Rate limit: max 10 outlines per day per user
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: OUTLINE_SYSTEM_PROMPT },
          { role: "user", content: `Generate an adventure outline for seed: "${seed}". Output ONLY the JSON object, nothing else.` },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "rate_limited", message: "AI rate limited. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "ai_error", message: "The Author is unavailable." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";

    // Strip markdown code fences if present
    content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let outline;
    try {
      outline = JSON.parse(content);
    } catch {
      console.error("Failed to parse outline JSON:", content.substring(0, 500));
      return new Response(JSON.stringify({ error: "parse_error", message: "The Author's manuscript was illegible." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Basic validation
    const errors = validateOutline(outline);
    if (errors.length > 0) {
      console.error("Outline validation errors:", errors);
      return new Response(JSON.stringify({ error: "validation_error", message: "The outline had structural problems.", details: errors }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure seed matches
    outline.seed = seed;

    return new Response(JSON.stringify({ outline }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-outline error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function validateOutline(o: any): string[] {
  const errors: string[] = [];
  if (!o || typeof o !== "object") { errors.push("Not an object"); return errors; }
  if (!o.title) errors.push("Missing title");
  if (!o.start_section) errors.push("Missing start_section");
  if (!Array.isArray(o.sections)) { errors.push("sections is not an array"); return errors; }
  if (o.sections.length < 20) errors.push(`Too few sections: ${o.sections.length}`);
  if (o.sections.length > 200) errors.push(`Too many sections: ${o.sections.length}`);

  const nums = new Set<number>();
  for (const s of o.sections) {
    if (typeof s.section_number !== "number") { errors.push("Section missing section_number"); continue; }
    if (nums.has(s.section_number)) errors.push(`Duplicate section_number: ${s.section_number}`);
    nums.add(s.section_number);
  }

  if (!nums.has(o.start_section)) errors.push(`start_section ${o.start_section} not in sections`);

  // Check links point to valid sections
  let brokenLinks = 0;
  for (const s of o.sections) {
    for (const c of (s.choices || [])) {
      for (const key of ["next_section", "success_section", "fail_section"]) {
        const val = c[key];
        if (val != null && !nums.has(val)) brokenLinks++;
      }
    }
  }
  if (brokenLinks > 5) errors.push(`${brokenLinks} broken section links`);

  // Check at least one ending
  const endings = o.sections.filter((s: any) => s.is_ending);
  if (endings.length === 0) errors.push("No endings");

  return errors;
}
