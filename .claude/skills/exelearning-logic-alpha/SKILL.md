---
name: exelearning-logic-alpha
description: Enforce the approved Solo Logic Alpha scope and gates for eXeLearning. Use for every P0 product task involving Boolean expressions, truth tables, Karnaugh maps, combinational circuits, deterministic grading, iDevice persistence, preview, or offline HTML export.
---

# eXeLearning Solo Logic Alpha

Treat `SPEC.md` as the authoritative requirements source and `PLAN.md` as the authoritative execution order. Read both before editing. Do not copy them into context or replace them with another roadmap.

## P0 Scope

- Boolean expressions and Boolean algebra: lexer/parser, AST, evaluator, equivalence, vector/minterm conversion, and stable SOP minimization for 2–4 variables.
- Truth tables for 2–4 variables with `0`, `1`, and don't-care `X`.
- Karnaugh maps for 2–4 variables with Gray order, overlap, wrap, don't-care handling, coverage, and minimal valid grouping.
- Combinational circuits with Input, Output/LED, NOT, AND, OR, and XOR gates; validate netlists and run deterministic testbenches with `0/1/X` signals.
- Deterministic grading from algorithms and testbench evidence. AI must never create or modify the technical score.
- iDevice save/open, preview, and fully offline HTML export using the same validated data model.

Never use `eval` or `Function` for Boolean input.

## Out of Scope for the Current Sprint

Do not add analog simulation, Arduino, chatbot, RAG, AI grading, sequential logic, clocked elements, SCORM score/resume, P1 gates, or unrelated UI polish. Do not rewrite eXeLearning or change dependencies without a separately approved task.

## Task Gate

Before every development change, require:

- Task ID and requirement IDs.
- `SKILLS` activated for the task.
- Exact files allowed to change.
- Explicit exclusions.
- Exact test commands and expected outcomes.
- Completion evidence: diff, red/green results where applicable, regression result, and remaining risk.

Only one AI may write the worktree at a time. Do not edit outside the Task Packet. Stop at the nearest gate, and never start the next phase while the current gate is `PENDING` or `FAIL`.

## Routing

- Planning/task splitting: use `plan-writing`.
- Core, validators, engines, graders, and bug fixes: use `test-driven-development`.
- Failures or unexpected behavior: use `systematic-debugging`, then TDD after root cause is established.
- Review feedback: use `receiving-code-review` before applying suggestions.

Do not place `.agents`, `.claude`, `.ai`, AI instructions, or development-only skill files into HTML or SCORM output.
