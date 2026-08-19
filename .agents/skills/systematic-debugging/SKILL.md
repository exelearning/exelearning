---
name: systematic-debugging
description: Investigate build failures, test failures, Boolean evaluator defects, save/open/export problems, performance issues, and other unexpected behavior. Use before proposing or applying a fix; require reproducible evidence and a testable root-cause hypothesis.
---

# Systematic Debugging

Read `SPEC.md`, `PLAN.md`, the active Task Packet, and `../exelearning-logic-alpha/SKILL.md`. Do not make random fixes.

## Phase 1: Investigate

1. Read the complete error, warning, and stack trace.
2. Capture exact reproduction steps and determine whether the failure is consistent.
3. Inspect relevant recent changes and environment differences.
4. Trace bad data or state backward to its origin.
5. At component boundaries, capture inputs, outputs, configuration, and state without exposing secrets.

If the issue is not reproducible, gather more evidence instead of guessing. See [root-cause-tracing.md](root-cause-tracing.md).

## Phase 2: Compare Patterns

1. Find a similar working path in the repository.
2. Read the reference implementation completely.
3. List every relevant difference.
4. Identify dependencies and assumptions.

## Phase 3: Test a Hypothesis

State one hypothesis: "X is the root cause because Y." Test it with the smallest safe, reversible diagnostic change and one variable at a time. If evidence rejects it, return to investigation and form a new hypothesis.

## Phase 4: Implement and Verify

1. Create a failing reproduction using [test-driven-development](../test-driven-development/SKILL.md).
2. Apply one fix at the source of the defect.
3. Run the focused test and relevant regression tests.
4. Confirm the original reproduction no longer fails.
5. Add proportionate validation at affected boundaries; see [defense-in-depth.md](defense-in-depth.md).

After three failed fixes, stop and discuss whether the architecture or assumptions are wrong. Do not stack a fourth speculative fix.

For flaky asynchronous tests, replace arbitrary delays with condition-based checks; see [condition-based-waiting.md](condition-based-waiting.md).

## Required Output

Report reproduction input, observations, root-cause hypothesis, evidence confirming or rejecting it, the minimal fix if authorized, commands run, and residual risk.
