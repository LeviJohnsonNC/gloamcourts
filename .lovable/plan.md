

## Critique of Your Plan

**Strong ideas to keep:**
- Two-page folio layout with spine crease — perfect thematic fit
- Trait spotlight panel — great UX, gives weight to the choice
- "SEAL THIS FATE" / "ALLOCATE YOUR DOOM" dynamic CTA — flavor-rich
- Perk-card styling for traits with lift/glow states
- Paper-edge effects and grain overlay

**Things I'd change:**

1. **"Pool preview: Xd10"** — Adds visual noise to an already dense stat block. New players won't know what "3d10" means yet. Cut it; the pool is just the stat value, which is already displayed prominently.

2. **"When it helps" micro-bullets** — Redundant with the effect text. The spotlight already has flavor + mechanical rule + tags. Adding bullets crowds the card and invents copy that doesn't exist in the data. Cut.

3. **Trait category tags** — Good idea, but 5 categories is too many for 8 traits. Simplify to 3: `Social`, `Combat/Survival`, `Occult`. Hardcode a simple mapping.

4. **Sticky seal bar** — The folio is not tall enough to scroll on desktop (5 stats + 8 trait cards + textarea + header). A sticky bar adds complexity for a non-scrolling page. Instead, make the CTA a prominent fixed-position element at the bottom of the folio itself, always visible. On mobile (where it does scroll), use `sticky bottom-0`.

5. **Reset button** — Unnecessary. Stats default to 2 each, and clicking a different trait auto-deselects. Users can manually adjust. Adds clutter.

6. **Wax seal icon on spotlight** — Nice but risks looking cheap as an SVG. Use a simple `⚙` or Lucide `Shield` icon instead, or skip it.

7. **Background image** — The uploaded desk image should be used as the background for the character creation page too (same as landing page), not just "hookable." It's already in `src/assets/hero-bg.png`.

---

## Refined Plan

### Layout Structure

```text
┌──────────────────────────────────────────────────┐
│  Hero BG + overlay + grain + candle (same as Index) │
│  ┌────────────────────────────────────────────┐  │
│  │           FOLIO (max-w-5xl, ~1100px)        │  │
│  │  ┌──────────────┐ │ ┌──────────────────┐   │  │
│  │  │  LEFT PAGE    │ │ │  RIGHT PAGE       │   │  │
│  │  │  Title+sub    │ │ │  Trait Spotlight   │   │  │
│  │  │  Stats block  │ │ │  ──────────────   │   │  │
│  │  │  Margin note  │ │ │  Trait Grid (2x4) │   │  │
│  │  └──────────────┘ │ └──────────────────┘   │  │
│  │                   │ (spine crease)          │  │
│  │  ┌──────────────────────────────────────┐   │  │
│  │  │  SEAL BAR: points + trait + CTA      │   │  │
│  │  └──────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────┘  │
│  Mobile: single column, sticky CTA at bottom     │
└──────────────────────────────────────────────────┘
```

### Files to modify

- **`src/components/CharacterCreation.tsx`** — Full rewrite of layout/styling (logic unchanged)
- **`src/pages/BookReader.tsx`** — Add hero background layers to the `showCharCreate` wrapper (lines 157-163)
- **`src/index.css`** — Add `.folio-spine` gradient class

### Detailed changes

**A. BookReader.tsx (showCharCreate block)**
- Wrap CharacterCreation in the same layered background as Index (hero image, overlay, grain, candle bloom)
- Import `heroBg` from assets

**B. CharacterCreation.tsx — Folio container**
- Outer: `max-w-5xl mx-auto backdrop-blur-sm bg-background/25 border border-border/30 rounded-lg`
- Inner: `grid grid-cols-1 lg:grid-cols-2` with a spine crease pseudo-element (thin vertical gradient line via a `div` between columns on lg)
- Paper-edge: `shadow-[inset_0_0_40px_hsl(0_0%_0%/0.4)]` + subtle bright border

**C. Left page**
- Title "Create Your Character" + subtitle
- Points remaining stamp: `font-display uppercase text-xs tracking-widest` pill with gold border. When 0: briefly animate opacity pulse with "SEALED" text
- Stat rows: same logic, but each row gets stat description always visible (not hidden on mobile), +/- buttons `w-10 h-10` with `aria-label`, value in `text-xl font-display text-gold`
- Margin note (description textarea): styled with `border-l-2 border-gold-dim/30 pl-3`, label "MARGIN NOTE (OPTIONAL)", helper text below

**D. Right page — Trait Spotlight**
- Default to first trait if none selected
- Card with `bg-muted/40 border border-gold-dim/40 rounded-lg p-5`
- Trait name (`text-lg font-display text-gold`), flavor italic, effect in gold-dim
- 1-2 category tags as small badges (hardcoded mapping):
  - `silver_tongue` → Social, `lucky_fool` → Survival, `iron_constitution` → Combat, `shadow_step` → Combat, `third_eye` → Investigation, `hexblood` → Occult, `deaths_jest` → Occult, `court_bred` → Social

**E. Right page — Trait Grid**
- `grid grid-cols-1 sm:grid-cols-2 gap-2`
- Selected: `border-gold bg-gold/10 scale-[1.02] shadow-[0_0_12px_hsl(var(--gold)/0.15)]` + small `Check` icon top-right
- Hover: `hover:-translate-y-0.5 hover:brightness-110`
- Each card: name, 1-line flavor, small effect, tiny category badge
- `transition-all duration-200`, keyboard focusable with `focus-visible:ring-2 ring-gold`

**F. Seal bar (bottom of folio)**
- `flex items-center justify-between` spanning both columns
- Left: points remaining + selected trait name
- Right: CTA button — disabled "ALLOCATE YOUR DOOM" or enabled "SEAL THIS FATE" with gold glow on hover
- On mobile: `sticky bottom-0` with `bg-background/80 backdrop-blur`

**G. Responsive**
- Desktop (lg+): two-column folio with spine
- Mobile: single column stack — Title → Points → Stats → Margin note → Spotlight → Grid → Sticky CTA
- Spine crease hidden on mobile

**H. Motion**
- Framer Motion (already imported): fade-in on mount, `layoutId` on trait spotlight for smooth transition when switching traits
- `@media (prefers-reduced-motion: reduce)` disables hover lifts and scale

**I. Accessibility**
- +/- buttons get `aria-label={`Increase ${stat}`}` / `aria-label={`Decrease ${stat}`}`
- Trait buttons get `role="radio"` + `aria-checked`
- CTA gets `aria-disabled` when not submittable

