

## Prefetch Next Sections While Player Reads

The idea is solid. Each section's choices point to specific `next_section`, `success_section`, and `fail_section` numbers. While the player reads, we can fire off `fetchOrGenerateSection` for all reachable next sections in the background. When the player navigates, the narration is already cached in `run_sections_cache` and loads instantly.

### Architecture

```text
Player lands on Section 5
  → Display narration (already fetched or loading)
  → Scan choices for target section numbers
     Choice A (free)  → next_section: 12
     Choice B (test)  → success: 14, fail: 13
  → Fire prefetch for sections 12, 13, 14 in parallel
  → Results land in run_sections_cache (DB)
  → When player picks a choice → fetchOrGenerateSection hits cache → instant
```

### Changes

**File: `src/pages/BookReader.tsx`**

Add a second `useEffect` after the existing narration fetch effect. Once the current section's narration finishes loading (`!loadingNarration` and `cachedNarration` exists), collect all unique target section numbers from the current section's choices (`next_section`, `success_section`, `fail_section`). For each, look up the `Section` object from the outline and call `fetchOrGenerateSection` in the background (fire-and-forget, no state updates needed — the results get cached in the DB). Use a `Set` ref to avoid re-prefetching the same sections.

```typescript
// Prefetch next reachable sections
useEffect(() => {
  if (!currentSection || !gameState || !outline || loadingNarration) return;

  const targets = new Set<number>();
  for (const c of currentSection.choices) {
    if (c.next_section) targets.add(c.next_section);
    if (c.success_section) targets.add(c.success_section);
    if (c.fail_section) targets.add(c.fail_section);
  }

  targets.forEach(sn => {
    const sec = outline.sections.find(s => s.section_number === sn);
    if (sec) {
      fetchOrGenerateSection(gameState.run_id, sec, gameState, outline);
      // fire-and-forget — result lands in run_sections_cache
    }
  });
}, [currentSection?.section_number, loadingNarration]);
```

No changes needed to `fetchOrGenerateSection` — it already checks `run_sections_cache` first and writes results back to it. The prefetch simply warms the cache.

### Files to modify
- `src/pages/BookReader.tsx` — add one `useEffect` (~15 lines)

No backend or database changes needed.

