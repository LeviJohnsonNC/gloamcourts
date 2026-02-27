

## Stylistic Adventure Loading Screen with Progress Steps

Currently the loading screen is just a spinner + single stage text. We'll replace it with a gothic-themed multi-step progress indicator that shows what's done, what's active, and what's pending.

### Design

```text
              ✦ The Author Awakens ✦

  ✓  Summoning the Author         ██████████  done
  ✓  Weaving the world            ██████████  done
  ◉  Plotting your fate           ████░░░░░░  active (pulsing)
  ○  Binding the pages                        pending
  ○  Sealing the cover                        pending

         Seed: amber-fox-42
```

Each step gets a gothic icon treatment: completed steps show a gold check with strikethrough-style dimming, the active step pulses with a blood glow, and pending steps are muted with empty circles.

### Changes

**File: `src/lib/llmService.ts`**
- Replace the two `onStage` string calls with structured stage keys: call `onStage('summoning')` before auth, `onStage('weaving')` before fetch, `onStage('plotting')` after response received, `onStage('binding')` before validation, `onStage('sealing')` after validation succeeds. This gives 5 discrete steps.

**File: `src/hooks/useGameState.tsx`**
- Change `outlineStage` from `string` to `string` (keeping type, but now it receives stage keys).
- The initial stage is `'summoning'`.
- On retry, set stage back to `'summoning'`.

**File: `src/pages/BookReader.tsx`**
- Replace the simple spinner loading screen with a new `LoadingRitual` component (inline or extracted).
- Define an ordered array of steps with keys, labels, and flavor text:
  - `summoning` → "Summoning the Author" / "A quill scratches in the dark…"
  - `weaving` → "Weaving the World" / "Ink bleeds into parchment…"
  - `plotting` → "Plotting Your Fate" / "The threads of destiny pull taut…"
  - `binding` → "Binding the Pages" / "Leather and bone, pressed together…"
  - `sealing` → "Sealing the Cover" / "Wax drips. The seal is set."
- Render each step as a row with: status icon (check/spinner/circle), label styled with `font-display`, and flavor text in `font-narrative`.
- Use framer-motion `AnimatePresence` to fade in each step as it becomes active.
- Show a thin `Progress` bar at the bottom mapped to `(completedSteps / totalSteps) * 100`.
- Keep the seed display at the bottom.

### Files modified
- `src/lib/llmService.ts` — 5 stage callbacks instead of 2
- `src/hooks/useGameState.tsx` — initial stage key update
- `src/pages/BookReader.tsx` — new loading ritual UI

