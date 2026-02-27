

## Landing Page Visual Overhaul

### Changes

**1. Copy uploaded image to project**
- Copy `user-uploads://image.png` to `src/assets/hero-bg.png`
- Import it as an ES module in `Index.tsx`

**2. Rewrite Index.tsx layout with layered background**
- Layer 1: Hero background image (`object-cover`, full bleed)
- Layer 2: Dark radial gradient overlay (darker edges, slightly brighter center for readability)
- Layer 3: CSS-only noise grain (SVG filter, no extra asset)
- Layer 4: Candlelight bloom (soft radial gradient, slow flicker animation, respects `prefers-reduced-motion`)
- Layer 5: Content (existing UI, z-indexed above)

**3. Polish the content styling**
- Add `text-shadow` to gold title for glow effect against busy background
- Add subtle `backdrop-blur-sm` + semi-transparent dark background to the content card area so text remains crisp
- Increase subtitle tracking slightly
- Add a faint ornamental divider (CSS border with gold-dim) between pitch text and action buttons

**4. Add flicker keyframes to `src/index.css`**
- Slow 8s candle flicker animation
- `prefers-reduced-motion` media query to disable it

**5. Button styling upgrade**
- Add subtle `backdrop-blur` to buttons so they feel like they sit on the parchment
- Add a warm glow hover effect on the primary "New Run" / "Sign in" button

### Files to modify
- Copy: `user-uploads://image.png` → `src/assets/hero-bg.png`
- `src/pages/Index.tsx` — full layout rewrite with layered background + polished content
- `src/index.css` — add flicker animation + reduced-motion rule

### No backend or database changes needed.

