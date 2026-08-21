import { describe, expect, it } from 'vitest';

// Separate test file: the adapter runs its layer guard at load time, so this
// file loads it with every layer EXCEPT the activity registry (each test file
// has its own module registry).
//
// That subset is a real deployment, not a hypothetical one: the Moodle plugin
// injects the runtime into the HTML5 packages it serves and deliberately leaves
// the registry out, so those packages keep writing the legacy cmi.suspend_data
// line format that the plugin's own parsers understand. Requiring the registry
// in the guard disabled the whole runtime for that host.
const pipwerks = require('./vendor/pipwerks/SCORM_API_wrapper.js');
window.pipwerks = pipwerks;
require('./exe-scorm12-client.js');
require('./exe-scorm12-policy.js');
require('./exe-scorm12-lifecycle.js');
require('./exe-scorm12-adapter.js');

describe('exe-scorm12-adapter without the activity registry', () => {
    it('boots and installs the legacy globals', () => {
        expect(window.exeScorm12.activities).toBeUndefined();
        expect(typeof window.loadPage).toBe('function');
        expect(typeof window.unloadPage).toBe('function');
        expect(typeof window.setScore).toBe('function');
        expect(window.scorm).toBeTruthy();
    });

    it('exposes the policy methods the shared games layer calls', () => {
        // common.js gates on these before writing a score; a runtime that
        // published `policy` without them made showFinalScore throw.
        expect(typeof window.exeScorm12.policy.setScoreDetailed).toBe('function');
        expect(typeof window.exeScorm12.policy.recordActivityOutcome).toBe('function');
    });

    it('reports no registry, so the games layer keeps the legacy suspend_data writer', () => {
        // `getActivityRegistry()` in common.js resolves through this exact path.
        expect(window.exeScorm12.activities || null).toBeNull();
    });
});
