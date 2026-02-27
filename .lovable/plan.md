

## What happens during "Summoning the Author"

The loading screen is shown while `createNewRun` runs in `useGameState.tsx`. Here is the sequence:

1. `setGeneratingOutline(true)` — shows the spinner
2. `generateLLMOutline(seed)` calls the `generate-outline` edge function
3. The edge function makes **two sequential LLM calls** to `google/gemini-2.5-flash`:
   - **Stage 1**: Generate World Bible (~3-5 courts, factions, NPCs) — simpler JSON
   - **Stage 2**: Generate full Outline (60-120 sections with choices, gates, links) — very large JSON
4. Server-side validation runs on the outline
5. Response returns to client, client-side validation runs in `outlineValidator.ts`
6. Run + run_state rows are inserted into the database (two DB writes)
7. `setGeneratingOutline(false)` — spinner disappears, reader loads

**The bottleneck is the two sequential LLM calls.** Each takes 10-30+ seconds for complex structured JSON output. Combined, you're looking at 20-60 seconds of waiting.

## Plan to cut load time significantly

### 1. Use `gemini-2.5-flash-lite` for World Bible generation

The World Bible is a small, simple JSON object (3 courts, 6 factions, 5 NPCs, 10 places). It doesn't need the reasoning power of `gemini-2.5-flash`. Switching to `flash-lite` should cut Stage 1 from ~10-15s to ~3-5s.

**File**: `supabase/functions/generate-outline/index.ts` — change model on line 213 from `google/gemini-2.5-flash` to `google/gemini-2.5-flash-lite`

### 2. Run DB operations in parallel with outline generation

Currently the flow is: generate outline → insert run → insert run_state → navigate. The run row doesn't depend on the outline (we can update it after). But actually looking at the code, the run insert includes `outline_json`, so this is already sequential by necessity.

However, we can **create the run row first** (without outline) and update it after, letting the navigation happen sooner. But this changes the architecture significantly. Not worth the complexity.

### 3. Add a progress indicator showing which stage is active

Show "Weaving the world..." during Stage 1 and "Plotting your fate..." during Stage 2, so the user knows something is happening and roughly where they are in the process.

**Files**:
- `supabase/functions/generate-outline/index.ts` — no change needed (non-streaming)
- `src/lib/llmService.ts` — add a callback parameter to `generateLLMOutline` that reports stage
- `src/hooks/useGameState.tsx` — pass stage callback, expose `outlineStage` state
- `src/pages/BookReader.tsx` — display stage text under the spinner

### Summary of changes

| Change | Expected speedup | Risk |
|--------|-----------------|------|
| flash-lite for World Bible | ~5-10s faster | Minimal — simple task |
| Progress indicator | Perceived faster (no actual speedup) | None |

**Files to modify**:
- `supabase/functions/generate-outline/index.ts` — switch Stage 1 model
- `src/lib/llmService.ts` — add stage reporting
- `src/hooks/useGameState.tsx` — expose outline stage
- `src/pages/BookReader.tsx` — show stage-aware loading text

