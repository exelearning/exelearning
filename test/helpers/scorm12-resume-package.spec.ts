import { afterEach, describe, expect, it, setSystemTime } from 'bun:test';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';

import { unzipSync } from '../../src/shared/export';
import { SCORM12_VENDOR_WRAPPER_PATH } from '../../src/shared/export/utils/Scorm12Runtime';
import { RESUME_RACE_ACTIVITY_ID, buildResumeRaceScorm12Package } from './scorm12-resume-package';
import { scanPackageForUnloadHandlers } from './unload-handler-scanner';

function sha256(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex');
}

/** Run `fn` with the process time zone switched to `tz`, restoring it afterwards. */
function withTimeZone<T>(tz: string, fn: () => T): T {
    const previous = process.env.TZ;
    process.env.TZ = tz;
    try {
        return fn();
    } finally {
        if (previous === undefined) {
            delete process.env.TZ;
        } else {
            process.env.TZ = previous;
        }
    }
}

describe('SCORM 1.2 resume-race package', () => {
    afterEach(() => {
        setSystemTime();
    });

    it('ships the current runtime, a SCO, and no unload handlers', () => {
        const zip = unzipSync(buildResumeRaceScorm12Package());
        const names = Object.keys(zip);

        expect(names).toContain('imsmanifest.xml');
        expect(names).toContain('index.html');
        expect(names).toContain('libs/SCORM_API_wrapper.js');
        expect(names).toContain('libs/SCOFunctions.js');

        const manifest = new TextDecoder().decode(zip['imsmanifest.xml']);
        expect(manifest).toContain('schemaversion>1.2');
        expect(manifest).toContain('adlcp:scormtype="sco"');

        const index = new TextDecoder().decode(zip['index.html']);
        expect(index).toContain('onload="loadPage();updateScoreDisplay()"');
        expect(index).toContain('DOMContentLoaded');
        expect(index).toContain(RESUME_RACE_ACTIVITY_ID);
        expect(index).not.toContain('onunload');
        expect(index).not.toContain('onbeforeunload');

        const wrapper = zip['libs/SCORM_API_wrapper.js'];
        const vendor = fs.readFileSync(`public/app/common/scorm/${SCORM12_VENDOR_WRAPPER_PATH}`);
        expect(Buffer.from(wrapper).equals(vendor)).toBe(true);

        expect(scanPackageForUnloadHandlers(zip)).toEqual([]);
    });

    it('builds byte-identical packages regardless of the wall clock', () => {
        // ZIP entries carry a DOS timestamp with 2-second resolution; two builds
        // far apart in time must still produce the same bytes.
        setSystemTime(new Date('2026-08-27T10:00:00Z'));
        const first = sha256(buildResumeRaceScorm12Package());
        setSystemTime(new Date('2026-08-30T22:13:37Z'));
        const second = sha256(buildResumeRaceScorm12Package());

        expect(second).toBe(first);
    });

    it('builds byte-identical packages regardless of the process time zone', () => {
        // The DOS timestamp is written in local time, so a fixture regenerated on
        // a developer machine must match the one regenerated in CI (UTC).
        const utc = withTimeZone('UTC', () => sha256(buildResumeRaceScorm12Package()));
        const east = withTimeZone('Pacific/Kiritimati', () => sha256(buildResumeRaceScorm12Package()));
        const west = withTimeZone('America/Los_Angeles', () => sha256(buildResumeRaceScorm12Package()));

        expect(east).toBe(utc);
        expect(west).toBe(utc);
    });
});
