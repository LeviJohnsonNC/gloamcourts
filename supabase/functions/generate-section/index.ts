import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SECTION_SYSTEM_PROMPT = `You are the Narrator of "The Gloam Courts," a dark-comedy gothic gamebook. You write section text in second person (YOU). Your prose is darkly funny, tense, and literary — like Terry Pratchett writing a horror novel.

RULES:
- Write 120-220 words of narrator_text.
- Address the reader as YOU.
- Mention at least one proper noun from the section context (location, faction, NPC name).
- If world_bible is provided, USE those names/places/faction tells. Do NOT invent new factions or places.
- NEVER introduce new items, mechanics, or resources not in the game.
- NEVER decide dice outcomes or reveal what happens on success/failure.
- Only reference items/effects the engine will actually grant (provided in context).
- Keep dark comedy tone but maintain genuine tension.
- Add at most 1 darkly funny "reader insult" per section (e.g., "You, being the kind of person who...").
- For choice_flavor: write 8-16 word italic flavor lines for each choice. If a choice is risky, hint at risk WITHOUT numbers.
- If has_plate is true, write a plate_caption (1-2 sentences) and plate_prompt (detailed ink-wash illustration prompt).
- For death sections, include an epitaph_prompt (1 sentence seed for varied epitaphs).
- If is_twist is true, make the narration dramatic — something fundamental has shifted.

OUTPUT strict JSON only:
{
  "title": string,
  "narrator_text": string,
  "choice_flavor": { [choice_id]: string },
  "plate_caption": string|null,
  "plate_prompt": string|null,
  "epitaph_prompt": string|null
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

    const snapshotStr = snapshot ? JSON.stringify(snapshot, null, 1) : "No snapshot provided";
    const userPrompt = `Generate section text for section ${sectionNumber}.

SECTION CONTEXT:
${snapshotStr}

Output ONLY the JSON object.`;

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
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
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
    content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let sectionData;
    try {
      sectionData = JSON.parse(content);
    } catch {
      console.error("Failed to parse section JSON:", content.substring(0, 500));
      return new Response(JSON.stringify({ error: "parse_error", message: "The Narrator's handwriting was unreadable." }), {
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
    };

    const { error: upsertErr } = await supabase
      .from("run_sections_cache")
      .upsert(cacheRow, { onConflict: "run_id,section_number" });

    if (upsertErr) console.error("Cache upsert error:", upsertErr);

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
