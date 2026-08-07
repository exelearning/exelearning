---
id: ADR-2184-01
title: "Do not implement a generic open-response assessment iDevice"
status: Proposed
date: 2026-07-16
tracking_issue: 2184
legacy_id: ADR-0042
deciders:
  - "@erseco"
reviewers:
  - "@cristinavaldera"
related:
  prs: []
  changes: []
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "ChatGPT"
  model: "GPT-5.6 Thinking"
---

# ADR-2184-01: Do not implement a generic open-response assessment iDevice

## Context

eXeLearning is primarily an authoring and publishing tool for reusable educational
content. A project may be exported as HTML, a single page, EPUB, IMS Content Package,
SCORM 1.2, or SCORM 2004. The same authored resource may consequently be used inside
an LMS, embedded by another host, downloaded for offline use, or opened as a standalone
website.

A proposal was raised, following a suggestion from @cristinavaldera, to add an
open-response question type. A learner would enter free text and the response would be
transferred through SCORM or another tracking channel so that a teacher could inspect it
and, potentially, publish a grade in an LMS gradebook.

The proposal sounds superficially similar to adding a text area to an existing assessment
iDevice. It is not. It combines at least four different product concepts:

1. **Reflection prompt**: the learner thinks or writes privately, with no submission.
2. **Persisted response**: the learner expects the text to survive reloads or device changes.
3. **Submission**: the learner intentionally hands work to an identified recipient.
4. **Manual assessment**: a teacher reviews the submission, applies criteria, provides
   feedback, records a grade, and may allow revision or another attempt.

Only the first concept is naturally self-contained inside a portable learning resource.
The remaining concepts require identity, durable storage, submission state, permissions,
attempt ownership, teacher workflow, feedback, retention rules, reporting, and often
calendar or deadline semantics. A response transport field does not provide those
semantics by itself.

The current eXeLearning assessment architecture is score-oriented:

- the `form` iDevice supports dropdown, selection, true/false, and fill question types;
- gradable iDevices calculate a numeric result locally;
- SCORM tracking stores per-iDevice score summaries in `cmi.suspend_data` and publishes
  an aggregate numeric score and status;
- the xAPI emitter sends `answered` statements containing score, success, and completion,
  but not a free-text learner response;
- host-side identity, persistence, and gradebook mapping are explicitly the responsibility
  of the embedding platform.

These observations are documented in the current implementation and tracking reference:

- [`form` authoring model](https://github.com/exelearning/exelearning/blob/0cc414b78c040ec6ca22546152c8840e5be89e5a/public/files/perm/idevices/base/form/edition/form.js)
- [SCORM score aggregation](https://github.com/exelearning/exelearning/blob/0cc414b78c040ec6ca22546152c8840e5be89e5a/public/app/common/common.js)
- [xAPI statement emitter](https://github.com/exelearning/exelearning/blob/0cc414b78c040ec6ca22546152c8840e5be89e5a/public/app/common/xapi/exe_xapi.js)
- [tracking emission reference](https://github.com/exelearning/exelearning/blob/0cc414b78c040ec6ca22546152c8840e5be89e5a/doc/elpx-format/tracking-emission.md)

The Moodle integration does not make the proposal small. `mod_exelearning` currently maps
SCORM/xAPI results into numeric attempt rows and grade items. Its xAPI normalizer requires
a score for an `answered` statement, its attempt schema contains numeric scores and
statuses, and its teacher report lists scores rather than submitted text or manual-grading
state:

- [attempt and grade schema](https://github.com/exelearning/mod_exelearning/blob/5e1421a193c5a7854c2a11d870320189de269d70/db/install.xml)
- [xAPI statement normalization](https://github.com/exelearning/mod_exelearning/blob/5e1421a193c5a7854c2a11d870320189de269d70/classes/local/xapi/statement_normalizer.php)
- [xAPI ingestion and grade routing](https://github.com/exelearning/mod_exelearning/blob/5e1421a193c5a7854c2a11d870320189de269d70/classes/local/xapi/ingestor.php)
- [attempt report](https://github.com/exelearning/mod_exelearning/blob/5e1421a193c5a7854c2a11d870320189de269d70/report.php)

Implementing a credible open-response feature would therefore require coordinated changes
in both repositories and in every supported delivery context. It would also create a new
long-lived assessment workflow rather than a new isolated iDevice control.

## Problem

Should eXeLearning implement a generic open-response assessment iDevice that persists or
submits learner text and supports transfer to an LMS for manual review or grading?

## Decision drivers

- **Pedagogical purpose before input format.** A text box is not evidence that reflection,
  feedback, or learning has occurred.
- **Operational completeness.** A submission feature must not imply that work is stored,
  delivered, reviewed, or recoverable when those guarantees are absent.
- **Proportionality.** The expected use is occasional reflection, while the implementation
  and maintenance burden spans authoring, export, standards, storage, grading, reporting,
  privacy, and accessibility.
- **Product affordances.** Easy-to-add controls shape course-author behavior. A generic
  open-response control may be used as a substitute for designing a suitable assignment
  and feedback process.
- **Portability.** eXeLearning resources must remain meaningful outside a specific LMS.
- **Clear ownership.** Identity, deadlines, submissions, rubrics, teacher feedback, and
  grade appeals are LMS responsibilities unless eXeLearning explicitly becomes an
  assessment-delivery platform.
- **Interoperability realism.** A standard field capable of carrying text does not ensure
  that different LMS products expose it to teachers or connect it to a manual-grading
  workflow consistently.
- **Privacy and data lifecycle.** Free text can contain personal or sensitive information
  and needs defined retention, deletion, export, access-control, and audit behavior.
- **Accessibility.** A complete workflow must cover keyboard operation, instructions,
  validation, status announcements, draft recovery, error recovery, review, and feedback;
  rendering an accessible text area is only a small part of the requirement.
- **Maintenance scope.** The feature would require compatibility and regression testing
  across SCORM 1.2, SCORM 2004, xAPI embedding, standalone HTML, single-page exports,
  desktop/offline use, and host integrations.
- **Avoiding duplication.** LMS assignment and essay-question activities already own the
  submission and manual-assessment lifecycle.

## Options considered

### Option 1: Add a generic open-response iDevice and transmit the answer through SCORM

SCORM data models can represent learner interactions, including learner responses. This
makes transport technically possible in conforming runtimes. The iDevice could create an
interaction entry and place the learner text in the relevant response field.

#### Advantages

- Uses a widely deployed LMS-content communication mechanism.
- Could make the response visible in LMS products that expose interaction details.
- Keeps the learner inside the exported resource while responding.

#### Disadvantages

- SCORM specifies data exchange, not a portable teacher-marking user interface.
- LMS products vary in how interaction data are stored, reported, truncated, exported, or
  made available for grading.
- A response appearing in an interaction report does not create a grade item, an ungraded
  state, a rubric, teacher feedback, reassessment, or gradebook synchronization.
- eXeLearning would need separate SCORM 1.2 and SCORM 2004 implementations and extensive
  cross-LMS validation.
- The current eXeLearning SCORM implementation is intentionally score-oriented and uses a
  project-specific `cmi.suspend_data` serialization. Extending that serialization with
  arbitrary text would introduce escaping, size, migration, localization, and parser
  compatibility risks.
- Standalone and EPUB use would still lack a recipient and durable shared storage.

This option is rejected because protocol capability is being mistaken for a complete
assessment workflow.

### Option 2: Send `result.response` through xAPI and build manual grading in `mod_exelearning`

The xAPI statement model supports a textual `result.response`. eXeLearning could emit it,
and `mod_exelearning` could persist submissions and provide a Moodle grading interface.

#### Advantages

- Provides a cleaner semantic representation than overloading `cmi.suspend_data`.
- Uses the existing `postMessage`-based xAPI bridge between eXeLearning and
  `mod_exelearning`.
- Allows a controlled implementation for one known host rather than relying on every
  SCORM LMS report.

#### Disadvantages

- Requires a new response/submission data model, nullable or pending grades, grader
  identity, feedback, revision history, capabilities, group restrictions, privacy
  metadata, backup/restore, mobile services, reporting, export, deletion, and audit events.
- Requires explicit decisions about drafts, submission finality, late changes, retries,
  duplicate statements, multiple tabs, multiple attempts, reopened attempts, and package
  revisions.
- Requires a teacher-facing inbox or grading page; the Moodle gradebook alone is not a
  response-review interface.
- Creates a dependency between an otherwise portable eXeLearning iDevice and a specific
  Moodle plugin implementation.
- Duplicates mature LMS-native assignment and essay-question workflows.
- Does not solve standalone use unless another host or LRS implements equivalent product
  behavior.

This option is rejected as disproportionate to the observed demand and outside the core
responsibility of the authoring tool.

### Option 3: Provide a standalone reflective text area with browser-local persistence

The response could be saved in `localStorage` or IndexedDB and optionally copied,
printed, or downloaded by the learner.

#### Advantages

- Works without an LMS or network connection.
- Can support private note-taking or a short metacognitive prompt.
- Avoids server-side personal-data storage by default.

#### Disadvantages

- Browser-local state is tied to a browser profile and device and may be removed without
  warning.
- It cannot truthfully be described as a submission or teacher-visible response.
- Shared devices create confidentiality and attribution risks.
- Exported packages, package updates, origin changes, private browsing, storage eviction,
  and embedded contexts complicate recovery.
- Download/copy controls shift file naming, delivery, identity, and receipt confirmation
  to the learner and teacher.
- A persistent text area may imply a level of durability that the resource cannot
  guarantee.
- The pedagogical benefit of an unreviewed text box depends on careful prompting,
  scaffolding, learner motivation, and subsequent use; those conditions are not created by
  the control itself.

This option is rejected as a generic iDevice. Authors can already place a reflection prompt
in normal content without creating misleading persistence or submission semantics.

### Option 4: Add the iDevice but leave grading and feedback to future integrations

This would implement only authoring and response capture now and defer the operational
workflow.

#### Advantages

- Smaller initial change.
- Could provide a base for future LMS integrations.

#### Disadvantages

- Exposes an incomplete feature to course authors and learners.
- Creates immediate expectations about storage, delivery, grading, and privacy.
- Encourages content that host platforms cannot process consistently.
- Converts an architectural gap into compatibility debt that future maintainers must
  support.
- Conflicts with the repository principle that changes should be complete and sustainable,
  not compatibility shims or partial implementations.

This option is rejected because shipping the control first would create the exact misuse
and operational ambiguity that the decision is intended to avoid.

### Option 5: Do not add a generic open-response assessment iDevice

Occasional reflection remains an authored pedagogical prompt with no submission semantics.
When a learner response must be delivered, reviewed, or graded, the course uses the
native assignment or essay-question facility of its LMS or another purpose-built
assessment service.

#### Advantages

- Preserves a clear boundary between portable learning content and host-owned assessment
  workflow.
- Avoids implying guarantees that standalone exports cannot provide.
- Avoids duplicating LMS storage, grading, privacy, and reporting features.
- Reduces the risk that course designers add easily authored open-response tasks without
  budgeting for teacher feedback and marking.
- Keeps reflection available as a pedagogical technique without turning every prompt into
  a tracked assessment.

#### Disadvantages

- Authors cannot collect free-text learner responses directly from a generic eXeLearning
  package.
- A course may require learners to move from the eXeLearning content to an LMS activity.
- The same prompt may need to be represented in both the resource and the LMS.
- eXeLearning will not provide a universal open-response report across LMS products.

This is the selected option.

## Evidence

### Technical evidence

1. The current `form` iDevice has four constrained question types and a local automatic
   scoring model. Adding an unscored response is not an existing configuration variation;
   it changes the activity lifecycle and result model.
2. The shared gamification tracking path serializes numeric scores for SCORM and forwards
   numeric scores to xAPI. It has no learner-response object or pending-manual-grade state.
3. The xAPI emitter can technically add `result.response`, but its current contract emits
   completed, scored interactions and derives package completion/pass-fail statements from
   those scores.
4. `mod_exelearning` authenticates the Moodle user and routes incoming scores to numeric
   attempt rows and grade items. Its schema and reports do not store or review arbitrary
   response text.
5. SCORM and xAPI can carry interaction data, but neither standard mandates a common LMS
   teacher workflow for manual review, feedback, rubrics, or gradebook publication.

The relevant code and standards are listed in [References](#references).

### Pedagogical evidence

The decision does **not** claim that constructed responses or reflective writing are
pedagogically ineffective. They can expose reasoning, support retrieval, and encourage
metacognition. The narrower conclusion is that a generic text-entry control is not a
complete or reliably useful implementation of those methods.

Published assessment research supports the following distinctions:

- Formative value depends on learners receiving and using information that helps close the
  gap between current and desired performance. Capturing an answer without an actionable
  feedback loop does not establish formative assessment (Sadler, 1989; Black and Wiliam,
  1998; Nicol and Macfarlane-Dick, 2006).
- The effectiveness of an item format depends heavily on design, context, feedback, and
  alignment with learning outcomes. Multiple-choice or constrained-response formats are
  not inherently limited to low-level learning when deliberately designed and used with
  feedback (Nicol, 2007).
- Meta-analytic and comparative work indicates that item format alone does not reliably
  determine the construct being measured. Carefully designed selected-response formats
  can approximate important properties of constructed-response tasks while being more
  scalable to score (Rodriguez, 2003; Slepkov and Shiell, 2014; Lin and Singh, 2016).
- Constructed responses impose real scoring-cost and inter-rater-reliability constraints.
  These constraints become product requirements when a platform invites routine use,
  rather than incidental concerns left to individual teachers (Slepkov and Shiell, 2014;
  Matelsky et al., 2023).
- Reflection is contextual and normally requires modelling, scaffolding, criteria,
  dialogue, or feedback. Research warns against treating reflective writing as a generic,
  decontextualized requirement or assuming that requiring text produces authentic
  reflection (Boud and Walker, 1998; Hobbs, 2007; Dyment and O'Connell, 2011).
- In a learner-controlled course using self-assessment and reflection, many students
  engaged only superficially even though some benefited. This illustrates that the prompt
  and surrounding learning design matter more than the availability of a response field
  (Phillips, 2016).
- Constructive alignment requires assessment tasks and criteria to follow from intended
  learning outcomes. Adding a generic control because it is easy to author can reverse
  that sequence: the available feature begins to determine the task rather than the
  learning objective determining the assessment (Biggs, 1996).

The evidence therefore supports providing reflective and constructed-response activities
only where their purpose, feedback, and assessment workflow are deliberately designed. It
does not support adding an unbounded response control as a default portable iDevice.

### Contextual operational evidence: Canary Islands deployment

A previous LMS used in the Canary Islands included an open-question capability. Operational
experience reported by the educational technology team was negative in a recurring
pattern:

- course designers could create open-response tasks quickly;
- the low authoring cost encouraged use where a more specific activity or an untracked
  reflection prompt would have been sufficient;
- the deferred cost appeared later as repeated manual evaluation for teaching staff;
- teacher workload increased because each cohort generated a new marking queue;
- the feature did not itself ensure criteria, useful feedback, moderation, or an adequate
  response-management workflow.

This is local experience, not a controlled study and not evidence that every open-response
activity is harmful. It is relevant product evidence because it shows a plausible affordance
failure in an institutional context close to eXeLearning's users: the feature optimized the
course designer's immediate task while externalizing recurring cost to teachers.

The published literature above does not prove that the same pattern must recur. It does
show that feedback, scoring reliability, context, and teacher effort are intrinsic parts of
a serious constructed-response design. The local experience therefore strengthens the
risk assessment without being presented as universally generalizable research.

## Decision

We will **not implement a generic open-response assessment iDevice** in eXeLearning.

Specifically:

- eXeLearning will not add a general-purpose free-text question whose answer is persisted
  or submitted as part of the portable package;
- eXeLearning will not extend SCORM or xAPI tracking solely to transport arbitrary learner
  text for a future or unspecified manual-grading workflow;
- eXeLearning will not describe browser-local storage as a submission mechanism;
- eXeLearning will not add automatic or AI grading as a way to make this proposal
  operational without a separate architecture, privacy, validity, and governance decision;
- occasional reflection prompts may be authored using normal content, such as a Text or
  Case study iDevice, without persistence, submission, or grading semantics;
- when a response must be identified, submitted, reviewed, commented on, graded, retained,
  or appealed, authors should use the native assignment or essay-question workflow of the
  host LMS or another purpose-built assessment platform.

This decision rejects a **generic product feature**, not open responses as a teaching
method. A future narrowly scoped proposal may supersede this ADR if it defines a complete
end-to-end use case and demonstrates sufficient demand and ownership.

## Consequences

### Positive

- The portable content model remains independent of host-specific submission workflows.
- Learners are not shown a response field that may fail to persist or reach a teacher.
- Course authors are less likely to mistake a convenient text box for a complete formative
  or summative assessment design.
- Teacher feedback and marking costs remain visible when the activity is created in the
  LMS workflow that owns them.
- eXeLearning avoids duplicating assignment, essay grading, rubric, privacy, backup,
  reporting, and gradebook features.
- The SCORM/xAPI tracking contract remains focused on results the package can determine
  itself.
- Maintenance and test scope remain proportionate to the observed use case.
- Reflection remains possible without forcing it to become tracked or graded.

### Negative

- eXeLearning packages cannot collect and centrally report arbitrary learner text by
  themselves.
- Authors who need a submitted response must configure a separate LMS activity.
- Learners may need to move between the content and the LMS assessment interface.
- Offline resources cannot provide a teacher-visible reflection workflow.
- Some users may regard the absence of a text-response control as a functional gap.

### Neutral

- Existing assessment iDevices continue to provide automatic scores and feedback.
- Existing Text and Case study content can still present questions for private or classroom
  reflection.
- SCORM and xAPI remain technically capable of carrying richer interaction data; this ADR
  decides not to build a generic manual-assessment product around that capability.
- A specific institution may integrate its own external form or LMS activity, accepting
  responsibility for the resulting privacy, persistence, and support model.

## Risks

### Risk: users create unsafe or inaccessible workarounds

Authors may embed third-party forms or ask learners to send files or email responses.
This could create worse privacy, accessibility, or support outcomes.

**Mitigation:** documentation and training should recommend LMS-native assignment or essay
activities when a response needs submission and grading, and plain untracked prompts when
only reflection is intended.

### Risk: a valuable future use case is rejected too broadly

A future host integration may provide a complete response and grading workflow with
validated demand.

**Mitigation:** this ADR can be superseded. Reconsideration requires a concrete host,
responsible maintainers, an end-to-end workflow, evidence of demand beyond an isolated
request, and a plan for standalone behavior, accessibility, privacy, testing, and support.

### Risk: the boundary between content and assessment is inconvenient

Teachers may need to duplicate a prompt or direct learners from the resource to the LMS.

**Mitigation:** host platforms may deep-link or embed their native activity. Improving
embedding or linking is a smaller and clearer problem than implementing a second
submission platform inside eXeLearning.

### Risk: local institutional experience is over-generalized

The Canary Islands experience is observational and context-specific.

**Mitigation:** it is explicitly labelled contextual and is used only as evidence of a
plausible product-affordance risk. The decision also rests on repository architecture,
standards boundaries, published assessment research, and proportionality.

## Validation

This decision will be considered validated when:

- reviewers agree that the four concepts—reflection, persistence, submission, and manual
  assessment—must not be conflated;
- no current supported export or integration can provide a consistent end-to-end workflow
  without substantial new platform behavior;
- the documentation clearly directs submitted and graded responses to LMS-native tools;
- future feature requests can be evaluated against the reconsideration criteria below
  instead of restarting the architectural analysis from a text-area mock-up.

The decision should be reconsidered only when a proposal supplies all of the following:

1. evidence of sustained demand from multiple deployments or a funded institutional owner;
2. a precise pedagogical use case that cannot be met adequately by an LMS-native activity
   or an untracked reflection prompt;
3. a defined host and learner-identity model;
4. durable draft, submission, retry, revision, feedback, grade, and deletion semantics;
5. standalone and unsupported-host behavior that does not mislead learners;
6. accessibility, privacy, security, retention, backup, and audit requirements;
7. interoperability tests for every claimed standard and LMS target;
8. an explicit long-term maintenance owner.

## Follow-up work

- Close [#2184](https://github.com/exelearning/exelearning/issues/2184) when this ADR is
  accepted.
- Keep this ADR at `Proposed` until reviewer approval.
- When authoring guidance is next revised, distinguish an untracked reflection prompt from
  an LMS submission and recommend the appropriate tool for each.
- Do not create implementation issues for a generic open-response iDevice under this
  decision.

## References

### Repository and standards

1. eXeLearning contributors. (2026). [`form` iDevice authoring model](https://github.com/exelearning/exelearning/blob/0cc414b78c040ec6ca22546152c8840e5be89e5a/public/files/perm/idevices/base/form/edition/form.js), commit `0cc414b78c040ec6ca22546152c8840e5be89e5a`.
2. eXeLearning contributors. (2026). [Shared gamification and SCORM score tracking](https://github.com/exelearning/exelearning/blob/0cc414b78c040ec6ca22546152c8840e5be89e5a/public/app/common/common.js), commit `0cc414b78c040ec6ca22546152c8840e5be89e5a`.
3. eXeLearning contributors. (2026). [eXeLearning xAPI emitter](https://github.com/exelearning/exelearning/blob/0cc414b78c040ec6ca22546152c8840e5be89e5a/public/app/common/xapi/exe_xapi.js), commit `0cc414b78c040ec6ca22546152c8840e5be89e5a`.
4. eXeLearning contributors. (2026). [Tracking emission: SCORM and xAPI](https://github.com/exelearning/exelearning/blob/0cc414b78c040ec6ca22546152c8840e5be89e5a/doc/elpx-format/tracking-emission.md), commit `0cc414b78c040ec6ca22546152c8840e5be89e5a`.
5. `mod_exelearning` contributors. (2026). [Database schema](https://github.com/exelearning/mod_exelearning/blob/5e1421a193c5a7854c2a11d870320189de269d70/db/install.xml), commit `5e1421a193c5a7854c2a11d870320189de269d70`.
6. `mod_exelearning` contributors. (2026). [xAPI statement normalizer](https://github.com/exelearning/mod_exelearning/blob/5e1421a193c5a7854c2a11d870320189de269d70/classes/local/xapi/statement_normalizer.php), commit `5e1421a193c5a7854c2a11d870320189de269d70`.
7. `mod_exelearning` contributors. (2026). [xAPI ingestor](https://github.com/exelearning/mod_exelearning/blob/5e1421a193c5a7854c2a11d870320189de269d70/classes/local/xapi/ingestor.php), commit `5e1421a193c5a7854c2a11d870320189de269d70`.
8. `mod_exelearning` contributors. (2026). [Attempts report](https://github.com/exelearning/mod_exelearning/blob/5e1421a193c5a7854c2a11d870320189de269d70/report.php), commit `5e1421a193c5a7854c2a11d870320189de269d70`.
9. Advanced Distributed Learning Initiative. [SCORM resources and technical specifications](https://adlnet.gov/resources/scorm-resources/).
10. Advanced Distributed Learning Initiative. [Experience API data specification](https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md), especially `result.response`.

### Assessment, feedback, and reflection

11. Biggs, J. (1996). Enhancing teaching through constructive alignment. *Higher Education, 32*, 347–364. https://doi.org/10.1007/BF00138871
12. Black, P., & Wiliam, D. (1998). Assessment and classroom learning. *Assessment in Education: Principles, Policy & Practice, 5*(1), 7–74. https://doi.org/10.1080/0969595980050102
13. Boud, D., & Walker, D. (1998). Promoting reflection in professional courses: The challenge of context. *Studies in Higher Education, 23*(2), 191–206.
14. Butler, A. C., & Roediger, H. L. III. (2008). Feedback enhances the positive effects and reduces the negative effects of multiple-choice testing. *Memory & Cognition, 36*(3), 604–616. https://doi.org/10.3758/MC.36.3.604
15. Dyment, J. E., & O'Connell, T. S. (2011). Assessing the quality of reflection in student journals: A review of the research. *Teaching in Higher Education, 16*(1), 81–97. https://doi.org/10.1080/13562517.2010.507308
16. Gibbs, G., & Simpson, C. (2004). Conditions under which assessment supports students' learning. *Learning and Teaching in Higher Education, 1*, 3–31.
17. Hobbs, V. (2007). Faking it or hating it: Can reflective practice be forced? *Reflective Practice, 8*(3), 405–417. https://doi.org/10.1080/14623940701425063
18. Lin, S.-Y., & Singh, C. (2016). [Can multiple-choice questions simulate free-response questions?](https://arxiv.org/abs/1603.07910) arXiv:1603.07910.
19. Matelsky, J. K., Parodi, F., Liu, T., Lange, R. D., & Kording, K. P. (2023). [A large language model-assisted education tool to provide feedback on open-ended responses](https://arxiv.org/abs/2308.02439). arXiv:2308.02439.
20. Nicol, D. J. (2007). E-assessment by design: Using multiple-choice tests to good effect. *Journal of Further and Higher Education, 31*(1), 53–64. https://doi.org/10.1080/03098770601167922
21. Nicol, D. J., & Macfarlane-Dick, D. (2006). Formative assessment and self-regulated learning: A model and seven principles of good feedback practice. *Studies in Higher Education, 31*(2), 199–218. https://doi.org/10.1080/03075070600572090
22. Phillips, J. A. (2016). [Student self-assessment and reflection in a learner controlled environment](https://arxiv.org/abs/1608.00313). arXiv:1608.00313.
23. Rodriguez, M. C. (2003). Construct equivalence of multiple-choice and constructed-response items: A random effects synthesis of correlations. *Journal of Educational Measurement, 40*(2), 163–184.
24. Sadler, D. R. (1989). Formative assessment and the design of instructional systems. *Instructional Science, 18*, 119–144. https://doi.org/10.1007/BF00117714
25. Slepkov, A. D., & Shiell, R. C. (2014). A comparison of integrated testlet and constructed-response question formats. *Physical Review Special Topics—Physics Education Research, 10*, 020120. https://doi.org/10.1103/PhysRevSTPER.10.020120
