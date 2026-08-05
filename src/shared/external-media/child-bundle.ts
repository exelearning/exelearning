/**
 * Bundle bootstrap for the CHILD half — the code that runs inside untrusted author
 * content, in the opaque-origin preview and inside exported packages.
 *
 * Deliberately thin, and deliberately not imported by anything else. Everything it does
 * is a module-level side effect on the real `window`, which is exactly what cannot be
 * unit-tested honestly; keeping it to four lines means there is nothing here that a test
 * would have wanted to reach. The behaviour lives in `child-entry.ts`, which is tested
 * in full.
 *
 * The child self-starts, unlike the host: nothing inside the content document is going
 * to call it. Starting is not the same as activating — `startChild` only announces
 * itself and waits, and a document whose host never answers stays exactly as authored
 * (ADR-2199-08).
 *
 * Copyright (C) 2026 eXeLearning Team
 *
 * Dual-licensed so this ONE file can ship inside eXeLearning (AGPL-3.0-or-later)
 * and inside the GPL-3.0-or-later host plugins (mod_exelearning) without either
 * project relicensing it. GPLv3 s13 and AGPLv3 s13 already permit COMBINING the
 * two, but combining never relicenses a file: only the copyright holder can offer
 * it under both, which is what this grant does. Keep this notice in every mirror.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later OR GPL-3.0-or-later
 */
import { bootWhenReady, publishChild, startChild } from './child-entry';

declare const window: Record<string, unknown> & { document: unknown };

if (typeof window !== 'undefined') {
    publishChild(window as never);
    bootWhenReady(window.document as never, () => startChild(window as never));
}
