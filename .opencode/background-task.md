# Background task: rework misbuilds + logical mistakes (industry-standard)
**Project:** C:\Users\TONI\projects\social-commerce
**Audit source:** qa-audit-opencode.md (P0x2 P1x5 P2x5, clean list verified)
**Model-agnostic config:** provider.opencode.options applies to ANY main model in opencode.jsonc (current: opencode/muse-spark-1.2-contributor-free). Test hook: npx opencode run --model <current-model> "Say hi in 3 words" -> 200.

## Workers (parallel, disjoint ownership)
- W1 wallet/route.ts:66-84 + orders/route.ts + orders/[id]/route.ts: atomic debit via updateMany where walletBalance gte amount, seller credit idempotent via unique title handle
- W2 data/[resource]/route.ts:78-88 + promotions/api-auth.ts: scope banners/sellers/withdrawals to Bearer user (body sellerUsername := auth.user.username, drop kycStatus from app writes)
- Monitor: harness/telemetry/prompt-enhancer.jsonl + opencode logs + tsc both + pytest 28/1

## Order
P0 before P1, one module at a time, evidence-first (repro curl expect 4xx, then fix, then tsc+live probe).
