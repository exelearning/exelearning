---
name: plan-writing
description: Convert an approved section of SPEC.md and PLAN.md into a small, verifiable Task Packet. Use when starting or splitting Solo Logic Alpha work, before editing files; do not use it to invent a new roadmap or expand scope.
---

# Plan Writing

Create an execution packet from the project's authoritative documents. Keep `SPEC.md` authoritative for requirements and `PLAN.md` authoritative for order.

## Workflow

1. Read `SPEC.md`, the relevant section of `PLAN.md`, and `AGENTS.md`.
2. Identify the exact Task ID, requirement IDs, dependencies, and nearest gate.
3. Inspect the repository before naming files. Do not guess paths.
4. Break the task into 5–8 focused actions when a breakdown is needed.
5. Put verification last and make every completion claim evidence-based.
6. Stop at the nearest gate. Record later ideas as out of scope.

## Required Task Packet

Include:

- `TASK`: approved Task ID and name.
- `SPEC`: requirement IDs.
- `SKILLS`: only skills required for this task.
- `MUC TIEU`: one outcome.
- `FILE DUOC SUA`: exact files allowed to change.
- `KHONG LAM`: explicit exclusions.
- `ACCEPTANCE`: observable behavior or artifact.
- `TEST BAT BUOC`: exact commands and expected result.
- `DAU RA`: diff, test evidence, and remaining risks.

## Rules

- Do not create a competing plan file or rewrite `SPEC.md` or `PLAN.md`.
- Do not add dependencies, features, or files outside the approved task.
- Do not treat a verbal claim of completion as evidence.
- If required files cannot be identified, make repository mapping the task output instead of guessing.
- Keep the packet concise and independently reviewable.
