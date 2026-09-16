import { describe, expect, it, vi } from 'vitest';

// Separate test file: the switch is flipped once, at adapter load time, and the
// shared test utility `resetPipwerks()` silences tracing itself — so asserting
// this inside the main adapter suite would prove nothing. Each Vitest file has
// its own module registry, so here the vendored wrapper is loaded with its
// shipped defaults and only the runtime is allowed to change them.
//
// Upstream pipwerks ships `debug.isActive = true` and a `UTILS.trace()` that
// calls `window.console.log` unconditionally, so every data-model get and set
// is printed into the LMS player console — including cmi.core.student_name and
// the whole cmi.suspend_data. The legacy eXe fork neutered the trace body
// instead (it only logged under Firebug, i.e. never in a modern browser); the
// vendored file here must stay byte-identical because its provenance is pinned
// by checksum, so the runtime turns tracing off at its own bootstrap.
const pipwerks = require('./vendor/pipwerks/SCORM_API_wrapper.js');

describe('exe-scorm12 runtime: pipwerks debug tracing', () => {
    it('ships with upstream tracing ON before the runtime loads', () => {
        // Guards the premise: if upstream ever changes this default, the fix
        // below becomes a no-op and this test says so.
        expect(pipwerks.debug.isActive).toBe(true);
    });

    it('turns tracing off when the adapter boots', () => {
        window.pipwerks = pipwerks;
        require('./exe-scorm12-client.js');
        require('./exe-scorm12-activities.js');
        require('./exe-scorm12-policy.js');
        require('./exe-scorm12-lifecycle.js');
        require('./exe-scorm12-adapter.js');

        expect(window.scorm).toBeTruthy();
        expect(pipwerks.debug.isActive).toBe(false);
    });

    it('keeps learner data out of the console when the wrapper traces', () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        pipwerks.UTILS.trace("SCORM.data.get('cmi.core.student_name') value: Learner, Parity");

        expect(logSpy).not.toHaveBeenCalled();
        logSpy.mockRestore();
    });
});
