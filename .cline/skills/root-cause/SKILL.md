---
name: root-cause
description: Debugging protocol for recurring/weird bugs in this repo. Use when a symptom resists obvious fixes, appears intermittent, involves sync between surfaces (app<->admin<->DB), or when about to apply more than one speculative patch.
---

# Root Cause (one cause before ten patches)

## Non-negotiable order
1. REPRODUCE yourself. Never accept another agent's error log as ground truth -
   rerun the failing step and capture its actual output.
2. LOCATE the boundary where truth diverges: UI state -> client context ->
   network call -> route handler -> DB row. Probe each side of the failing edge.
3. ONE hypothesis at a time, falsified or confirmed with evidence (probe output,
   HTTP status, DB row). Only then edit.
4. Same-class sweep: fix EVERY sibling site with the identical flaw pattern
   (search callers/consumers), not just the visible instance.
5. Memory Bank: root causes get written to memory-bank/mistakes.md immediately.

## Repo-specific trap map (check these BEFORE exotic theories)
- Order status mismatch app-vs-admin -> local `order_<ts>` id used where server
  cuid expected (or vice versa). Solution class: persist serverId, mutate via it.
- Identity flip after login -> verify/reconcile race guarded by expectedToken.
- Counts wrong on admin -> stored fiction vs computed groupBy live.
- Styles silently ignored -> className prop misuse on gradients/webviews.
- Postgres relation crash -> Prisma 7 bare-array normalization missing.
- Same-userame refetch skip -> keyed guards must include tokenSeq.
- Food/deal chips duplicated image cycling -> resolveListingImage chain broken.

## Stop conditions
Two failed hypotheses on the same surface => STOP coding, dump the full pipeline
trace (request/response pairs, rows, dumps) and re-read systemPatterns.md path
for that feature before continuing.
