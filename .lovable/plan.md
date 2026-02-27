

## Diagnosis

Two root causes identified:

### Issue 1: Same opening page every time
The LLM outline generation is **timing out** on the client side. The network request to `generate-outline` shows `Error: Failed to fetch` — the edge function runs (logs show it completing successfully) but it takes too long for the browser's fetch timeout. When this happens, the code in `useGameState.tsx` (line 37) falls back to the **demo outline generator**, which has the exact same hardcoded narrator text every time. The demo generator always produces "YOU stand before the gates of the Gloam Courts..." for section 1.

Additionally, `BookReader.tsx` line 73-76 **skips narration generation** if `narrator_text` is already >50 chars — and since the demo outline includes full narrator text, the section-level narration (which would be unique) is never triggered.

### Issue 2: Blank ink plate instead of generated image
`aiArtEnabled` defaults to `false` (line 45-47 in BookReader.tsx — only `true` if `localStorage.getItem('gloam_ai_art') === 'true'`). Since it's off by default, the auto-generation `useEffect` in BookSpread never fires, and the InkPlate placeholder shows instead. There's no indication to the user that they need to toggle this on.

---

## Plan

### A. Fix outline timeout → always-unique adventures

**File: `src/lib/llmService.ts`**
- Add an `AbortController` with a 120-second timeout (instead of browser's default ~30s) to the `generate-outline` fetch call. This gives the LLM enough time to produce the 60-120 section outline.

**File: `src/hooks/useGameState.tsx`**
- Add a retry (1 attempt) if the first outline call fails with a network error before falling back to demo.

### B. Enable AI art by default

**File: `src/pages/BookReader.tsx`**  
- Change the `aiArtEnabled` default from `localStorage.getItem('gloam_ai_art') === 'true'` to `localStorage.getItem('gloam_ai_art') !== 'false'` — so it's **on by default** for new users, but users who explicitly turned it off stay off.

### C. Always attempt unique narration for demo fallback

**File: `src/pages/BookReader.tsx`**
- Remove the early-return on line 73-76 that skips narration generation when `narrator_text` is >50 chars. Instead, always attempt to fetch/generate unique narration, using the outline's text as the fallback display while loading. This way even demo fallback runs will get unique narration per section (if the section generation edge function works).

### Files changed
- `src/lib/llmService.ts` — add fetch timeout
- `src/hooks/useGameState.tsx` — add retry logic
- `src/pages/BookReader.tsx` — default AI art to on, remove narration skip

