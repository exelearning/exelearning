import { isValidReturnUrl, getSafeRedirectUrl } from './redirect-validator.util';

describe('Redirect Validator Utilities', () => {
    let originalBasePath: string | undefined;

    beforeEach(() => {
        originalBasePath = process.env.BASE_PATH;
    });

    afterEach(() => {
        if (originalBasePath !== undefined) {
            process.env.BASE_PATH = originalBasePath;
        } else {
            delete process.env.BASE_PATH;
        }
    });

    describe('isValidReturnUrl', () => {
        it('should return false for null', () => {
            expect(isValidReturnUrl(null)).toBe(false);
        });

        it('should return false for undefined', () => {
            expect(isValidReturnUrl(undefined)).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(isValidReturnUrl('')).toBe(false);
        });

        it('should return false for non-string values', () => {
            expect(isValidReturnUrl(123 as any)).toBe(false);
            expect(isValidReturnUrl({} as any)).toBe(false);
        });

        it('should return true for valid relative paths', () => {
            expect(isValidReturnUrl('/workarea')).toBe(true);
            expect(isValidReturnUrl('/workarea?project=abc-123')).toBe(true);
            expect(isValidReturnUrl('/login')).toBe(true);
            expect(isValidReturnUrl('/api/sessions')).toBe(true);
        });

        it('should return false for paths not starting with /', () => {
            expect(isValidReturnUrl('workarea')).toBe(false);
            expect(isValidReturnUrl('http://evil.com')).toBe(false);
            expect(isValidReturnUrl('https://evil.com')).toBe(false);
        });

        it('should return false for protocol-relative URLs (open redirect prevention)', () => {
            expect(isValidReturnUrl('//evil.com')).toBe(false);
            expect(isValidReturnUrl('//evil.com/path')).toBe(false);
        });

        it('should return false for URLs with dangerous characters', () => {
            expect(isValidReturnUrl('/workarea\n')).toBe(false);
            expect(isValidReturnUrl('/workarea\r')).toBe(false);
            expect(isValidReturnUrl('/workarea\\')).toBe(false);
        });

        it('should return false for javascript: URLs', () => {
            expect(isValidReturnUrl('/path?redirect=javascript:alert(1)')).toBe(false);
            expect(isValidReturnUrl('/path?redirect=JAVASCRIPT:alert(1)')).toBe(false);
        });

        it('should return false for data: URLs', () => {
            expect(isValidReturnUrl('/path?data=data:text/html')).toBe(false);
            expect(isValidReturnUrl('/path?data=DATA:text/html')).toBe(false);
        });

        it('should handle paths with query strings and fragments', () => {
            expect(isValidReturnUrl('/workarea?project=uuid&new=1')).toBe(true);
            expect(isValidReturnUrl('/workarea#section')).toBe(true);
            expect(isValidReturnUrl('/workarea?project=uuid#section')).toBe(true);
        });
    });

    describe('getSafeRedirectUrl', () => {
        describe('without BASE_PATH', () => {
            beforeEach(() => {
                delete process.env.BASE_PATH;
            });

            it('should return valid returnUrl as-is', () => {
                expect(getSafeRedirectUrl('/workarea')).toBe('/workarea');
                expect(getSafeRedirectUrl('/workarea?project=abc')).toBe('/workarea?project=abc');
            });

            it('should return default path for invalid returnUrl', () => {
                expect(getSafeRedirectUrl(null)).toBe('/workarea');
                expect(getSafeRedirectUrl(undefined)).toBe('/workarea');
                expect(getSafeRedirectUrl('')).toBe('/workarea');
                expect(getSafeRedirectUrl('//evil.com')).toBe('/workarea');
            });

            it('should use custom default path when provided', () => {
                expect(getSafeRedirectUrl(null, '/login')).toBe('/login');
                expect(getSafeRedirectUrl(undefined, '/dashboard')).toBe('/dashboard');
            });
        });

        describe('with BASE_PATH', () => {
            beforeEach(() => {
                process.env.BASE_PATH = '/exelearning';
            });

            it('should prefix valid returnUrl with BASE_PATH', () => {
                expect(getSafeRedirectUrl('/workarea')).toBe('/exelearning/workarea');
                expect(getSafeRedirectUrl('/workarea?project=abc')).toBe('/exelearning/workarea?project=abc');
            });

            it('should not double-prefix if returnUrl already has BASE_PATH', () => {
                expect(getSafeRedirectUrl('/exelearning/workarea')).toBe('/exelearning/workarea');
                expect(getSafeRedirectUrl('/exelearning/workarea?project=abc')).toBe(
                    '/exelearning/workarea?project=abc',
                );
            });

            it('should return prefixed default path for invalid returnUrl', () => {
                expect(getSafeRedirectUrl(null)).toBe('/exelearning/workarea');
                expect(getSafeRedirectUrl(undefined)).toBe('/exelearning/workarea');
                expect(getSafeRedirectUrl('')).toBe('/exelearning/workarea');
            });

            it('should use custom default path with BASE_PATH prefix', () => {
                expect(getSafeRedirectUrl(null, '/login')).toBe('/exelearning/login');
            });
        });

        describe('with nested BASE_PATH', () => {
            beforeEach(() => {
                process.env.BASE_PATH = '/web/exelearning';
            });

            it('should prefix valid returnUrl with nested BASE_PATH', () => {
                expect(getSafeRedirectUrl('/workarea')).toBe('/web/exelearning/workarea');
                expect(getSafeRedirectUrl('/workarea?project=abc&new=1')).toBe(
                    '/web/exelearning/workarea?project=abc&new=1',
                );
            });

            it('should not double-prefix if returnUrl already has nested BASE_PATH', () => {
                expect(getSafeRedirectUrl('/web/exelearning/workarea')).toBe('/web/exelearning/workarea');
            });

            it('should return prefixed default for invalid returnUrl', () => {
                expect(getSafeRedirectUrl('//evil.com')).toBe('/web/exelearning/workarea');
            });
        });
    });

    describe('Integration: Login flow with returnUrl', () => {
        it('should handle typical login redirect flow (no BASE_PATH)', () => {
            delete process.env.BASE_PATH;

            // User tries to access /workarea?project=uuid
            const originalUrl = '/workarea?project=550e8400-e29b-41d4-a716-446655440000';

            // Validate it's safe
            expect(isValidReturnUrl(originalUrl)).toBe(true);

            // After login, redirect back
            const redirectUrl = getSafeRedirectUrl(originalUrl);
            expect(redirectUrl).toBe('/workarea?project=550e8400-e29b-41d4-a716-446655440000');
        });

        it('should handle typical login redirect flow (with BASE_PATH)', () => {
            process.env.BASE_PATH = '/exelearning';

            // User tries to access /workarea?project=uuid (canonical path, without BASE_PATH)
            const originalUrl = '/workarea?project=550e8400-e29b-41d4-a716-446655440000';

            // Validate it's safe
            expect(isValidReturnUrl(originalUrl)).toBe(true);

            // After login, redirect back (with BASE_PATH added)
            const redirectUrl = getSafeRedirectUrl(originalUrl);
            expect(redirectUrl).toBe('/exelearning/workarea?project=550e8400-e29b-41d4-a716-446655440000');
        });

        it('should handle SSO redirect flow with BASE_PATH', () => {
            process.env.BASE_PATH = '/exelearning';

            // User comes back from SSO with returnUrl cookie
            const returnUrl = '/workarea?project=abc-123&new=1';

            // Should redirect to correct prefixed URL
            const redirectUrl = getSafeRedirectUrl(returnUrl);
            expect(redirectUrl).toBe('/exelearning/workarea?project=abc-123&new=1');
        });

        it('should handle malicious returnUrl attempts', () => {
            process.env.BASE_PATH = '/exelearning';

            // Attacker tries open redirect
            expect(isValidReturnUrl('//evil.com/steal')).toBe(false);
            expect(getSafeRedirectUrl('//evil.com/steal')).toBe('/exelearning/workarea');

            // Attacker tries header injection
            expect(isValidReturnUrl('/workarea\r\nX-Injected: true')).toBe(false);
            expect(getSafeRedirectUrl('/workarea\r\nX-Injected: true')).toBe('/exelearning/workarea');

            // Attacker tries javascript injection
            expect(isValidReturnUrl('/workarea?x=javascript:alert(1)')).toBe(false);
            expect(getSafeRedirectUrl('/workarea?x=javascript:alert(1)')).toBe('/exelearning/workarea');
        });
    });
});
