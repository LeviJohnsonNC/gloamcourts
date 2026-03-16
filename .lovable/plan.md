

## Diagnosis

**Root cause**: T1 always fails with `PARSE_ERROR`, not timeout. The PRIMARY_SYSTEM prompt demands a massive JSON schema (world_bible with courts/factions/NPCs/places, complex choice objects with test/gate/enemy sub-objects, inventory arrays) that exceeds the 4000 token cap. The model's output gets truncated mid-JSON, parsing fails, and it falls back to T2 every single time.

T2 succeeds in ~2.5s but produces trivially generic content ("You see a door", "A monster!") because its prompt has zero thematic context. This triggers the "Degraded outline" toast.

**Evidence from logs**:
- `Parse failed: { "title": "The Gloam Courts", "seed": "mmsh76ad", "start_section": 1, "required_codex_keys": ["the_cinder_crown","the_grey_protocol","the_echo_vault","the_liminal_threshol` — truncated JSON
- T1 took 11.3s (not a timeout — it completed but output was unparseable)
- T2 returned generic 8-section outline in 2.5s

**The real problem is architectural**: the outline prompt asks for too much data upfront. Most of it (world_bible, combat stats, test parameters, inventory, gates) is never used at outline time — it's only consumed later by `generate-section`.

## Solution: Single-tier "navigation graph" outline + progressive enrichment

### Core idea
The outline only needs to be a **navigation graph with thematic beats**. All mechanical richness (choice types, combat, tests, gates, items, world_bible) gets determined when `generate-section` is called for each section. This means:
- One prompt, one tier, reliably fits in ~1500 tokens of output
- No "degraded" path — every outline is the same quality
- `generate-section` already creates all the prose, flavor, and plate prompts — it can also assign mechanics

### Changes

**1. `supabase/functions/generate-outline/index.ts` — Complete rewrite of prompt + remove tiered system**

Replace PRIMARY_SYSTEM and EMERGENCY_SYSTEM with a single compact system prompt:
```
Return JSON ONLY. Gothic gamebook outline for "The Gloam Courts" (dark comedy).
12-20 sections. n=1..30. 2 choices each (except endings: 0 choices).
2-3 endings. Mark one true_end. 1 twist in act II.
Beats should be evocative (max 40 chars). Vary: discovery, dread, negotiation, pursuit, revelation.
All nx must point to valid n values.

JSON: {"title":"str","start_section":1,"sections":[
  {"n":1,"beat":"str","act":"I"|"II"|"III","plate":bool,"end":bool,"true_end":bool,"twist":bool,"death":bool,
   "choices":[{"id":"a","label":"str","t":"free","nx":2}]}
]}
```

Key differences from current:
- No world_bible (generate-section already handles NPC/place references via its own system prompt)
- No complex choice types (test/combat/gated) — all choices are `"t":"free"` with `nx` only
- No inventory, no enemy objects, no gate objects, no test objects
- No codex/end_key fields
- Target output: ~800-1200 tokens (vs current 4000+ that truncates)

Remove T1/T2 tiering entirely. Single call with 15s AbortController, 2000 max_tokens.

**2. `src/lib/outlineValidator.ts` — Remove mechanical warnings**

Remove or silence all warnings about combat count, WITS tests, GUILE tests, HEX tests, gated choices — these no longer come from the outline. The outline only provides the graph shape.

**3. `src/hooks/useGameState.tsx` — Remove "degraded" toast**

Remove the `source === 'emergency'` toast since there's only one generation tier. Remove the `outline_source` distinction.

**4. `src/lib/llmService.ts` — Simplify OutlineResult**

Remove the `source` field distinction (or keep it as 'primary' always). Remove the degraded toast logic. Reduce client timeout from 50s to 30s.

**5. `supabase/functions/generate-section/index.ts` — Add mechanical enrichment**

Update the section generation prompt to also determine choice mechanics based on act/beat context. Add to the system prompt:
- For each choice, determine if it should be `free`, `test` (with stat/TN), `combat`, or `gated`
- Output additional `choice_mechanics` field in the JSON response
- The client then merges these mechanics into the section's choices

This is the progressive enrichment — mechanics are assigned per-section when the player reaches that node, not upfront.

### Expected result
- Outline generation: single call, ~3-8s, always succeeds, no "degraded" message
- Thematic variety: the prompt focuses on evocative beats rather than mechanical scaffolding
- Same gameplay depth: mechanics are determined per-section by `generate-section`
- No more PARSE_ERROR failures from truncated JSON

