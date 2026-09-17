---
name: handoff
description: Session-close and handoff ritual ensuring the next session resumes perfectly. Use at end of meaningful work, before compaction/newtask/smol, or when user asks to update memory bank / save progress / wrap up.
---

# Handoff (session-close contract)

## Do, in order
1. Evidence check: any "done" claimed today without evidence either gets evidence
   now or is downgraded to UNVERIFIED in writing.
2. Update `memory-bank/activeContext.md`: NOW section = current mission, open
   threads, device/account state, next action. SUPRESEDES marker if direction
   changed. Keep delta <=15 lines.
3. Update `memory-bank/progress.md`: move shipped items to WORKING, add regressions.
4. If a decision got made -> append decisions.md row. If a root cause surfaced ->
   append mistakes.md row NOW (deferred = forgotten).
5. Mirror the checkpoint summary into the repo AGENTS.md LIVE SESSION CHECKPOINT
   (single most durable home). Compact verbs, absolute paths, evidence cited.
6. Uncommitted batches: list them; commit ONLY on user request.

## Quality bar
Next-session test: could an agent with ZERO chat history pick up the exact next
step (file, screen, account, pending capture) purely from these files? If any
doubt -> your activeContext edit is insufficient; sharpen it.
