---
name: truth-check
description: Fabrication-hunt sweep for this marketplace codebase. Use before commits, before demo prep, or whenever touching a screen/module whose data sources are unproven. Hunts mock data, fake identities, invented numbers, phantom discounts, dead taps, fake success toasts across Frontend/, susej-admin-panel/, backend/.
---

# Truth Check (fabrication hunt)

Standing user order: PROACTIVE ERROR-HUNT on every touched module. This skill is
that order formalized.

## Sweep list (grep where relevant, verify hits against reality)
1. Mock arrays / seeds in runtime paths: `mock`, `SEED_`, `demo_`, `picsum`,
   `randomuser`, `loremflickr`, `pravatar`.
2. Invented numbers: hardcoded followerCounts, prices, "usedCount",
   win_rate, lastLogin timestamps not derived from rows.
3. Phantom commerce logic: discounts not present server-side (checkout totals),
   free-order holes (paymentMethod case sensitivity), commission fallbacks.
4. Dead taps: buttons without handlers; disabled-looking-but-tappable;
   alerts claiming actions happened.
5. Identity lies: fabricated people (real-looking names in constants),
   POV-switcher leftovers, un-scoped AsyncStorage keys missing `:<username>`.
6. Honest-state gaps: loading/empty/error missing on async lists/details.

## Judgement rules
- Runtime mock data = DEBT: replace with REAL wiring or an honest empty state.
  Delete seeds feeding UI lists.
- Config-only mocks consumed solely by prisma/seed.ts fresh-deploy = acceptable,
  must carry neutral/zero stats (onTimeRate null, usedCount 0, no lastLogin).
- Currency MUST be INR via formatPrice; USD symbols anywhere are findings.
- Report findings file:line, classify CRITICAL/HIGH/MED/LOW, then propose the
  smallest truthful fix. Verify existing fixes with GREP FIRST (many logged
  findings were already fixed - read current source, not memory).
