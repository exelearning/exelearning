import { describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';

import { unzipSync } from '../../src/shared/export';
import { SCORM12_VENDOR_WRAPPER_PATH } from '../../src/shared/export/utils/Scorm12Runtime';
import {
    RESUME_RACE_ACTIVITY_ID,
    buildResumeRaceScorm12Package,
    writeResumeRaceScorm12Fixture,
} from './scorm12-resume-package';
import { scanPackageForUnloadHandlers } from './unload-handler-scanner';

describe('SCORM 1.2 resume-race package', () => {
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

    it('writes the fixture zip used by Moodle verification', () => {
        const written = writeResumeRaceScorm12Fixture();
        expect(fs.existsSync(written)).toBe(true);
        expect(fs.statSync(written).size).toBeGreaterThan(1000);
    });
});
