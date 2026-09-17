# Core Conduct (applies to EVERY task in this repo)

## Evidence gates - the supreme rule
NO claim of done/fixed/passing without captured evidence:
- Code change  -> `npx tsc --noEmit` exit 0 in that project's folder.
- Data change  -> HTTP status + response JSON, or DB row shown verbatim.
- UI change    -> verified against REAL render (device pixel scan or a11y dump),
                  never from reading code alone.
Say UNVERIFIED explicitly when skipped. Partial work > hidden breakage.

## Proactive error-hunt (user-mandated standing order)
While touching ANY screen/module, hunt beyond the reported issue:
dead taps, wrong data sources, mock/fabricated identities, stale deps in effects,
missing loading/error/empty states, truncation, race conditions, cross-account leaks.
Report findings explicitly, even when unrelated to the requested change.

## Honesty rules
- Never fabricate users, names, numbers, "verified" badges, timestamps.
- Mock/demo data is debt: replace with REAL data wiring or honest empty states.
- If unsure whether something exists (a file, feature, prior fix), GREP first -
  many things were already built; verify instead of rebuilding.

## Flow-first ordering
Buyer journey (Feed->Product->Cart->Checkout->Track->Review) precedes seller
journey (Become Seller->Create->Dashboard->Orders), which precedes admin polish.
Random screens are forbidden; every change belongs to a journey leg.

## Figma is an idea board
Match Figma CORE structure, scale it industry-practically (more items, scroll,
states, working wiring). Ask "does this element belong?" before cloning it.
Before building something NEW from scratch, use THREE inputs: Figma skeleton +
industry practice + own judgment; prefer own practical patterns over cloned apps.

## Persistence keys & identity
AsyncStorage keys are identity-scoped: `@susej_<key>` sometimes suffixed
`:<username>` when data belongs to one account (wallet/draft/bookmarks/etc).
Any new persisted user-specific key MUST be username-scoped AND cleared by the
identity cache purge lists. Server-backed state refetches beat local caches.

## No dead taps
Every button must DO something real. If a target doesn't exist yet, either build
it, hide it, or render an honest "coming soon" state. Disabled-looking-but-tappable
is a bug.

## Money = INR everywhere
`formatPrice` from utils/theme. Never USD symbols anywhere in UI or seed logic.

## Plan/Act discipline
Complex multi-file tasks: produce a numbered plan with file ownership BEFORE Act.
Parallel-friendly batches -> disjoint files per agent; re-run tsc after each batch
(other workers may have edited neighbours concurrently - re-verify before blaming).
