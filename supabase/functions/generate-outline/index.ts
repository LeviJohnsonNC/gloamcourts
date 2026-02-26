import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WORLD_BIBLE_PROMPT = `You are the World Architect for "The Gloam Courts," a dark-comedy gothic gamebook. Output STRICT JSON only — no markdown, no commentary.

Generate a World Bible for this adventure seed. The world is a lattice of decaying aristocratic domains in perpetual twilight.

OUTPUT JSON:
{
  "courts": [
    {"name": "string", "motto": "string", "signature": "brief visual/thematic signature", "taboo": "what they never do"},
    // exactly 3 courts
  ],
  "factions": [
    {"name": "string", "goal": "string", "method": "string", "tell": "visual or behavioral tell"},
    // exactly 6 factions. MUST include: House Vael, The Pallid Ministry, Iron Saints, The Echo Vault keepers, The Grey Protocol, and one unique faction
  ],
  "recurring_npcs": [
    {"name": "string", "role": "string", "voice_tick": "speech quirk or mannerism", "secret": "hidden motivation"},
    // exactly 5 NPCs
  ],
  "signature_places": [
    {"name": "string", "one_line": "atmospheric one-liner"},
    // exactly 10 places. MUST include: Bone Market, Echo Vault, Undercroft, and 7 unique locations
  ],
  "linguistic_rules": {
    "naming_style": "brief description of naming conventions (e.g., 'Victorian compound words with body-part metaphors')",
    "forbidden_words": ["orc", "zombie", "cyber", "space", "cowboy", "dragon", "elf", "dwarf"]
  }
}

TONE: Gothic dark comedy. Names should feel unique and sticky — not generic fantasy. Think Gormenghast meets Discworld meets Bloodborne.`;

const OUTLINE_SYSTEM_PROMPT = `You are the Outline Architect for "The Gloam Courts," a dark-comedy gothic gamebook. You output STRICT JSON only — no markdown, no commentary.

RULES YOU MUST NOT BREAK:
- You NEVER decide dice outcomes. You only define section structure, TNs, pools, and choices.
- Item tags MUST be from: Sharp, Key, Ranged, Light, Holy, Poison, Coin, Seal, OR any "Clue:*" tag for clue items
- Status effects MUST be from: Paranoia, Marked, Hollow-Eyed, Touched, Corrupted, Abomination
- Stats: STEEL, GUILE, WITS, GRACE, HEX
- TN range: 2-10, pools: 1-8, enemy health: 2-12
- No new resources, no new mechanics.

STRUCTURE REQUIREMENTS:
- 60-120 sections total (aim for 80-90)
- Section numbers: unique integers from 1..400 (classic Fighting Fantasy vibe)
- Every section MUST have 2-4 choices (except death/ending sections which have 0)
- ALL next_section/success_section/fail_section MUST point to existing section_numbers (ZERO broken links)
- Start section must be reachable and must reach at least 85% of all sections

ACT STRUCTURE:
- Act I (first ~25% of sections): Setup, establish the Court, initial problem, 1-2 factions introduced. act_tag="ACT_I"
- Act II (next ~50% of sections): Pressure builds, clue network deepens, TWIST occurs, consequences stack. act_tag="ACT_II"
- Act III (final ~25% of sections): Reckoning, final approaches to endings. act_tag="ACT_III"

CONTENT MINIMUMS:
- 8-15 combat sections
- 10-20 WITS investigation tests
- 8-15 GUILE social leverage tests
- 6-12 HEX temptation moments
- 6-12 gated choices (item tags OR clue gates)
- 8-14 clue-granting sections (inventory_grants with is_clue=true and "Clue:*" tags)
- 6-10 clue-gated choices

CLUE SYSTEM:
- Clues are inventory items with is_clue=true and tags starting with "Clue:" (e.g., "Clue:Ashwick", "Clue:Protocol")
- Clue gates use: gate: { "required_clue_tags": ["Clue:X", "Clue:Y"], "min_required": 2 }
- Clues reward investigation and clever play

TWIST (exactly 1):
- One section in Act II must have is_twist=true
- twist_type must be one of: "DebtWrit", "GreyNotice", "HollowContract"
- The twist section must be on a main path (reachable on most routes)
- After twist, at least 10 sections should reference consequences in outline_summary

ENDINGS:
- 5-8 endings total, exactly 1 true ending (is_true_ending=true)
- True ending gated by a "Sealed Door" checking 5 required codex keys
- Death sections: is_death=true, no choices

PLATES:
- has_plate=true for all boss sections and ~15% of other sections

WORLD BIBLE USAGE:
- Every section MUST reference at least one world_bible element in location_tag or outline_summary
- At least 40% of sections must reference a faction OR recurring NPC
- Names must be consistent — reuse world_bible names, don't invent new ones

OUTPUT the outline as a single JSON object:
{
  "title": string,
  "seed": string,
  "start_section": number,
  "required_codex_keys": string[],
  "world_bible": <the world bible object provided>,
  "sections": [
    {
      "section_number": number,
      "outline_summary": string,
      "location_tag": string,
      "has_plate": boolean,
      "is_boss": boolean,
      "is_death": boolean,
      "is_ending": boolean,
      "ending_key": string|null,
      "is_true_ending": boolean,
      "codex_unlock": string|null,
      "rumor_unlock": string|null,
      "inventory_grants": [{"name":string,"tags":string[],"is_clue":boolean}],
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
          "gate": {"required_item_tag":string}|{"required_codex_key":string}|{"required_clue_tags":string[],"min_required":number}|null,
          "combat_enemy": {
            "name": string,
            "pool": number,
            "tn": number,
            "health": number,
            "engaged_bonus": number,
            "is_boss": boolean
          }|null
        }
      ],
      "act_tag": "ACT_I"|"ACT_II"|"ACT_III",
      "is_twist": boolean,
      "twist_type": string|null
    }
  ]
}`;

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

    // Stage 1: Generate World Bible
    console.log("Generating world bible for seed:", seed);
    const wbResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: WORLD_BIBLE_PROMPT },
          { role: "user", content: `Generate a World Bible for adventure seed: "${seed}". Output ONLY the JSON object.` },
        ],
        temperature: 0.3,
      }),
    });

    let worldBible = null;
    if (wbResponse.ok) {
      const wbData = await wbResponse.json();
      let wbContent = wbData.choices?.[0]?.message?.content || "";
      wbContent = wbContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      try {
        worldBible = JSON.parse(wbContent);
        console.log("World bible generated:", Object.keys(worldBible));
      } catch {
        console.error("Failed to parse world bible:", wbContent.substring(0, 200));
      }
    } else {
      console.error("World bible generation failed:", wbResponse.status);
    }

    // Stage 2: Generate Outline with World Bible
    const worldBibleContext = worldBible
      ? `\n\nWORLD BIBLE (use these names, places, factions consistently):\n${JSON.stringify(worldBible, null, 1)}`
      : "";

    const outlinePrompt = `Generate an adventure outline for seed: "${seed}".
Required codex keys for true ending: ${JSON.stringify(requiredKeys)}
${worldBibleContext}

Output ONLY the JSON object.`;

    console.log("Generating outline for seed:", seed);
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
          { role: "user", content: outlinePrompt },
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
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "payment_required", message: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "ai_error", message: "The Author is unavailable." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
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

    // Inject world_bible into outline for caching
    if (worldBible) {
      outline.world_bible = worldBible;
    }

    // Ensure seed and required keys
    outline.seed = seed;
    if (requiredKeys.length > 0) {
      outline.required_codex_keys = requiredKeys;
    }

    // Server-side validation (basic — client does full validation)
    const errors = validateOutline(outline);
    if (errors.length > 0) {
      console.error("Outline validation errors:", errors);
      return new Response(JSON.stringify({ error: "validation_error", message: "The outline had structural problems.", details: errors }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
  if (o.sections.length < 60) errors.push(`Too few sections: ${o.sections.length} (need 60-120)`);
  if (o.sections.length > 120) errors.push(`Too many sections: ${o.sections.length} (need 60-120)`);

  const nums = new Set<number>();
  for (const s of o.sections) {
    if (typeof s.section_number !== "number") { errors.push("Section missing section_number"); continue; }
    if (nums.has(s.section_number)) errors.push(`Duplicate section_number: ${s.section_number}`);
    nums.add(s.section_number);
  }

  if (!nums.has(o.start_section)) errors.push(`start_section ${o.start_section} not in sections`);

  // ZERO broken links
  let brokenLinks = 0;
  for (const s of o.sections) {
    for (const c of (s.choices || [])) {
      for (const key of ["next_section", "success_section", "fail_section"]) {
        const val = c[key];
        if (val != null && !nums.has(val)) brokenLinks++;
      }
    }
  }
  if (brokenLinks > 0) errors.push(`${brokenLinks} broken section links (must be 0)`);

  // Endings
  const endings = o.sections.filter((s: any) => s.is_ending);
  if (endings.length < 5) errors.push(`Only ${endings.length} endings (need 5-8)`);
  const trueEndings = o.sections.filter((s: any) => s.is_true_ending);
  if (trueEndings.length !== 1) errors.push(`${trueEndings.length} true endings (need exactly 1)`);

  return errors;
}
