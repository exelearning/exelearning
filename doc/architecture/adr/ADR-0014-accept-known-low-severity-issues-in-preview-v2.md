---
id: ADR-0014
title: "Accept a bounded set of known low-severity issues in the preview v2 rollout"
status: Proposed
date: 2026-07-11
deciders:
  - "@erseco"
reviewers:
  - "@github-user"
related:
  issues: []
  prs: [1968]
  sdds: [SDD-0003]
  adrs: [ADR-0013]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-fable-5"
---

# ADR-0014: Accept a bounded set of known low-severity issues in the preview v2 rollout

## Status

Proposed

## Context

The preview serving contract v2 work (ADR-0013, SDD-0003) — core plus the five
platform adapters (`mod_exelearning`, `wp-exelearning`, `omeka-s-exelearning`,
`nextcloud-exelearning`, Procomún) — was put through a multi-agent adversarial
code review before merge. Every finding at **critical/high/medium** severity was
fixed with tests:

- CSP-bypass via a web-servable session store (Omeka `files/`, WordPress
  `wp-content/uploads/`) — deny guards added.
- Silent-empty-document on a failed upload part (Moodle, WordPress; Omeka was
  already immune) — the whole revision/batch is now rejected.
- Unbounded revision retention → disk-fill DoS (Nextcloud) — superseded
  revisions pruned to the active one.
- DELETE-vs-upload race inflating the process-global byte counter (core) —
  session liveness re-asserted before the mutation.
- `extractToNewTab` bypassing the refresh single-flight, transient asset
  rejections blacklisted permanently, `checkDrift` interval without teardown
  (core client) — all fixed.

Four **low**-severity findings were also judged worth fixing pre-merge and were
(Moodle `NO_DEBUG_DISPLAY`; Moodle traversal parity on invalid-UTF-8 percent
sequences; Nextcloud reporting a failed blob write as `alreadyStored`; Procomún
`relPath` derivation on a percent-encoded id segment).

This ADR records the decision for the **remaining** low-severity findings: they
are accepted as known issues (deferred or won't-fix) rather than blocking the
rollout, each with an explicit rationale and a revisit trigger. Recording them
prevents re-litigation and gives a later maintainer the context to reopen any of
them deliberately.

## Problem

Which low-severity review findings do we accept for now, on what rationale, and
under what condition should each be revisited?

## Decision drivers

- Prioritize correctness, security and simplicity (SDD-0003); do not add
  machinery for failure modes that are dominated by a broader operational
  failure (e.g. disk exhaustion) or that only manifest after host-editor wiring
  that does not exist yet.
- Keep the accepted set small, explicit and individually revisitable.
- Do not silently drop a finding: every one below is either scheduled or has a
  stated won't-fix rationale and a trigger to reopen.

## Decision

Accept the following low-severity findings as known issues for the v2 rollout.
Severity/confidence are from the review. "Deferred" = fix later, tracked here;
"Won't-fix (conditional)" = no action unless the trigger fires.

### Core client

1. **409 recovery sends `deletes: []`** — `HttpPreviewProvider.js` (PLAUSIBLE).
   After a lost `200` on a revision, a subsequently deleted document is not
   re-listed in the conflict-recovery snapshot, so it keeps being served for the
   session lifetime.
   - Decision: **Deferred.** Requires a network response to be lost *and* a
     deletion to follow before the next successful sync — rare, session-scoped,
     self-heals on session recreation, and never serves *wrong* content (only a
     stale extra page). Fix by carrying the computed deletes (paths in
     `_ackDocuments` but absent from the new document set) into the recovery
     POST.
   - Revisit if: users report stale/ghost pages after flaky-network edits.

2. **Asset `add` narrows scope to the asset layer** —
   `previewInvalidation.js:259` (PLAUSIBLE). A page rendered while a referenced
   asset was still absent embeds the fallback URL and is not re-rendered when the
   asset later arrives.
   - Decision: **Deferred.** The window (page generated between asset reference
     and asset materialization) is narrow; a subsequent edit to that page, or a
     `forceRefresh`, corrects it. Fix by treating `add` like `delete` (mark the
     referencing pages, or `all`) — cheap, since adds are rare relative to edits.
   - Revisit if: authors report a newly added image not appearing until an
     unrelated edit.

### Moodle

3. **Unchecked asset write failure still records the key in `index.json`** —
   `session_store.php:368` (PLAUSIBLE). A failed `file_put_contents` for asset
   bytes is ignored; the key is indexed and reported `stored`, so a later
   revision referencing it passes validation but the asset is unservable.
   - Decision: **Won't-fix (conditional).** Only reachable under disk
     exhaustion / an unwritable tempdir — an operational failure under which the
     preview degrades regardless. Same class as the Nextcloud write-failure
     finding, which *is* being fixed because it additionally wedges the
     contract's recovery loop; the Moodle path does not (a fresh key is minted on
     the next asset change).
   - Revisit if: the store gains a non-disk-full path to a failed write, or if we
     standardize write-failure→`rejected` reporting across all hosts.

### Omeka

4. **Global-budget check re-scans the whole session tree once per asset** —
   `PreviewSessionStore.php:192` (CONFIRMED, performance). `evictOthersForGlobal()`
   runs `allSessions()` inside the per-entry upload loop, even when the global
   budget is not threatened.
   - Decision: **Deferred (perf).** Bounded by the small per-session caps and by
     the number of assets in one batch; not a correctness issue. Fix by
     short-circuiting when `globalBytes + incoming <= budget`, and/or scanning
     once per request instead of per asset.
   - Revisit if: large-asset batches show measurable upload latency, or the
     global cap is raised.

### Nextcloud

5. **Malformed / multi-range `Range` yields 416 instead of being ignored** —
   `PreviewServer.php:152` (CONFIRMED). A valid multi-range request
   (`bytes=0-99,200-299`) or a syntactically odd value returns 416 rather than
   the full body. RFC 9110 §14 says an unsatisfiable *single* range is 416 but an
   unrecognized `Range` unit / multi-range SHOULD be ignored (serve 200).
   - Decision: **Deferred.** Browsers issue single open/suffix ranges for media
     seeking (the case that matters), which work; multi-range is rare and a 416
     is a graceful (if non-ideal) failure. Fix by treating an unparseable/
     multi-range header as "no range" (serve 200 full body).
   - Revisit if: a real client (some PDF viewers) breaks on the 416.

6. **`serveRoot()` serves `index.html` at the bare `/preview/{id}` URL** —
   `PreviewController.php:66` (CONFIRMED). Relative subresource refs then resolve
   against `/preview/` and 404.
   - Decision: **Deferred.** The client always navigates to
     `/preview/{id}/index.html` (trailing path), so the bare URL is only hit by a
     manual visit. Fix by redirecting the bare capability URL to
     `…/{id}/index.html` (or emitting a `<base>` — but a redirect is simpler and
     keeps relative refs intact).
   - Revisit if: the bare URL is ever linked/opened directly in a supported flow.

7. **Sessions with a missing `.accessed` marker are immortal; ghost dirs inflate
   `globalBytes`** — `PreviewSessionStore.php:145` (PLAUSIBLE). A crash between
   `mkdir` and `touch`, or a partial `removeTree`, leaves a directory that
   `isExpired()` never reaps and whose bytes keep counting.
   - Decision: **Won't-fix (conditional).** Requires a crash/partial-failure at a
     specific instant; the idle-TTL sweep and the per-user cap bound normal
     operation. A robust fix (treat a missing `.accessed` as "created now" or as
     immediately-expired, and reconcile `globalBytes` from disk on sweep) is
     worth doing only if operators observe leaked sessions.
   - Revisit if: monitoring shows preview storage not returning to baseline.

8. **Management API keeps CSRF on, but the reused core client sends no
   `requesttoken`** — `PreviewSessionController.php:37` (PLAUSIBLE). The endpoints
   are unreachable from the editor until token-injecting glue exists.
   - Decision: **Deferred to the host-activation step (already out of scope
     here).** This diff ships only the server side; no host wires
     `previewTransport: 'http'` yet. When Nextcloud activates the HTTP transport,
     the embedding glue must inject the NC `requesttoken` on management requests
     (the serving route stays authless). Recorded so the CSRF-on decision is not
     later "fixed" by wrongly switching the management route to `NoCSRFRequired`.
   - Revisit when: the Nextcloud editor is pointed at the v2 endpoints.

## Consequences

### Positive

- The v2 rollout is not blocked on issues that are edge-case, operational, or
  gated on not-yet-existing host wiring.
- Each accepted item has a rationale and a concrete revisit trigger, so reopening
  is a deliberate, low-friction decision.

### Negative

- Eight known low-severity behaviors ship. Each is bounded above (edge-case
  network timing, disk exhaustion, manual URL entry, rare Range shapes, or a
  deferred host-wiring step) and none serves wrong content to a normal preview
  flow.

### Neutral

- The four low-severity items being fixed pre-merge (Moodle `NO_DEBUG_DISPLAY` +
  traversal parity, Nextcloud write-failure reporting, Procomún `relPath`) are
  tracked with their own commits, not here.

## Risks

- A deferred item is forgotten. Mitigation: this ADR is the single registry; the
  revisit triggers are explicit and testable.
- The two write-failure findings (Moodle #3 accepted, Nextcloud fixed) are the
  same class handled differently. Mitigation: if we later standardize
  write-failure→`rejected` across hosts, item #3 folds into that and this ADR is
  updated.

## Validation

No code change is mandated by this ADR. The fixed critical/high/medium findings
and the four fixed low findings carry their own tests; this document only records
the accept/defer decision for the remaining eight.

## Follow-up work

- Optional: standardize write-failure → `rejected` reporting across all PHP host
  stores (folds in Moodle #3).
- Revisit each deferred item on its stated trigger.

## References

- ADR-0013 (preview v2 decision); SDD-0003 (design); PR #1968.
- Adversarial code review of the v2 branches (2026-07-11).
