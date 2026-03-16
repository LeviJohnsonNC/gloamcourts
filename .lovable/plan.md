

## Why It's Still Timing Out

The logs tell the full story:
- **AI headers arrive at 20s** (status 200 — the model accepted the request)
- **AI full body arrives at 55s** (the response is streaming slowly)
- **Wall-clock timeout fires at 45s** — before the body finishes
- **T2 (emergency) never gets a chance** because the T1 `callAI` is still consuming the response body when the wall-clock kills everything

The two-tier strategy is broken: `Promise.race` rejects T1 at 25s, but the pending `response.json()` call keeps the event loop busy. The 45s wall-clock fires while T1's body is still downloading, leaving zero time for T2.

## The Fix: AbortController + Parallel Racing

### 1. `supabase/functions/generate-outline/index.ts`

**Use AbortController to actually kill the fetch**, not just race against it. When T1's 25s budget expires, abort the HTTP connection so the body download stops immediately. Then T2 gets a clean 15s window.

```text
Timeline target:
  0s ──── T1 fetch starts (AbortController, 25s signal)
  20s ─── headers arrive
  25s ─── AbortController fires, fetch CANCELLED
  25s ─── T2 fetch starts (AbortController, 15s signal)
  ~35s ── T2 completes (8-12 sections, tiny payload)
  <45s ── Response returned
```

Key changes in `callAI`:
- Accept an `AbortSignal` parameter and pass it to `fetch()`
- Each tier creates its own `AbortController` with its budget
- When the timeout fires, `controller.abort()` kills the in-flight request immediately

### 2. Shrink Emergency Prompt Further

The current emergency prompt still asks for a JSON schema with `world_bible`, `required_codex_keys`, etc. Strip it to absolute minimum — just `title`, `start_section`, `sections[]` with `n`, `beat`, `choices[]`. Target ~500 tokens of output for T2 (currently it's producing thousands).

### 3. Add `max_tokens` to AI Requests

Set `max_tokens: 4000` for T1 and `max_tokens: 1500` for T2. This caps the response size and prevents the model from generating an unexpectedly large output that takes forever to stream.

### Files to Modify

- **`supabase/functions/generate-outline/index.ts`** — Add `AbortController` to `callAI`, set `max_tokens` on both tiers, strip emergency prompt, fix the race logic so T2 actually runs
- No client-side changes needed — the client already handles `503` and falls back

### Expected Result
- T1 either completes in <25s or is hard-killed at 25s
- T2 gets a clean 15s window with a tiny prompt
- Total wall-clock stays under 45s
- If both fail, client gets `503` and uses demo fallback (but T2 should succeed consistently with such a small prompt)

