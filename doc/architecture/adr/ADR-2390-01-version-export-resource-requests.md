---
id: ADR-2390-01
title: "Version export resource requests"
status: Accepted
date: 2026-09-13
tracking_issue: 2390
deciders:
  - "@erseco"
related:
  adrs:
    - ADR-1910-01
ai_assistance:
  tool: Codex
  model: GPT-6
---

# ADR-2390-01: Version export resource requests

## Context and problem

[Issue #2390](https://github.com/exelearning/exelearning/issues/2390) identifies
an upgrade path where an old HTTP-cached library bundle is stored under a new
IndexedDB version, breaking preview and exported navigation when a new theme
requires helpers absent from the old runtime. At commit `37922ad85`,
`src/routes/resources.ts` serves base bundles with a year of immutable caching,
while `public/app/yjs/ResourceFetcher.js` requests unversioned URLs.

## Decision

Version application resource requests before reading their responses into the
resource cache. ZIP requests use the manifest bundle hash when available and
otherwise the application version. Site themes retain their `updatedAt` token.
Theme downloads use the same token sources. Revalidate the server manifest;
version the static manifest and loose application files with the build version.
Keep existing IndexedDB keys and HTTP caching, and retain versioned server file
paths in the individual-file fallback.

This extends the loose-file loading decision in
[ADR-1910-01](ADR-1910-01-assemble-static-resource-bundles-from-loose-files.md).

## Alternatives and consequences

Changing only server cache headers cannot invalidate already-fresh responses
in users' browsers. Disabling HTTP caching for every resource would avoid this
failure but discard reuse when IndexedDB is unavailable. Versioned URLs preserve
that reuse and require no server API change.

This prevents stale HTTP responses from crossing an application upgrade. It does
not make deployment atomic: a server changing files during an active export can
still serve different generations. Builds must change their version when loose
assets change. Entries already poisoned under the current IndexedDB key require
cache clearing or a subsequent application version; this change does not migrate
existing cache data or touch user themes.

## Validation

`ResourceFetcher.test.js` covers bundle hashes, version fallback, site theme
updates, static URLs and auxiliary runtime files. The Playwright spec
`resource-cache-upgrade.spec.ts` primes a real immutable HTTP cache, changes the
server release, and checks that both ZIP and loose-file loading persist the new
runtime in IndexedDB. Network interception is deliberately absent because
[Playwright routing disables HTTP caching](https://playwright.dev/docs/api/class-page#page-route).
