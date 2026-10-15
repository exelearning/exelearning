/**
 * Bundle bootstrap for the HOST half — the code that runs on the trusted page, outside
 * the content frame.
 *
 * Deliberately thin, and deliberately not imported by anything else. The behaviour lives
 * in `host-entry.ts`, which is tested in full.
 *
 * The host does NOT self-start, unlike the child. It cannot: the policy it must apply —
 * open or strict, and with which allowlist — is the embedding page's decision, and the
 * page supplies it by calling `init()`. A host that started itself would have to guess.
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
import { publishHost } from './host-entry';

declare const window: Record<string, unknown>;

if (typeof window !== 'undefined') {
    publishHost(window as never);
}
