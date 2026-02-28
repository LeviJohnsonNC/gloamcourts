

## Speed Up Adventure Generation: Merge Two LLM Calls Into One

### Analysis

The current `generate-outline` edge function makes **two sequential LLM calls**:

1. **World Bible** (gemini-2.5-flash-lite) → ~3-8 seconds
2. **Full Outline** (gemini-2.5-flash) → ~30-60 seconds, using world bible as input

The outline call **waits** for the world bible to complete before starting. This is the single biggest structural inefficiency — an entire extra round-trip that adds 3-8 seconds of pure latency.

### The Single Biggest Improvement

**Merge world bible generation into the outline call.** Instead of two sequential calls, make one call to `gemini-2.5-flash` that generates both the world bible AND the outline in a single pass. The model is already being told to use consistent names/factions/places — it doesn't need a separate world bible step to do that. We just embed the world bible schema into the outline output schema.

```text
BEFORE:
  Call 1 (flash-lite): Generate world bible     ~5s
  Wait...
  Call 2 (flash):      Generate outline          ~40s
  Total wall clock:                              ~45s

AFTER:
  Call 1 (flash):      Generate world bible      ~45s
                       + outline in single pass
  Total wall clock:                              ~40s (saves 5-8s)
```

This saves **one full network round-trip + one full LLM inference pass**. The output token count stays roughly the same (world bible is small compared to 80 sections), so the merged call won't be meaningfully slower than the outline call alone.

### Why not other approaches?

- **Parallel calls**: Can't — outline needs world bible names for consistency.
- **Faster model for outline**: `flash-lite` drops quality significantly for 80-section structured JSON with zero broken links. Not worth the tradeoff.
- **Fewer sections**: Sacrifices gameplay depth — user said no quality loss.
- **Streaming**: Doesn't help — we need complete JSON before validation.

### Changes

**File: `supabase/functions/generate-outline/index.ts`**

- Remove the separate `WORLD_BIBLE_PROMPT` and Stage 1 fetch call entirely.
- Fold the world bible schema into `OUTLINE_SYSTEM_PROMPT`, making `world_bible` a required top-level key in the output JSON (it already is — we just tell the model to generate it inline instead of receiving it as input).
- Remove the `worldBibleContext` injection into the user prompt.
- Update the user prompt to say "Generate BOTH the world bible AND the adventure outline."
- Keep the same model (`gemini-2.5-flash`) and temperature.
- Keep all validation logic unchanged.

**File: `src/lib/llmService.ts`**

- Remove the `'weaving'` stage (no longer a separate step). Remap stages to 4 steps: `summoning` (auth), `plotting` (request sent), `binding` (validation), `sealing` (done).

**File: `src/pages/BookReader.tsx`**

- Update `RITUAL_STEPS` array to remove the "Weaving the World" step (now 4 steps instead of 5). Adjust progress math accordingly.

### Files to modify
- `supabase/functions/generate-outline/index.ts` — merge prompts, remove Stage 1 call
- `src/lib/llmService.ts` — simplify stage callbacks
- `src/pages/BookReader.tsx` — update loading ritual steps

