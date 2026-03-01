
Diagnosis (confirmed):
- Yes — those 3 first-page choices are from the deterministic fallback defaults.
- I verified your current run (`22c82a09-933a-47d1-8a08-13b197508628`) in the database:
  - `section_count = 28` (fallback shape, not LLM slim outline)
  - first 3 labels are exactly:
    1) Enter through the main gates
    2) Look for a servant’s entrance
    3) Scale the wall
- I also checked recent runs: all recent runs have `section_count = 28` and the same first choice label, so fallback is happening every time.

Why this is still happening:
- `generate-outline` function logs show:
  - AI headers returned quickly (~20s)
  - but total function completion was ~117s
- Client waits only 60s before giving up and switching to fallback.
- So your app times out client-side before the backend finishes, then stores the fallback outline (hence repeated default choices).

Most likely technical cause:
- The backend timeout guard only covers initial fetch-to-first-response, not full response body consumption/parsing.
- Large AI response body continues downloading/processing after headers, pushing total runtime past client timeout.

Best fix I will implement:
1) Make backend fail fast on full completion time, not just first byte
- Add an end-to-end wall-clock timeout around the entire AI call + body read + parse (e.g., 35–45s hard cap).
- Return explicit timeout error if full JSON isn’t complete in time.

2) Force smaller output further to complete under that cap
- Reduce target section range to a tighter band (e.g., 45–65) in prompt + validator expectations.
- Keep compact keys and strict short-string limits.
- Remove/trim any optional fields that still bloat payload in the response body.

3) Add explicit fallback reason tracking
- Write a small `outline_source` + `fallback_reason` marker into run metadata/log_json when fallback is used.
- This makes it immediately visible whether a run is LLM or default, and why.

4) Prevent “silent default-looking success”
- If fallback is used, show a clear in-app notice (“Used quick fallback due to timeout”) so it’s not mistaken for normal generation.

5) Verify with instrumentation
- Log:
  - ai_headers_ms
  - ai_body_ms
  - parse_ms
  - total_ms
  - client_abort_ms
- Success criteria:
  - first page no longer defaults in normal runs
  - LLM runs complete before client timeout
  - fallback (if any) is clearly labeled and fast

Immediate answer to your question:
- Yes, those three are defaults from fallback. The LLM outline is still not completing within the client’s wait window, so the app is reverting to the demo outline.
