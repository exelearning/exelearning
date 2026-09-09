---
id: ADR-2374-01
title: "Require human-authored first contributions"
status: Proposed
date: 2026-09-08
tracking_issue: 2374
deciders:
  - "@erseco"
reviewers: []
related:
  prs: [2374]
  changes: []
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "ChatGPT"
  model: "GPT-5.6 Sol"
---

# ADR-2374-01: Require human-authored first contributions

## Context

eXeLearning welcomes external contributions and explicitly directs newcomers toward documentation and issues labeled `good first issue` in `doc/development/contributing.md`.

Maintainers need to be able to establish that a new contributor understands the code they submit, the problem being solved, and review feedback before relying on that contributor's future work. Generative AI tools can produce implementations, tests, pull request descriptions, and review responses without providing that evidence of understanding.

Other open-source projects have adopted restrictions on AI use for newcomer-oriented work. Strimzi's published AI policy, for example, does not allow generative AI for issues marked `good-start`, explaining that these issues are intended to help new contributors learn the codebase and gain experience.

## Problem

Should eXeLearning accept a contributor's first pull request when generative AI substantially produced the contribution on their behalf?

## Decision drivers

- Make first contributions useful for establishing contributor understanding.
- Preserve `good first issue` tasks as learning opportunities.
- Reduce maintainer review effort spent validating contributions whose author may not understand the submitted changes.
- Keep the restriction narrow rather than banning AI-assisted development for established contributors.
- Make the rule visible before contributors invest time in a pull request.

## Options considered

### Option 1: Allow unrestricted generative AI use

Treat AI-generated first contributions the same as any other pull request and rely entirely on normal review and CI.

This imposes no special contributor restriction, but it does not give maintainers confidence that a first-time contributor understands the implementation or can respond independently to review feedback.

### Option 2: Require first contributions to be human-authored

Do not accept first-time pull requests generated or substantially produced by generative AI. Require the contributor to produce and understand the implementation, tests, pull request description, and review responses themselves.

This preserves the first contribution as evidence of understanding while leaving future AI policy for established contributors outside the scope of this decision.

### Option 3: Ban generative AI for all contributions

Prohibit AI-assisted development throughout the project.

This would provide a simple rule but would go substantially beyond the immediate concern and would prevent established contributors from choosing tools they can use responsibly while retaining ownership and understanding of their work.

## Evidence

- `doc/development/contributing.md` on `main` directs newcomers toward small issues labeled `good first issue` and requires an ADR for changes to AI-assisted generation policy.
- `doc/architecture/adr/README.md` lists AI-assisted generation workflows and policies among decisions requiring an ADR.
- Strimzi Governance, `AI_POLICY.md`, states that generative AI must not be used for `good-start` issues because those issues are intended to help new contributors learn the codebase and gain experience: https://github.com/strimzi/governance/blob/main/AI_POLICY.md

## Decision

We will require a contributor's first pull request to eXeLearning to be their own work. First-time contributions generated or substantially produced with generative AI will not be accepted.

For the first pull request, generative AI must not produce the implementation, tests, pull request description, or responses to review feedback on the contributor's behalf. Contributors must understand and be able to explain every change they submit.

This decision does not establish a blanket ban on AI-assisted development for contributors with prior accepted contributions.

## Consequences

### Positive

- Maintainers can use a first contribution to evaluate whether the contributor understands their work.
- `good first issue` tasks remain useful as onboarding and learning opportunities.
- Review discussions with first-time contributors are more likely to reflect the contributor's own reasoning.
- The policy remains narrowly scoped to the onboarding problem.

### Negative

- Legitimate first-time contributors who routinely use AI-assisted development tools must temporarily change their workflow.
- Enforcement cannot rely solely on automated detection and may require maintainer judgement.
- The boundary of "substantially produced" can require case-by-case interpretation.

### Neutral

- Normal CI, testing, security, and code-review requirements continue to apply to every contribution.
- AI policy for established contributors remains unchanged by this ADR.

## Risks

The main risk is inconsistent enforcement. Maintainers should apply the policy based on the contribution and review interaction rather than assumptions about a contributor's identity, location, experience, or writing style.

Another risk is treating AI-detection tools as authoritative. This policy does not require or endorse automated AI detection; maintainers retain normal review discretion.

## Validation

Review the policy after maintainers have handled a representative set of first-time contributions. Revisit the ADR if the rule creates disproportionate barriers to legitimate contributors or does not reduce review burden.

## Follow-up work

- Document the rule in `doc/development/contributing.md`.
- Apply the same wording consistently when responding to first-time contributors who ask to work on issues.

## References

- PR #2374: https://github.com/exelearning/exelearning/pull/2374
- eXeLearning contributing guide: `doc/development/contributing.md`
- eXeLearning ADR policy: `doc/architecture/adr/README.md`
- Strimzi AI policy: https://github.com/strimzi/governance/blob/main/AI_POLICY.md
