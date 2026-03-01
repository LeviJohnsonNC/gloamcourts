

## Diagnosis: Why Adventures Take 5+ Minutes and Show Same 3 Choices

### Root Cause: LLM Outline is Failing, Falling Back to Demo

The "same 3 choices" on every first page confirms the LLM outline generation is **failing every time**, and the code falls back to `generateDemoOutline()` (line 42 in `useGameState.tsx`). The demo generator hardcodes the same 3 choices for section 1: "Enter through the main gates", "Look for a servant's entrance", "Scale the wall".

**Why 5+ minutes?** The client tries the LLM **twice** (line 31: `for (let attempt = 0; attempt < 2; attempt++)`), each with a 180-second timeout (line 28 in `llmService.ts`). Two timeouts = ~6 minutes before the demo fallback kicks in.

### Why the LLM Outline Fails

The edge function's server-side `validateSlimOutline()` is very strict — it requires:
- 40-120 sections (the LLM must produce 60-90)
- 5-8 endings with exactly 1 true ending
- ZERO broken links
- `opening_plate_prompt` present

If the LLM produces even 1 broken link or <5 endings, the function returns HTTP 422 (validation error). The client treats any non-200 as `null`, triggering the retry loop.

Additionally, **no edge function logs are appearing at all**, which suggests either:
1. The function is being killed by the platform before it can log (wall-clock timeout), OR
2. The LLM call itself is timing out within the edge function before returning

The edge function has no internal timeout on the `fetch` to the AI gateway — it just waits indefinitely until the platform kills it.

### The Fix Plan

**1. Add a fetch timeout inside the edge function** (30s AbortController on the AI gateway call) so it fails fast instead of waiting for platform kill.

**2. Relax validation to warnings** — instead of hard-failing on broken links or insufficient endings, attempt to repair them:
- Auto-fix broken links by redirecting to the nearest valid section
- If endings < 5, downgrade to a warning (the game can still play)
- Only hard-fail on truly fatal issues (no sections, no start_section)

**3. Reduce the client retry to 1 attempt** (not 2) and reduce the client timeout from 180s to 60s. If the edge function can't respond in 60s, it won't respond at all.

**4. Add better error logging** — surface the specific validation errors in the client console so we can see exactly why outlines fail.

**5. Reduce section count requirement** — change the minimum from 40 to 30 in both the edge function validator and client-side validator, giving the LLM more room to produce a valid outline.

### Files to Modify

- `supabase/functions/generate-outline/index.ts` — add 30s fetch timeout, relax validation (auto-repair broken links, lower section minimum to 30, downgrade some errors to warnings)
- `src/lib/llmService.ts` — reduce client timeout to 60s, remove retry loop (1 attempt only), log validation errors visibly
- `src/lib/outlineValidator.ts` — lower section minimum from 40 to 30, relax ending count requirement

### Expected Result
- Edge function responds within 30-40s (or fails fast at 30s)
- Client waits max 60s (not 360s)
- More outlines pass validation due to auto-repair and relaxed rules
- If it still fails, demo fallback happens in ~60s instead of ~6 minutes

