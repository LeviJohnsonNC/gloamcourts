

## Auto-generate Ink Plates

Currently, when a section has `has_plate: true`, it shows a blank SVG placeholder and a manual "Generate Plate" button (only visible if AI art is toggled on). The user must click the button each time. The infrastructure (edge function, storage bucket, caching) all exists and works.

### Change

**File: `src/components/BookSpread.tsx`**

Add a `useEffect` that auto-triggers plate generation when:
- `aiArtEnabled` is `true`
- The section has `has_plate: true`
- There's no existing `plateUrl`
- Not already generating

This replaces the manual button click. The "Generate Plate" button stays as a fallback for when auto-generation fails or AI art is toggled off then back on.

```typescript
React.useEffect(() => {
  if (aiArtEnabled && section.has_plate && !plateUrl && !generatingPlate && runId) {
    handleGeneratePlate();
  }
}, [aiArtEnabled, section.section_number, plateUrl, runId]);
```

The loading spinner ("Illustrating…") already exists and will show during generation. Once complete, the image replaces the placeholder automatically.

### Files to modify
- `src/components/BookSpread.tsx` — add one `useEffect` (~5 lines)

No backend, database, or other file changes needed. The `generate-plate` edge function, storage bucket, and caching layer are all already in place.

