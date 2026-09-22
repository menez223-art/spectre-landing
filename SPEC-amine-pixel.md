# Spec: AMINE Pixel Advanced Matching + CAPI

## Objective
Complete the 50% setup of Meta Pixel `AMINE` (id `3436002129913361`) on the SaaS so Meta can properly attribute Lead and Purchase events from `/p/spectre`. Goal: campaign optimisation can finally bid for downstream conversions (not just LPV).

**Why**: Campaign-1 had 692 LPV, $5.09, only 1 Lead + 1 Purchase attributed. Browser-only pixel loses ~30-50% of events to ad blockers and iOS 14. CAPI server-side mirroring + Advanced Matching solves this.

**Isolation**: Only the AMINE pixel + Advanced Matching + CAPI are added. Per-user `MarketingSettings` interface untouched. Other tenants unaffected unless they opt into the same pixel id.

## Tech Stack
Next.js 14.2.32 App Router, TypeScript 5, React 18, sha256 via `node:crypto` (server) + Web Crypto API (client).

## Commands
- Build: `npm run build`
- Lint: `npm run lint`
- Dev: `npm run dev` (port 3000)

## Code Style
- Use existing patterns (already in codebase)
- Hash function: lowercase hex sha256 (Meta spec)
- TypeScript strict mode
- No new dependencies (use `node:crypto` + `crypto.subtle`)

## Testing Strategy
1. **Unit**: New helper `hashPII(value)` — test produces lowercase hex, length 64, deterministic
2. **Integration**: Manual test in browser devtools — verify `fbq('track', 'Purchase', {...})` fires with `em`, `ph`, `fn`, `external_id` keys present
3. **CAPI**: Test with `META_TEST_EVENT_CODE` set; verify event appears in Events Manager → Test Events
4. **Build**: `npm run build` must succeed with zero TS errors

## Boundaries

**Always do:**
- Hash PII before passing to Meta (lowercase, trimmed, SHA-256)
- Use the exact field names Meta expects: `em`, `ph`, `fn`, `ln`, `external_id`
- Send CAPI events with `event_id` matching client-side `fbq('track', ...)` (for dedup)
- Keep all changes opt-in via env vars + existing MarketingSettings flags

**Ask first:**
- Adding new env vars to `.env.local` template — write to file
- Modifying shared files (`OrderForm.tsx`, `/api/sheet/order`) — write to file

**Never do:**
- Commit secrets (`.env.local` is in `.gitignore` — confirm)
- Modify per-user MarketingSettings interface
- Touch ban-check logic
- Push to remote (user said local only)

## Success Criteria

### Phase 1: Advanced Matching in Purchase event (browser)
1. `OrderForm.tsx` passes `em`, `ph`, `fn`, `external_id` (all hashed) in `fbq('track', 'Purchase', {...})` call
2. Test in browser: `fbq` queue contains `Purchase` event with hashed user_data
3. `npm run build` passes

### Phase 2: CAPI server-side
1. New route `/api/meta-capi/route.ts` (or integrated into existing `/api/sheet/order`)
2. After successful Apps Script forward, POST to `https://graph.facebook.com/v18.0/{pixel_id}/events` with same `event_id` as client-side
3. Use `META_ACCESS_TOKEN` env var + `META_AMINE_PIXEL_ID` env var
4. Test in Events Manager → Test Events tab (with `META_TEST_EVENT_CODE`)

### Phase 3: Match quality lift
- Events Manager match quality indicator improves from "Ungraded"/50% to "Good" within 7 days of new events flowing
- Lead event count > 1/day when orders arrive (proxy for attribution working)

## Open Questions
None — all resolved in pre-flight (slug = `spectre`, pixel = `3436002129913361`, isolation via env vars + MarketingSettings gate).

## Files to modify (predicted)

| File | Change | Scope |
|---|---|---|
| `app/lib/utils/security.ts` | Add `hashPII(value: string): string` | Local helper |
| `app/components/landing/OrderForm.tsx:139` | Add `em`, `ph`, `fn`, `external_id` hashed to `fbq('track', 'Purchase', {...})` | All tenants (Advanced Matching is per-event, opt-in by pixel user) |
| `app/api/sheet/order/route.ts` | After successful forward, POST CAPI event | All tenants (CAPI is opt-in via env var presence) |
| `.env.local` (LOCAL ONLY, gitignored) | Add `META_ACCESS_TOKEN`, `META_AMINE_PIXEL_ID`, `META_TEST_EVENT_CODE` | Local config |

## Build order
1. Add `hashPII` helper + tests
2. Modify OrderForm Purchase event to include hashed user_data
3. Add CAPI route + integrate with `/api/sheet/order` success path
4. `npm run build` + `npm run lint`
5. Manual browser verification on `/p/spectre`