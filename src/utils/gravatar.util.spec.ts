import { createGravatarUrl } from './gravatar.util';

describe('gravatar.util', () => {
    describe('createGravatarUrl', () => {
        describe('basic URL generation', () => {
            it('should generate a valid Gravatar URL for an email', () => {
                const url = createGravatarUrl('user@example.com');

                expect(url).toContain('gravatar.com');
                expect(url).toContain('?');
                expect(url).toMatch(/[a-f0-9]{32}/); // MD5 hash
            });

            it('should include default query parameters', () => {
                const url = createGravatarUrl('user@example.com');

                expect(url).toContain('s=96'); // default size
                expect(url).toContain('r=g'); // default rating
            });

            it('should generate MD5 hash from lowercase email', () => {
                const url1 = createGravatarUrl('USER@EXAMPLE.COM');
                const url2 = createGravatarUrl('user@example.com');

                // Both should produce the same hash
                const hash1 = url1.match(/\/([a-f0-9]{32})\?/)?.[1];
                const hash2 = url2.match(/\/([a-f0-9]{32})\?/)?.[1];

                expect(hash1).toBe(hash2);
            });
        });

        describe('null/undefined/empty identifier handling', () => {
            it('should handle null identifier', () => {
                const url = createGravatarUrl(null);

                expect(url).toContain('gravatar.com');
                expect(url).not.toMatch(/\/[a-f0-9]{32}\?/); // No hash in URL
            });

            it('should handle undefined identifier', () => {
                const url = createGravatarUrl(undefined);

                expect(url).toContain('gravatar.com');
            });

            it('should handle empty string identifier', () => {
                const url = createGravatarUrl('');

                expect(url).toContain('gravatar.com');
                expect(url).not.toMatch(/\/[a-f0-9]{32}\?/); // No hash
            });

            it('should handle whitespace-only identifier', () => {
                const url = createGravatarUrl('   ');

                expect(url).toContain('gravatar.com');
            });
        });

        describe('guest account handling', () => {
            it('should use identicon default for guest accounts', () => {
                const url = createGravatarUrl('guest1@guest.local');

                expect(url).toContain('d=identicon');
            });

            it('should detect guest account case-insensitively', () => {
                const url = createGravatarUrl('GUEST@GUEST.LOCAL');

                expect(url).toContain('d=identicon');
            });

            it('should use initials default for regular accounts', () => {
                const url = createGravatarUrl('user@example.com');

                expect(url).toContain('d=initials');
            });
        });

        describe('initials handling', () => {
            it('should include initials parameter for regular users', () => {
                const url = createGravatarUrl('john.doe@example.com');

                expect(url).toContain('initials=');
            });

            it('should use provided initials if given', () => {
                const url = createGravatarUrl('user@example.com', 'AB');

                expect(url).toContain('initials=AB');
            });

            it('should derive initials from displayName if provided', () => {
                const url = createGravatarUrl('user@example.com', null, 'John Doe');

                expect(url).toContain('initials=JD');
            });

            it('should derive initials from email local part', () => {
                const url = createGravatarUrl('john.doe@example.com');

                expect(url).toContain('initials=JD');
            });

            it('should handle single word display name', () => {
                const url = createGravatarUrl('user@example.com', null, 'John');

                expect(url).toContain('initials=J');
            });

            it('should not include initials for guest accounts', () => {
                const url = createGravatarUrl('guest@guest.local');

                expect(url).not.toContain('initials=');
            });

            it('should sanitize initials with special characters', () => {
                const url = createGravatarUrl('user@example.com', '!@#AB$%');

                expect(url).toContain('initials=AB');
            });

            it('should uppercase initials', () => {
                const url = createGravatarUrl('user@example.com', 'ab');

                expect(url).toContain('initials=AB');
            });

            it('should limit initials to 4 characters', () => {
                const url = createGravatarUrl('user@example.com', 'ABCDEFGH');

                expect(url).toContain('initials=ABCD');
            });
        });

        describe('email format variations', () => {
            it('should handle email with dots in local part', () => {
                const url = createGravatarUrl('first.middle.last@example.com');

                expect(url).toMatch(/[a-f0-9]{32}/);
                expect(url).toContain('initials=');
            });

            it('should handle email with underscores', () => {
                const url = createGravatarUrl('first_last@example.com');

                expect(url).toMatch(/[a-f0-9]{32}/);
            });

            it('should handle email with hyphens', () => {
                const url = createGravatarUrl('first-last@example.com');

                expect(url).toMatch(/[a-f0-9]{32}/);
            });

            it('should handle email with plus sign', () => {
                const url = createGravatarUrl('user+tag@example.com');

                expect(url).toMatch(/[a-f0-9]{32}/);
            });
        });

        describe('URL structure', () => {
            it('should have proper URL structure with hash', () => {
                const url = createGravatarUrl('test@test.com');
                const urlObj = new URL(url);

                expect(urlObj.protocol).toBe('https:');
                expect(urlObj.hostname).toContain('gravatar.com');
                expect(urlObj.pathname).toMatch(/\/[a-f0-9]{32}$/);
            });

            it('should have proper query string format', () => {
                const url = createGravatarUrl('test@test.com');
                const urlObj = new URL(url);

                expect(urlObj.searchParams.get('s')).toBe('96');
                expect(urlObj.searchParams.get('r')).toBe('g');
                expect(urlObj.searchParams.get('d')).toBeTruthy();
            });
        });

        describe('priority of initials sources', () => {
            it('should prefer explicit initials over displayName', () => {
                const url = createGravatarUrl('user@example.com', 'XY', 'John Doe');

                expect(url).toContain('initials=XY');
                expect(url).not.toContain('initials=JD');
            });

            it('should prefer displayName over email-derived initials', () => {
                const url = createGravatarUrl('alice.bob@example.com', null, 'Charlie Delta');

                expect(url).toContain('initials=CD');
                expect(url).not.toContain('initials=AB');
            });

            it('should fall back to email when no initials or displayName', () => {
                const url = createGravatarUrl('first.last@example.com', null, null);

                expect(url).toContain('initials=FL');
            });
        });

        describe('empty initials handling', () => {
            it('should handle initials with only special characters', () => {
                const url = createGravatarUrl('user@example.com', '!@#$%^');

                // Special chars are stripped, should fall back to email-derived
                expect(url).toContain('initials=U');
            });

            it('should handle all special chars in display name', () => {
                const url = createGravatarUrl('user@example.com', null, '!@#$%');

                // Should fall back to email-derived initials
                expect(url).toContain('initials=U');
            });

            it('should handle numbers in initials', () => {
                const url = createGravatarUrl('user@example.com', '123');

                expect(url).toContain('initials=123');
            });

            it('should handle mixed alphanumeric initials', () => {
                const url = createGravatarUrl('user@example.com', 'A1B2');

                expect(url).toContain('initials=A1B2');
            });
        });

        describe('identifier format variations', () => {
            it('should handle identifier without @ symbol', () => {
                const url = createGravatarUrl('justusername');

                expect(url).toMatch(/[a-f0-9]{32}/);
                expect(url).toContain('initials=J');
            });

            it('should handle identifier with multiple @ symbols', () => {
                const url = createGravatarUrl('user@domain@extra.com');

                expect(url).toMatch(/[a-f0-9]{32}/);
            });

            it('should handle empty identifier with display name', () => {
                const url = createGravatarUrl('', null, 'John Doe');

                expect(url).toContain('initials=JD');
                expect(url).not.toMatch(/\/[a-f0-9]{32}\?/); // No hash
            });

            it('should handle null identifier with initials', () => {
                const url = createGravatarUrl(null, 'AB');

                expect(url).toContain('initials=AB');
            });
        });

        describe('display name edge cases', () => {
            it('should handle very long display names', () => {
                const url = createGravatarUrl('user@example.com', null, 'First Second Third Fourth Fifth');

                // Should limit to first 4 words
                expect(url).toContain('initials=FSTF');
            });

            it('should handle display name with numbers', () => {
                const url = createGravatarUrl('user@example.com', null, 'User 123');

                expect(url).toContain('initials=U1');
            });

            it('should handle emoji in display name', () => {
                const url = createGravatarUrl('user@example.com', null, '🎉 Party Time');

                // Emoji should be handled - may or may not appear in initials
                expect(url).toContain('initials=');
            });
        });

        describe('edge cases', () => {
            it('should handle very long email addresses', () => {
                const longEmail = 'a'.repeat(100) + '@example.com';
                const url = createGravatarUrl(longEmail);

                expect(url).toMatch(/[a-f0-9]{32}/);
            });

            it('should handle unicode characters in display name', () => {
                const url = createGravatarUrl('user@example.com', null, 'José García');

                expect(url).toContain('initials=');
            });

            it('should handle empty display name', () => {
                const url = createGravatarUrl('john@example.com', null, '');

                expect(url).toContain('initials=J');
            });

            it('should handle whitespace-only display name', () => {
                const url = createGravatarUrl('john@example.com', null, '   ');

                expect(url).toContain('initials=J');
            });
        });
    });
});
