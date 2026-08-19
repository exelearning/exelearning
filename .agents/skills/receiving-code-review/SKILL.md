---
name: receiving-code-review
description: Evaluate code-review feedback before implementing it. Use when a human or AI reviewer proposes changes, especially when feedback is unclear, broad, technically uncertain, or may conflict with SPEC.md, PLAN.md, existing behavior, or tests.
---

# Receiving Code Review

Treat review comments as claims to verify, not automatic instructions.

## Workflow

1. Read all feedback before changing files.
2. Restate the technical requirement and identify unclear or related items.
3. Check the comment against `SPEC.md`, `PLAN.md`, the active Task Packet, code, tests, and platform constraints.
4. Determine whether the suggestion fixes a real issue without breaking required behavior or expanding scope.
5. Ask for clarification when a material point cannot be verified.
6. Implement verified items one at a time and test each one.

## Priority

Handle blocking correctness/security issues first, then small verified fixes, then larger changes. Stop and request direction when feedback conflicts with an authoritative decision or requires files outside the Task Packet.

## Evidence Rules

- Cite the relevant requirement, code path, reproduction, or test.
- Push back with technical evidence when a suggestion is incorrect or unnecessary.
- Do not add unused "professional" infrastructure without demonstrated use.
- Do not batch unrelated review items into one untestable change.
- Do not claim resolution until the required tests pass.

Return the disposition of each item: accepted and verified, rejected with evidence, needs clarification, or deferred as out of scope.
