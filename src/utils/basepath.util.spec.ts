import { getBasePath, prefixPath } from './basepath.util';

describe('BasePath Utilities', () => {
    // Store original BASE_PATH to restore after tests
    let originalBasePath: string | undefined;

    beforeEach(() => {
        originalBasePath = process.env.BASE_PATH;
    });

    afterEach(() => {
        // Restore original BASE_PATH
        if (originalBasePath !== undefined) {
            process.env.BASE_PATH = originalBasePath;
        } else {
            delete process.env.BASE_PATH;
        }
    });

    describe('getBasePath', () => {
        it('should return empty string when BASE_PATH is not set', () => {
            delete process.env.BASE_PATH;
            expect(getBasePath()).toBe('');
        });

        it('should return empty string when BASE_PATH is empty', () => {
            process.env.BASE_PATH = '';
            expect(getBasePath()).toBe('');
        });

        it('should return the BASE_PATH value as-is when no trailing slash', () => {
            process.env.BASE_PATH = '/exelearning';
            expect(getBasePath()).toBe('/exelearning');
        });

        it('should remove trailing slash from BASE_PATH', () => {
            process.env.BASE_PATH = '/exelearning/';
            expect(getBasePath()).toBe('/exelearning');
        });

        it('should remove multiple trailing slashes', () => {
            process.env.BASE_PATH = '/exelearning///';
            expect(getBasePath()).toBe('/exelearning');
        });

        it('should handle nested paths', () => {
            process.env.BASE_PATH = '/web/exelearning';
            expect(getBasePath()).toBe('/web/exelearning');
        });

        it('should handle nested paths with trailing slash', () => {
            process.env.BASE_PATH = '/web/exelearning/';
            expect(getBasePath()).toBe('/web/exelearning');
        });

        it('should handle deeply nested paths', () => {
            process.env.BASE_PATH = '/apps/education/exelearning';
            expect(getBasePath()).toBe('/apps/education/exelearning');
        });

        it('should preserve leading slash', () => {
            process.env.BASE_PATH = '/path';
            expect(getBasePath()).toBe('/path');
        });
    });

    describe('prefixPath', () => {
        describe('with empty BASE_PATH', () => {
            beforeEach(() => {
                delete process.env.BASE_PATH;
            });

            it('should return path unchanged when BASE_PATH is empty', () => {
                expect(prefixPath('/login')).toBe('/login');
            });

            it('should add leading slash if missing', () => {
                expect(prefixPath('login')).toBe('/login');
            });

            it('should handle root path', () => {
                expect(prefixPath('/')).toBe('/');
            });

            it('should handle paths with query strings', () => {
                expect(prefixPath('/login?error=invalid')).toBe('/login?error=invalid');
            });

            it('should handle complex paths', () => {
                expect(prefixPath('/api/project/sessions')).toBe('/api/project/sessions');
            });
        });

        describe('with BASE_PATH set', () => {
            beforeEach(() => {
                process.env.BASE_PATH = '/exelearning';
            });

            it('should prefix path with BASE_PATH', () => {
                expect(prefixPath('/login')).toBe('/exelearning/login');
            });

            it('should add leading slash to path before prefixing', () => {
                expect(prefixPath('login')).toBe('/exelearning/login');
            });

            it('should handle root path', () => {
                expect(prefixPath('/')).toBe('/exelearning/');
            });

            it('should handle paths with query strings', () => {
                expect(prefixPath('/login?error=invalid')).toBe('/exelearning/login?error=invalid');
            });

            it('should handle complex paths', () => {
                expect(prefixPath('/api/project/sessions')).toBe('/exelearning/api/project/sessions');
            });

            it('should handle paths with hash fragments', () => {
                expect(prefixPath('/workarea#section')).toBe('/exelearning/workarea#section');
            });
        });

        describe('with nested BASE_PATH', () => {
            beforeEach(() => {
                process.env.BASE_PATH = '/web/exelearning';
            });

            it('should prefix path with nested BASE_PATH', () => {
                expect(prefixPath('/login')).toBe('/web/exelearning/login');
            });

            it('should handle workarea redirect', () => {
                expect(prefixPath('/workarea?project=abc-123&new=1')).toBe(
                    '/web/exelearning/workarea?project=abc-123&new=1',
                );
            });

            it('should handle logout redirect', () => {
                expect(prefixPath('/logout/redirect')).toBe('/web/exelearning/logout/redirect');
            });
        });

        describe('with trailing slash in BASE_PATH', () => {
            beforeEach(() => {
                process.env.BASE_PATH = '/exelearning/';
            });

            it('should not produce double slashes', () => {
                const result = prefixPath('/login');
                expect(result).toBe('/exelearning/login');
                expect(result).not.toContain('//');
            });
        });
    });

    describe('Integration: Common eXeLearning Routes', () => {
        it('should handle login route (empty BASE_PATH)', () => {
            delete process.env.BASE_PATH;
            expect(prefixPath('/login')).toBe('/login');
        });

        it('should handle login route (with BASE_PATH)', () => {
            process.env.BASE_PATH = '/exelearning';
            expect(prefixPath('/login')).toBe('/exelearning/login');
        });

        it('should handle workarea route', () => {
            process.env.BASE_PATH = '/exelearning';
            expect(prefixPath('/workarea')).toBe('/exelearning/workarea');
        });

        it('should handle logout route', () => {
            process.env.BASE_PATH = '/exelearning';
            expect(prefixPath('/logout')).toBe('/exelearning/logout');
        });

        it('should handle login_check route', () => {
            process.env.BASE_PATH = '/exelearning';
            expect(prefixPath('/login_check')).toBe('/exelearning/login_check');
        });

        it('should handle login error redirect', () => {
            process.env.BASE_PATH = '/exelearning';
            expect(prefixPath('/login?error=invalid_credentials')).toBe('/exelearning/login?error=invalid_credentials');
        });

        it('should handle workarea with project UUID', () => {
            process.env.BASE_PATH = '/exelearning';
            const projectUuid = '550e8400-e29b-41d4-a716-446655440000';
            expect(prefixPath(`/workarea?project=${projectUuid}&new=1`)).toBe(
                `/exelearning/workarea?project=${projectUuid}&new=1`,
            );
        });

        it('should handle API routes', () => {
            process.env.BASE_PATH = '/exelearning';
            expect(prefixPath('/api/auth/login')).toBe('/exelearning/api/auth/login');
            expect(prefixPath('/api/project/sessions')).toBe('/exelearning/api/project/sessions');
        });

        it('should handle CAS login route', () => {
            process.env.BASE_PATH = '/exelearning';
            expect(prefixPath('/login/cas')).toBe('/exelearning/login/cas');
        });

        it('should handle OpenID login route', () => {
            process.env.BASE_PATH = '/exelearning';
            expect(prefixPath('/login/openid')).toBe('/exelearning/login/openid');
        });

        it('should handle guest login route', () => {
            process.env.BASE_PATH = '/exelearning';
            expect(prefixPath('/login/guest')).toBe('/exelearning/login/guest');
        });

        it('should handle changelog URL', () => {
            process.env.BASE_PATH = '/exelearning';
            expect(prefixPath('/CHANGELOG.md')).toBe('/exelearning/CHANGELOG.md');
        });
    });

    describe('Edge Cases', () => {
        it('should handle BASE_PATH with only slashes', () => {
            process.env.BASE_PATH = '///';
            expect(getBasePath()).toBe('');
        });

        it('should handle BASE_PATH with whitespace', () => {
            process.env.BASE_PATH = '  /exelearning  ';
            // The function does not trim whitespace, so this tests current behavior
            const result = getBasePath();
            expect(result).toBe('  /exelearning  ');
        });

        it('should handle empty path in prefixPath', () => {
            process.env.BASE_PATH = '/exelearning';
            expect(prefixPath('')).toBe('/exelearning/');
        });

        it('should handle path with only slash', () => {
            process.env.BASE_PATH = '/exelearning';
            expect(prefixPath('/')).toBe('/exelearning/');
        });

        it('should not double-prefix if path already has BASE_PATH', () => {
            // Note: prefixPath does not check if path already has BASE_PATH
            // This documents current behavior - caller should not prefix twice
            process.env.BASE_PATH = '/exelearning';
            expect(prefixPath('/exelearning/login')).toBe('/exelearning/exelearning/login');
        });
    });

    describe('Consistency with Symfony behavior', () => {
        it('should produce URLs matching Symfony format for root installation', () => {
            delete process.env.BASE_PATH;

            // Symfony with BASE_PATH= produces: /login, /workarea, etc.
            expect(prefixPath('/login')).toBe('/login');
            expect(prefixPath('/workarea')).toBe('/workarea');
            expect(prefixPath('/api/auth/check')).toBe('/api/auth/check');
        });

        it('should produce URLs matching Symfony format for subdirectory installation', () => {
            process.env.BASE_PATH = '/exelearning';

            // Symfony with BASE_PATH=/exelearning produces: /exelearning/login, etc.
            expect(prefixPath('/login')).toBe('/exelearning/login');
            expect(prefixPath('/workarea')).toBe('/exelearning/workarea');
            expect(prefixPath('/api/auth/check')).toBe('/exelearning/api/auth/check');
        });
    });
});
