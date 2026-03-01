
Diagnosis (from logs/data I checked)
1) Timeout is real and consistent:
- `POST /functions/v1/generate-outline` returns `504` with `{"error":"timeout","timing":{"wall_clock_ms":45003}}`.
- That means the backend hard wall clock (45s) is tripping before a valid outline is returned.

2) The repeated first-page choices are definitely fallback content:
- Recent `runs` rows all show `section_count = 28` and first choice `"Enter through the main gates"`.
- That exact label comes from the demo fallback generator, not live outline generation.

3) There is no successful “re-fire” after timeout:
- Current flow in `useGameState` does one attempt, then immediately falls back.
- So if outline times out once, you always get the same default first page for that run.

4) Edge log visibility is currently poor:
- Direct edge-log query returned empty, but network + DB evidence is sufficient to confirm timeout + fallback behavior.

Proposed fix (target: eliminate timeout pain and eliminate “same 3 choices”)
A) Split startup generation into a fast minimal outline + on-demand enrichment
- Change `generate-outline` to return a much smaller startup graph (e.g., 12–18 sections, 2 choices each, minimal fields only) within ~15–25s.
- Keep current `generate-section` for rich prose on demand.
- Optionally add “expand-outline” backend function that grows the graph in the background when player reaches deeper nodes.

B) Remove heavy fields from startup payload
- In startup outline generation, drop/trim expensive fields:
  - no full world-bible synthesis at startup (or use a tiny static/seeded scaffold)
  - no inventory object arrays unless strictly needed for first act
  - keep only: `title`, `start_section`, `sections[n, beat, choices(nx/ok/no,type)]`, `opening_plate_prompt`
- This is the largest latency win.

C) Add adaptive timeout ladder instead of single hard failure
- In `generate-outline`:
  - Try “standard compact” for up to ~25s.
  - If not complete, abort and run “ultra-compact emergency prompt” for up to ~10s.
  - Return whichever succeeds first.
- Do not return 504 unless both tiers fail.

D) Replace deterministic demo fallback with seeded “quick AI fallback”
- If both tiers fail, call a tiny emergency prompt (6–10 sections) instead of static `demoOutlineGenerator`.
- This prevents identical “same 3 choices” runs and keeps experience variable.

E) Persist source + reason metadata for observability
- On run creation, write:
  - `outline_source: 'primary' | 'degraded' | 'emergency' | 'demo'`
  - `outline_failure_reason: 'timeout_primary' | 'timeout_all' | 'validation' | ...`
  - timing fields (`headers_ms`, `body_ms`, `parse_ms`, `total_ms`)
- Show this in `run_state.log_json` and console to make diagnosis immediate.

F) Relax validation where it doesn’t block play
- Keep fatal checks only for true blockers (missing sections/start/broken shape).
- Convert noncritical constraints (ending count, distribution targets) to warnings.
- Auto-repair links (already present) and continue.

Files to update
1) `supabase/functions/generate-outline/index.ts`
- Implement two-tier generation strategy and smaller startup schema.
- Add strict aborts for each tier and richer timing/failure metadata in response.

2) `src/lib/llmService.ts`
- Handle multi-tier success payload and preserve source/reason/timing.
- If backend returns degraded outline, proceed (don’t treat as failure).

3) `src/hooks/useGameState.tsx`
- Save `outline_source` and `outline_failure_reason` into `run_state.log_json`.
- Replace static fallback call path with emergency mini-outline path.

4) `src/lib/outlineValidator.ts`
- Add support for “startup minimal” outline schema.
- Keep essential integrity checks, downgrade noncritical checks to warnings.

5) (Optional) `supabase/functions/expand-outline/index.ts` + client hook
- Expand graph progressively after run starts, so user never waits on a big upfront payload.

Acceptance criteria
- New run starts in under 30s in normal conditions.
- First page is no longer the same 3 deterministic fallback choices across runs.
- Timeout incidents still allow a non-static emergency outline.
- Metadata clearly shows whether run used primary/degraded/emergency path and why.
