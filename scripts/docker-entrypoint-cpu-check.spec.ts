/**
 * Guards the x86_64 CPU gate in `docker-entrypoint.sh`.
 *
 * The container image is built on `oven/bun:*-alpine`, which ships the
 * `bun-linux-x64-musl-baseline` binary. Its minimum x86_64 target is SSE4.2
 * (Intel Nehalem / AMD Bulldozer or newer); AVX and AVX2 are dispatched at
 * runtime and must never be treated as requirements, or the entrypoint rejects
 * hardware Bun runs on perfectly well (Sandy Bridge, Ivy Bridge).
 *
 * See doc/architecture/adr/ADR-2436-01-require-only-sse4_2-for-bun-x64.md.
 *
 * The tests run the real `check_bun_cpu_requirements` body extracted from the
 * shipped entrypoint, with only the `/proc/cpuinfo` path and `uname` redirected
 * so a CPU can be simulated.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const projectRoot = path.resolve(import.meta.dir, '..');
const entrypoint = fs.readFileSync(path.join(projectRoot, 'docker-entrypoint.sh'), 'utf8');

let tmpDir: string;

beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exe-cpu-check-'));
});

afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** The `check_bun_cpu_requirements` function body, verbatim from the entrypoint. */
function extractCpuCheck(): string {
    const match = entrypoint.match(/^check_bun_cpu_requirements\(\) \{$.*?^\}$/ms);
    if (!match) {
        throw new Error('check_bun_cpu_requirements() not found in docker-entrypoint.sh');
    }
    return match[0];
}

/**
 * Runs the extracted check against a simulated machine.
 *
 * @param arch what `uname -m` reports
 * @param cpuFlags the `flags:` line of /proc/cpuinfo, or null to simulate an unreadable file
 */
function runCheck(arch: string, cpuFlags: string | null): { status: number; stderr: string } {
    const id = Math.random().toString(36).slice(2);
    const cpuinfoPath = path.join(tmpDir, `cpuinfo-${id}`);
    if (cpuFlags !== null) {
        fs.writeFileSync(cpuinfoPath, `processor\t: 0\nvendor_id\t: GenuineIntel\nflags\t\t: ${cpuFlags}\n`);
    }

    const script = [
        'log()  { :; }',
        'warn() { echo "WARN: $1" >&2; }',
        'err()  { echo "ERR: $1" >&2; }',
        `uname() { echo "${arch}"; }`,
        extractCpuCheck().replaceAll('/proc/cpuinfo', cpuinfoPath),
        'check_bun_cpu_requirements',
        'echo STARTED',
    ].join('\n');

    const scriptPath = path.join(tmpDir, `check-${id}.sh`);
    fs.writeFileSync(scriptPath, script);

    const result = spawnSync('/bin/sh', [scriptPath], { encoding: 'utf8' });
    return { status: result.status ?? -1, stderr: result.stderr };
}

describe('docker-entrypoint.sh CPU gate', () => {
    // Nehalem/Westmere have no AVX at all; Sandy Bridge and Ivy Bridge have AVX
    // but no AVX2. All three were rejected by the previous sse4_2+avx+avx2 check.
    const supported: Array<[string, string]> = [
        ['Nehalem / Westmere (SSE4.2, no AVX)', 'fpu sse sse2 ssse3 sse4_1 sse4_2 popcnt'],
        ['Sandy Bridge / Ivy Bridge (AVX, no AVX2)', 'fpu sse sse2 ssse3 sse4_1 sse4_2 popcnt avx'],
        ['Haswell and newer (AVX2)', 'fpu sse sse2 ssse3 sse4_1 sse4_2 popcnt avx avx2'],
    ];

    for (const [label, flags] of supported) {
        it(`starts on x86_64 ${label}`, () => {
            const { status, stderr } = runCheck('x86_64', flags);
            expect(stderr).toBe('');
            expect(status).toBe(0);
        });
    }

    it('refuses to start on a Core 2 class CPU, which has no SSE4.2', () => {
        const { status, stderr } = runCheck('x86_64', 'fpu sse sse2 ssse3 sse4_1');
        expect(stderr).toContain('Missing CPU flags: sse4_2');
        expect(status).toBe(1);
    });

    it('accepts the amd64 spelling of the architecture', () => {
        expect(runCheck('amd64', 'sse4_2').status).toBe(0);
        expect(runCheck('amd64', 'fpu sse sse2').status).toBe(1);
    });

    it('skips the check on non-x86_64 architectures', () => {
        for (const arch of ['aarch64', 'arm64', 'unknown']) {
            const { status, stderr } = runCheck(arch, 'fpu sse sse2');
            expect(stderr).toBe('');
            expect(status).toBe(0);
        }
    });

    it('warns but continues when /proc/cpuinfo cannot be read', () => {
        const { status, stderr } = runCheck('x86_64', null);
        expect(stderr).toContain('WARN: Could not read');
        expect(status).toBe(0);
    });
});

describe('docker-entrypoint.sh required flag list', () => {
    it('requires sse4_2 and nothing else', () => {
        const list = extractCpuCheck().match(/for required_flag in ([^;]+); do/);
        expect(list?.[1].trim()).toBe('sse4_2');
    });
});
