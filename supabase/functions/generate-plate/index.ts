import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { runId, sectionNumber, platePrompt, plateCaption } = await req.json();
    if (!runId || sectionNumber == null) {
      return new Response(JSON.stringify({ error: "runId and sectionNumber required" }), { status: 400, headers: corsHeaders });
    }

    // Check if plate already exists
    const { data: existing } = await supabase
      .from("run_sections_cache")
      .select("plate_url")
      .eq("run_id", runId)
      .eq("section_number", sectionNumber)
      .maybeSingle();

    if (existing?.plate_url) {
      return new Response(JSON.stringify({ plate_url: existing.plate_url, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: corsHeaders });
    }

    const prompt = platePrompt || `Dark ink-wash illustration for a gothic gamebook. Scene: ${plateCaption || "A mysterious scene in the Gloam Courts"}. Style: cross-hatching, old book plate, monochrome sepia tones, dramatic shadows, slightly unsettling.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Image generation error:", response.status, errText);
      return new Response(JSON.stringify({ error: "image_error", message: "The illustrator is unavailable." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageData) {
      return new Response(JSON.stringify({ error: "no_image", message: "No image was generated." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upload to storage
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    const filePath = `${runId}/${sectionNumber}.png`;

    const { error: uploadErr } = await supabase.storage
      .from("plates")
      .upload(filePath, imageBytes, { contentType: "image/png", upsert: true });

    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      return new Response(JSON.stringify({ error: "upload_error", message: "Failed to store the plate." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: urlData } = supabase.storage.from("plates").getPublicUrl(filePath);
    const plateUrl = urlData.publicUrl;

    // Update cache with plate URL
    await supabase
      .from("run_sections_cache")
      .update({ plate_url: plateUrl })
      .eq("run_id", runId)
      .eq("section_number", sectionNumber);

    // Also insert into run_assets
    await supabase.from("run_assets").insert({
      run_id: runId,
      section_number: sectionNumber,
      kind: "plate",
      prompt,
      url: plateUrl,
    });

    return new Response(JSON.stringify({ plate_url: plateUrl, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-plate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
