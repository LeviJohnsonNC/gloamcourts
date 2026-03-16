import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BEAT_TAGS = ["Discovery", "Dread", "Negotiation", "Pursuit", "Aftermath", "False Calm", "Revelation"];
const DEVICE_TAGS = ["rhetorical_question", "legalese", "parenthetical_aside", "short_punchline"];

const FORBIDDEN_OPENERS = [
  "YOU arrive", "YOU find", "YOU step", "YOU see", "YOU enter", "YOU walk", "YOU stand before", "YOU notice"
];

const FORBIDDEN_GENRE_WORDS = ["orc", "zombie", "cyber", "space", "cowboy", "dragon", "elf", "dwarf"];

const SECTION_SYSTEM_PROMPT = `You are the Narrator of "The Gloam Courts," a dark-comedy gothic gamebook. You write section text in second person (YOU). Your prose is darkly funny, tense, and literary — like Terry Pratchett writing a horror novel.

VOICE RULES (HARD — NEVER BREAK THESE):
- Always second person — "YOU…"
- Dark comedy with genuine tension. Maximum ONE bite of cruelty/reader-insult per section. No bullying spam.
- FORBIDDEN OPENERS — NEVER start narration with: "YOU arrive…", "YOU find…", "YOU step…", "YOU see…", "YOU enter…", "YOU walk…", "YOU stand before…", "YOU notice…"
  → Instead vary: "Tonight, YOU…", "Unfortunately for YOU…", "It is now YOUR problem that…", "Against better judgment, YOU…", "The Courts have decided YOU…", "There is a specific kind of misery reserved for those who…", "The architecture here has opinions about YOU…"
- Write 120–220 words of narrator_text.
- Include at least 1 sensory detail from this world (ink, cold iron, candle smoke, rot-wine, parchment, bone dust, wet stone, moth-wing dust, rusted bells, stale perfume).
- Mention at least 2 specific world_bible anchors:
  - one PLACE or COURT (by name)
  - one FACTION or RECURRING NPC (by name)
- If twist_active info is provided, include 1 line that acknowledges it indirectly (vibe only, no rules).

VARIETY RULES (HARD):
- Use the assigned beat_tag for emotional tone.
- Do NOT reuse the same rhetorical device as the previous 2 sections.
- Rhetorical devices: (a) rhetorical question (b) legalese/mock-contract language (c) parenthetical aside (d) short punchline sentence
- Pick ONE device for this section and lean into it.
- "YOU" must appear at least twice in the text.

NPC DIALOGUE:
- If npc_mentions are provided, include at least one NPC line of dialogue or observed behavior using their voice_tick and tell.
- Dialogue format: NPC_NAME: "..." or "..." — NPC_NAME
- Keep dialogue to 1–2 lines max. Punchy.

CHOICE FLAVOR:
- Write 8–16 word italic flavor lines for each choice.
- Hint at risk/reward in metaphor or implication. NEVER include explicit TN or probabilities.
- If gated by clues: flavor should imply "you either know this or you don't".

DEATH SECTIONS:
- If is_death, include an epitaph_prompt (1 sentence seed for varied epitaphs).

TWIST ACKNOWLEDGMENT:
- If is_twist is true, make the narration dramatic — something fundamental has shifted. Write it like a proclamation being nailed to a door.

OUTPUT strict JSON only:
{
  "title": string,
  "narrator_text": string,
  "choice_flavor": { [choice_id]: string },
  "choice_mechanics": { [choice_id]: {
    "t": "free"|"test"|"combat"|"gated",
    "stat": "STEEL"|"GUILE"|"WITS"|"GRACE"|"HEX"|null,
    "tn": number|null,
    "opp": number|null,
    "stakes": "safe"|"risky"|"bleak"|"tempting"|"unknown"|null,
    "enemy": {"name":string,"pool":number,"tn":number,"hp":number,"eng":number,"boss":boolean}|null,
    "gate_tag": string|null
  }},
  "plate_caption": string|null,
  "plate_prompt": string|null,
  "epitaph_prompt": string|null,
  "beat_tag": string,
  "device_tag": string
}

MECHANICAL ENRICHMENT RULES:
- For each choice, decide its mechanic type based on context:
  - Act I: mostly "free", maybe 1 "test" (easy, tn=4-5)
  - Act II: mix of "test" (tn=5-7), "combat", and "gated"
  - Act III: harder "test" (tn=7-9), boss "combat", "gated" by clues
- Boss sections → at least one "combat" choice with boss=true
- Twist sections → keep choices "free" (the twist IS the drama)
- Death sections → no choices needed
- If "test": pick the stat that fits the beat (investigation→WITS, social→GUILE, physical→STEEL, stealth→GRACE, supernatural→HEX)
- If "gated": set gate_tag to an item tag like "Key", "Seal", "Holy"
- If "combat": provide enemy stats (pool 2-6, tn 4-7, hp 3-10)
- NOT every choice needs mechanics. A good adventure is ~40% free, ~30% test, ~20% combat, ~10% gated`;

function validateNarration(text: string, snapshot: any): { valid: boolean; failures: string[] } {
  const failures: string[] = [];

  // Check forbidden openers
  const upper = text.trimStart().toUpperCase();
  for (const opener of FORBIDDEN_OPENERS) {
    if (upper.startsWith(opener.toUpperCase())) {
      failures.push(`Starts with forbidden opener: "${opener}"`);
      break;
    }
  }

  // Check "YOU" appears at least twice
  const youCount = (text.match(/\bYOU\b/gi) || []).length;
  if (youCount < 2) failures.push(`"YOU" appears only ${youCount} times (need ≥2)`);

  // Check forbidden genre words
  const lowerText = text.toLowerCase();
  for (const word of FORBIDDEN_GENRE_WORDS) {
    if (lowerText.includes(word)) {
      failures.push(`Contains forbidden word: "${word}"`);
    }
  }

  // N-gram repetition check against recent sections
  if (snapshot?.recent_narrations && snapshot.recent_narrations.length > 0) {
    const words = text.toLowerCase().split(/\s+/);
    for (const prev of snapshot.recent_narrations) {
      if (!prev) continue;
      const prevWords = prev.toLowerCase().split(/\s+/);
      const prevNgrams = new Set<string>();
      for (let i = 0; i <= prevWords.length - 3; i++) {
        prevNgrams.add(prevWords.slice(i, i + 3).join(' '));
      }
      for (let i = 0; i <= words.length - 3; i++) {
        const ngram = words.slice(i, i + 3).join(' ');
        if (prevNgrams.has(ngram) && ngram.length > 10) {
          failures.push(`Repeats 3-word phrase from recent section: "${ngram}"`);
          break;
        }
      }
    }
  }

  return { valid: failures.length === 0, failures };
}

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

    const { runId, sectionNumber, snapshot } = await req.json();
    if (!runId || sectionNumber == null) {
      return new Response(JSON.stringify({ error: "runId and sectionNumber required" }), { status: 400, headers: corsHeaders });
    }

    // Check cache first
    const { data: cached } = await supabase
      .from("run_sections_cache")
      .select("*")
      .eq("run_id", runId)
      .eq("section_number", sectionNumber)
      .maybeSingle();

    if (cached && cached.narrator_text) {
      return new Response(JSON.stringify({ section: cached, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: 150 section generations per run
    const { count } = await supabase
      .from("run_sections_cache")
      .select("*", { count: "exact", head: true })
      .eq("run_id", runId);
    if ((count || 0) >= 150) {
      return new Response(JSON.stringify({ error: "rate_limited", message: "Too many sections generated for this run." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: corsHeaders });
    }

    // Fetch last 3 cached sections for anti-repetition context
    const { data: recentSections } = await supabase
      .from("run_sections_cache")
      .select("beat_tag, device_tag, narrator_text, section_number")
      .eq("run_id", runId)
      .order("created_at", { ascending: false })
      .limit(3);

    const recentHistory = (recentSections || []).map((s: any) => ({
      section: s.section_number,
      beat_tag: s.beat_tag || "unknown",
      device_tag: s.device_tag || "unknown",
    }));

    // Determine beat/device constraints from history
    const recentBeats = recentHistory.map((h: any) => h.beat_tag);
    const recentDevices = recentHistory.map((h: any) => h.device_tag);

    let beatConstraint = "";
    if (recentBeats.length >= 2 && recentBeats[0] === recentBeats[1]) {
      beatConstraint = `\nDo NOT use beat_tag "${recentBeats[0]}" — it was used in the last 2 sections.`;
    }
    let deviceConstraint = "";
    if (recentDevices.length >= 2 && recentDevices[0] === recentDevices[1]) {
      deviceConstraint = `\nDo NOT use device "${recentDevices[0]}" — it was used in the last 2 sections.`;
    }

    // Build NPC context from snapshot
    let npcContext = "";
    if (snapshot?.npc_mentions && snapshot.npc_mentions.length > 0 && snapshot?.world_bible?.npcs) {
      const npcDetails = snapshot.npc_mentions.map((name: string) => {
        const npc = (snapshot.world_bible.npcs as string[]).find((n: string) => n.includes(name));
        return npc || name;
      });
      npcContext = `\nNPCs IN THIS SECTION (use their voice_tick in dialogue):\n${npcDetails.join('\n')}`;
    }

    const snapshotStr = snapshot ? JSON.stringify({
      ...snapshot,
      recent_narrations: undefined, // don't send to LLM
    }, null, 1) : "No snapshot provided";

    const userPrompt = `Generate section text for section ${sectionNumber}.

SECTION CONTEXT:
${snapshotStr}

ANTI-REPETITION HISTORY (last 3 sections):
${JSON.stringify(recentHistory)}
${beatConstraint}
${deviceConstraint}
${npcContext}

Choose beat_tag from: ${BEAT_TAGS.join(", ")}
Choose device_tag from: ${DEVICE_TAGS.join(", ")}

Output ONLY the JSON object.`;

    // Attempt generation with retry on lint failure
    let sectionData: any = null;
    let lintWarning = false;

    for (let attempt = 0; attempt < 2; attempt++) {
      const isRetry = attempt === 1;
      const retryPrefix = isRetry && sectionData?._lintFailures
        ? `REVISION REQUIRED. Your previous output failed narration lint:\n${sectionData._lintFailures.join('\n')}\n\nFix these issues and regenerate.\n\n`
        : "";

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: SECTION_SYSTEM_PROMPT },
            { role: "user", content: retryPrefix + userPrompt },
          ],
          temperature: isRetry ? 0.5 : 0.3,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI gateway error:", response.status, errText);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "rate_limited", message: "Narrator rate limited." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "payment_required", message: "AI credits exhausted." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "ai_error", message: "The Narrator is unavailable." }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      let content = data.choices?.[0]?.message?.content || "";
      // Strip markdown fences, leading/trailing whitespace, and any preamble before JSON
      content = content.replace(/^[\s\S]*?```(?:json)?\s*/i, "").replace(/\s*```[\s\S]*$/i, "").trim();
      // If still no leading {, try to extract JSON object directly
      if (!content.startsWith("{")) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) content = jsonMatch[0];
      }

      try {
        sectionData = JSON.parse(content);
      } catch {
        console.error("Failed to parse section JSON:", content.substring(0, 500));
        if (isRetry) {
          return new Response(JSON.stringify({ error: "parse_error", message: "The Narrator's handwriting was unreadable." }), {
            status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        continue;
      }

      // Validate narration (lint)
      const recentNarrations = (recentSections || []).map((s: any) => s.narrator_text).filter(Boolean);
      const lint = validateNarration(sectionData.narrator_text || "", { recent_narrations: recentNarrations });

      if (lint.valid) break;

      console.warn(`Section ${sectionNumber} lint failures (attempt ${attempt + 1}):`, lint.failures);
      if (isRetry) {
        // Accept but mark as warned
        lintWarning = true;
      } else {
        sectionData._lintFailures = lint.failures;
      }
    }

    if (!sectionData || !sectionData.narrator_text) {
      return new Response(JSON.stringify({ error: "generation_failed", message: "The Narrator refused to write." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert into cache
    const cacheRow = {
      run_id: runId,
      section_number: sectionNumber,
      title: sectionData.title || "",
      narrator_text: sectionData.narrator_text || "",
      choice_flavor_json: sectionData.choice_flavor || {},
      plate_caption: sectionData.plate_caption || null,
      plate_prompt: sectionData.plate_prompt || null,
      beat_tag: sectionData.beat_tag || null,
      device_tag: sectionData.device_tag || null,
      npc_mentions: snapshot?.npc_mentions || [],
    };

    const { error: upsertErr } = await supabase
      .from("run_sections_cache")
      .upsert(cacheRow, { onConflict: "run_id,section_number" });

    if (upsertErr) console.error("Cache upsert error:", upsertErr);
    if (lintWarning) console.warn(`Section ${sectionNumber} cached with lint warnings`);

    return new Response(JSON.stringify({ section: cacheRow, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-section error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
