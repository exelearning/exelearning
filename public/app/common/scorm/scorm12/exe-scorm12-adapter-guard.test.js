import { describe, expect, it, vi } from 'vitest';

// Separate test file: the adapter runs its layer guard at load time, so this
// file loads it WITHOUT the runtime layers or the pipwerks wrapper (each test
// file has its own module registry).
describe('exe-scorm12-adapter guard', () => {
    it('disables itself and reports when the runtime layers are missing', () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(window.exeScorm12).toBeUndefined();
        expect(window.pipwerks).toBeUndefined();
        require('./exe-scorm12-adapter.js');

        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('SCORM tracking is disabled'));
        expect(window.loadPage).toBeUndefined();
        expect(window.scorm).toBeUndefined();
        errorSpy.mockRestore();
    });
});
