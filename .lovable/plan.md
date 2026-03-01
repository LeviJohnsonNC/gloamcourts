

## Critique of the User's Plan

The plan is solid and well-specified. A few refinements:

1. **`gemini-2.5-flash-lite` may not reliably produce 60-90 sections with zero broken links.** The user's own prior analysis noted flash-lite "drops quality significantly for 80-section structured JSON." Recommendation: try `gemini-2.5-flash` first with the slim schema (which dramatically reduces output tokens), and only downgrade to flash-lite if it still times out. The slim format alone should cut output tokens by ~60-70%, which is the real win.

2. **`opening_plate_prompt` stored at top-level in outline JSON is good**, but the `generate-plate` edge function currently builds its own fallback prompt from `plateCaption`. The client should pass the `opening_plate_prompt` explicitly for section 1 — no need to change the edge function's interface.

3. **The auto-trigger in BookSpread already exists** (lines 57-61) — it fires `handleGeneratePlate` when `aiArtEnabled && section.has_plate && !plateUrl && !generatingPlate`. This is already non-blocking. The main gap is that `cachedNarration?.plate_prompt` is null for section 1 on first load (narration hasn't been fetched yet), so the plate prompt falls back to a generic caption. We need to thread `opening_plate_prompt` from the outline into the plate call for section 1.

4. **WorldBible type needs updating** — the slim schema removes `signature`, `method`, `secret`, `linguistic_rules`. The `WorldBible` interface in `types.ts` must be made compatible.

5. **Validator section count range**: user says 60-90, current validator enforces 60-120. Just widen the acceptable range in the validator to match.

---

## Implementation Plan

### 1. Edge Function: `generate-outline/index.ts` — Slim Prompt

- Rewrite `OUTLINE_SYSTEM_PROMPT` to request the slim JSON shape exactly as specified (short field names: `n`, `loc`, `beat`, `t`, `nx`, `ok`, `no`, etc.)
- World bible: 3 courts, 4 factions, 3 NPCs, 8 places — all with short fields
- Add `opening_plate_prompt` as required top-level field
- Hard character limits in prompt: beat ≤ 90 chars, label ≤ 40 chars, stakes enum only
- Instruction: "Return JSON only. No markdown. No explanations."
- Keep `gemini-2.5-flash` (not flash-lite) — the slim format reduces tokens enough; flash maintains link integrity
- Temperature: 0.1
- Update server-side `validateOutline()` to validate the slim shape (field names `n`, `choices` with `nx`/`ok`/`no`, etc.), accept 40-120 sections
- Add `opening_plate_prompt` presence check

### 2. Outline Validator: `src/lib/outlineValidator.ts` — Accept Slim Shape

- Detect slim vs legacy format (check for `sections[0].n` vs `sections[0].section_number`)
- For slim format, map fields:
  - `n` → `section_number`, `loc` → location_tag, `beat` → title/outline_summary
  - `t` → type, `nx` → next_section, `ok` → success_section, `no` → fail_section
  - `test.stat` → stat_used, `test.tn` → tn, `test.opp` → opposing_pool
  - `gate.tag` → required_item_tag, `gate.codex` → required_codex_key, `gate.clues` → required_clue_tags
  - `enemy` → combat_enemy fields
  - `inv` → inventory_grants
- Preserve `opening_plate_prompt` on the output `AdventureOutline`
- Relax section count to 40-120
- Keep all link validation, reachability, ending checks

### 3. Types: `src/rules/types.ts` — Update WorldBible + AdventureOutline

- Make `WorldBible` fields optional where the slim schema drops them (`signature`, `method`, `secret`, `linguistic_rules`)
- Add `opening_plate_prompt?: string` to `AdventureOutline`

### 4. BookReader: `src/pages/BookReader.tsx` — Thread opening_plate_prompt

- After outline loads, store `outline.opening_plate_prompt` 
- Pass it to `BookSpread` as a new prop `openingPlatePrompt`

### 5. BookSpread: `src/components/BookSpread.tsx` — Use opening_plate_prompt for section 1

- Accept `openingPlatePrompt?: string` prop
- In `handleGeneratePlate`, if `section.section_number === outline.start_section` (or === 1), use `openingPlatePrompt` as the plate prompt instead of `cachedNarration?.plate_prompt`
- The existing auto-trigger effect already handles non-blocking plate generation
- Add "Illustration is being inked…" text (already present as "Illustrating…" on line 146)

### 6. Telemetry — Lightweight timing logs

- In `useGameState.createNewRun`: record `outline_ms` = time from fetch start to outline received
- In BookReader's section 1 effect: record `section1_plate_requested_at` and `section1_plate_ready_at`
- Write to `run_state.log_json` via an append update
- `console.log` in dev mode

### Files to modify:
- `supabase/functions/generate-outline/index.ts` — slim prompt + slim validation
- `src/lib/outlineValidator.ts` — accept slim shape, map to internal types
- `src/rules/types.ts` — update WorldBible, add opening_plate_prompt
- `src/pages/BookReader.tsx` — pass openingPlatePrompt prop
- `src/components/BookSpread.tsx` — use openingPlatePrompt for section 1
- `src/hooks/useGameState.tsx` — timing telemetry
- `src/lib/llmService.ts` — minor: pass opening_plate_prompt through

