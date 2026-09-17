# Cline's Memory Bank (project: social-commerce-template / susej)

My memory resets between sessions. The ONLY thing that carries knowledge forward is
the Memory Bank. Before ANY task I MUST read these files (in order):

1. `memory-bank/projectbrief.md`   - what this project IS and is NOT
2. `memory-bank/productContext.md` - why it exists, UX goals
3. `memory-bank/techContext.md`    - stack, paths, ports, env, run commands
4. `memory-bank/systemPatterns.md` - architecture + established patterns
5. `memory-bank/activeContext.md`  - CURRENT mission, recent changes, next steps
6. `memory-bank/progress.md`       - what works / pending / known issues
7. `memory-bank/decisions.md`      - standing decisions (do NOT re-litigate)
8. `memory-bank/mistakes.md`       - recurring traps (NEVER repeat)

Do NOT re-explore what these files answer. If a question is answered there,
cite it and move on. If something contradicts them, verify against reality
(files/DB/API) FIRST, then update the Memory Bank file.

## Update triggers (update the SMALLEST sufficient file)
- New decision made            -> decisions.md (append row: choice / reason / revisit-if)
- Root cause identified        -> mistakes.md immediately (do not defer)
- Milestone shipped or verified-> progress.md + activeContext.md
- Direction change from user   -> activeContext.md top (SUPRESEDES marker)
- User says "update memory bank" / "hand off" -> review ALL 8 files
- Context getting long         -> write state into activeContext.md BEFORE compacting;
  commands "/newtask", "/smol", compaction are safe once activeContext is current.

## Session-close contract
Before ending any meaningful work: refresh activeContext.md "NOW" section and
progress.md deltas in <=15 lines total. Stale activeContext = failed session.

## Truth hierarchy when sources disagree
Live verification (API/DB/device) > source code > memory-bank > my recall.
Never quote a number (row counts, balances, prices) without an evidence class:
exit-code / HTTP status+JSON / device pixel-scan. No evidence = UNVERIFIED.
