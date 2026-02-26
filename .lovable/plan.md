

## Mobile Responsiveness Plan

### Problem Areas Identified

1. **DiceTray**: Fixed bottom panel with `min-w-[340px]` overflows on screens < 340px. Not swipe-dismissable. Overlaps content.
2. **BookReader header**: Too many icons + seed input + section input crammed into one row. Overflows on narrow screens.
3. **Combat UI**: `grid-cols-3` for 6 action buttons is too tight on mobile — labels truncate or overflow. Combat stats line (`flex gap-4`) wraps awkwardly.
4. **Pre-roll panel**: "Embrace Madness" and "Embrace Taint" buttons have long labels with twist warnings that wrap poorly.
5. **Touch targets**: Many buttons (stat +/- in CharacterCreation, dice in DiceTray, header icons) are smaller than the 44px minimum recommended for touch.
6. **BookmarkPanel**: Already full-width on mobile, but no swipe-to-dismiss and no backdrop overlay to indicate it's a modal.

### Plan

**A. DiceTray — Use Drawer on mobile**

- Import `useIsMobile` from `src/hooks/use-mobile.tsx`
- On mobile: render DiceTray content inside a `Drawer` (vaul) that slides up from the bottom, swipe-dismissable
- On desktop: keep current fixed bottom card
- Increase dice size from `w-10 h-10` to `w-12 h-12` on mobile for better touch targets
- Change Luck reroll button to stack vertically on small screens

**B. BookReader header — Responsive toolbar**

- Move section-number input, AI art toggle, and seed copy into a collapsible "more" menu (dropdown) on mobile
- Keep only Home, Codex, Rumors, and Clues icons visible in the header on mobile
- Title truncates with `truncate` class and max-width

**C. Combat UI — Responsive grid**

- Change action buttons from `grid-cols-3` to `grid-cols-2 sm:grid-cols-3`
- Combat stats: wrap into 2 rows on mobile using `grid grid-cols-2 gap-1` instead of `flex gap-4`
- Stance buttons: allow wrapping with `flex-wrap`
- Increase button padding slightly for touch: `py-2.5` minimum

**D. Pre-roll panel — Stack on mobile**

- Change `flex flex-wrap gap-2` to `flex flex-col gap-2 sm:flex-row sm:flex-wrap` so buttons stack vertically on mobile
- Truncate twist warning text on small screens

**E. Touch targets**

- CharacterCreation stat +/- buttons: increase from `w-6 h-6` to `w-8 h-8`
- Header icons: add `p-1.5` padding for larger tap area
- Choice buttons: already `p-3` which is fine

**F. BookmarkPanel — Add backdrop + drawer on mobile**

- On mobile: render as a full-screen Drawer (vaul) sliding from right or bottom instead of a side panel
- Add a semi-transparent backdrop overlay
- On desktop: keep current slide-in panel

**G. General CSS**

- Add `touch-action: manipulation` on interactive elements to prevent double-tap zoom delay
- Ensure `font-size` on inputs is at least 16px to prevent iOS auto-zoom on focus
- Add safe-area inset padding for notched phones: `pb-[env(safe-area-inset-bottom)]` on DiceTray and status bar

### Files to modify

- `src/components/DiceTray.tsx` — Drawer wrapper on mobile
- `src/components/BookSpread.tsx` — Combat grid, pre-roll layout, touch targets
- `src/pages/BookReader.tsx` — Header responsive toolbar
- `src/components/BookmarkPanel.tsx` — Drawer on mobile + backdrop
- `src/components/CharacterCreation.tsx` — Larger touch targets
- `src/index.css` — Safe area insets, input font-size, touch-action

### Technical details

- `useIsMobile()` hook already exists and uses a 768px breakpoint
- Vaul `Drawer` component already exists at `src/components/ui/drawer.tsx`
- No new dependencies needed
- No database or backend changes

