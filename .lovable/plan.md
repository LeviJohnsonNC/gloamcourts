## Fix Status: Implemented

### Changes Made

1. **Edge function `generate-outline`**: Added 30s AbortController timeout on AI fetch. Relaxed validation — auto-repairs broken links (redirects to nearest valid section), lowered minimum sections to 20 (fatal), endings downgraded to warnings. Returns fast on timeout (504) instead of hanging.

2. **Client `llmService.ts`**: Reduced timeout from 180s to 60s. Added detailed error logging (validation details printed to console).

3. **Client `useGameState.tsx`**: Removed retry loop — single attempt only. Demo fallback now happens in ~60s max instead of ~6 minutes.

4. **Client `outlineValidator.ts`**: Lowered minimum sections from 40 to 20. Auto-repairs broken links instead of hard-failing. Endings/true endings downgraded from errors to warnings. Section count >150 is a warning, not error.

### Expected Timing
- Edge function: responds in 10-30s or fails at 30s
- Client total wait: max 60s before demo fallback
- Previously: 360s+ (2 attempts × 180s timeout)
