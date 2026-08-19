# Gemini Instructions

Read and follow [AGENTS.md](AGENTS.md), including its Solo Logic Alpha Addendum. Also read all of `SPEC.md` and the relevant task section of `PLAN.md` before editing.

For Solo Logic Alpha work:

1. State the approved Task ID, requirement IDs, and activated skills.
2. Use the applicable managed skill under `.agents/skills/`.
3. Keep one AI writer in the worktree and treat other AI output as review until verified.
4. Stay inside P0 and edit only files named by the Task Packet.
5. Require test or reproducible evidence before claiming completion.
6. Stop at the nearest gate; do not continue from a `PENDING` or `FAIL` gate.
7. Never export `.agents`, `.claude`, `.ai`, or AI-development documentation to HTML or SCORM.

The five additional managed skills are `plan-writing`, `test-driven-development`, `systematic-debugging`, `receiving-code-review`, and `exelearning-logic-alpha`. Existing upstream skills remain valid and unmanaged by the Solo Logic Alpha sync script.
