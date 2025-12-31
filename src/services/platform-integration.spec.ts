import { buildSetOdeUrl, buildGetOdeUrl } from './platform-integration';

describe('Platform Integration Service', () => {
    describe('buildSetOdeUrl', () => {
        it('should build set_ode.php URL for SCORM module', () => {
            const returnUrl = 'https://moodle.example.com/mod/exescorm/view.php?id=123';
            expect(buildSetOdeUrl(returnUrl)).toBe('https://moodle.example.com/mod/exescorm/set_ode.php');
        });

        it('should build set_ode.php URL for web module', () => {
            const returnUrl = 'https://moodle.example.com/mod/exeweb/view.php?id=456';
            expect(buildSetOdeUrl(returnUrl)).toBe('https://moodle.example.com/mod/exeweb/set_ode.php');
        });

        it('should build set_ode.php URL for course/section pattern', () => {
            const returnUrl = 'https://moodle.example.com/course/section.php?id=789';
            expect(buildSetOdeUrl(returnUrl)).toBe('https://moodle.example.com/mod/exescorm/set_ode.php');
        });

        it('should return null for unknown URL pattern', () => {
            const returnUrl = 'https://moodle.example.com/some/other/path';
            expect(buildSetOdeUrl(returnUrl)).toBeNull();
        });

        it('should handle URLs with ports', () => {
            const returnUrl = 'https://moodle.example.com:8080/mod/exescorm/view.php?id=123';
            expect(buildSetOdeUrl(returnUrl)).toBe('https://moodle.example.com:8080/mod/exescorm/set_ode.php');
        });

        it('should handle URLs with subpaths', () => {
            const returnUrl = 'https://example.com/moodle/mod/exescorm/view.php?id=123';
            expect(buildSetOdeUrl(returnUrl)).toBe('https://example.com/moodle/mod/exescorm/set_ode.php');
        });
    });

    describe('buildGetOdeUrl', () => {
        it('should build get_ode.php URL for SCORM module', () => {
            const returnUrl = 'https://moodle.example.com/mod/exescorm/view.php?id=123';
            expect(buildGetOdeUrl(returnUrl)).toBe('https://moodle.example.com/mod/exescorm/get_ode.php');
        });

        it('should build get_ode.php URL for web module', () => {
            const returnUrl = 'https://moodle.example.com/mod/exeweb/view.php?id=456';
            expect(buildGetOdeUrl(returnUrl)).toBe('https://moodle.example.com/mod/exeweb/get_ode.php');
        });

        it('should build get_ode.php URL for course/section pattern', () => {
            const returnUrl = 'https://moodle.example.com/course/section.php?id=789';
            expect(buildGetOdeUrl(returnUrl)).toBe('https://moodle.example.com/mod/exescorm/get_ode.php');
        });

        it('should return null for unknown URL pattern', () => {
            const returnUrl = 'https://moodle.example.com/some/other/path';
            expect(buildGetOdeUrl(returnUrl)).toBeNull();
        });
    });

    // Note: platformPetitionGet and platformPetitionSet tests would require
    // mocking fetch, the database, and the export system. These are better
    // suited for integration tests with a real or mocked server.
    //
    // The core logic is tested through:
    // 1. Unit tests for buildSetOdeUrl/buildGetOdeUrl (above)
    // 2. Unit tests for platform-jwt utilities
    // 3. Integration tests in test/integration/
});
