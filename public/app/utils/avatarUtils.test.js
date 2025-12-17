/**
 * Avatar Utilities Tests
 *
 * Unit tests for avatarUtils.js functions that handle avatar generation,
 * Gravatar URLs, and initials extraction.
 *
 * Run with: make test-frontend
 */

 

import {
  isGuestAccount,
  generateGravatarUrl,
  getInitialsFromName,
  getInitialsFromEmail,
  getInitials,
  createAvatarElement,
  createAvatarHTML,
} from './avatarUtils.js';

describe('avatarUtils', () => {
  describe('isGuestAccount', () => {
    it('returns true for guest domain emails', () => {
      expect(isGuestAccount('guest123@guest.local')).toBe(true);
      expect(isGuestAccount('anonymous@guest.local')).toBe(true);
      expect(isGuestAccount('user@guest.local')).toBe(true);
    });

    it('returns true regardless of case', () => {
      expect(isGuestAccount('user@GUEST.LOCAL')).toBe(true);
      expect(isGuestAccount('user@Guest.Local')).toBe(true);
      expect(isGuestAccount('USER@guest.LOCAL')).toBe(true);
    });

    it('returns false for regular emails', () => {
      expect(isGuestAccount('user@example.com')).toBe(false);
      expect(isGuestAccount('admin@exelearning.net')).toBe(false);
      expect(isGuestAccount('test@gmail.com')).toBe(false);
    });

    it('returns false for emails containing guest.local but not ending with it', () => {
      expect(isGuestAccount('guest.local@example.com')).toBe(false);
      expect(isGuestAccount('user@guest.local.com')).toBe(false);
    });

    it('returns falsy for empty or null values', () => {
      expect(isGuestAccount('')).toBeFalsy();
      expect(isGuestAccount(null)).toBeFalsy();
      expect(isGuestAccount(undefined)).toBeFalsy();
    });
  });

  describe('generateGravatarUrl', () => {
    it('generates URL with default size', () => {
      const url = generateGravatarUrl('user@example.com');
      expect(url).toContain('https://www.gravatar.com/avatar/');
      expect(url).toContain('s=50');
      expect(url).toContain('r=g');
    });

    it('generates URL with custom size', () => {
      const url = generateGravatarUrl('user@example.com', 100);
      expect(url).toContain('s=100');
    });

    it('uses identicon for guest accounts', () => {
      const url = generateGravatarUrl('guest@guest.local');
      expect(url).toContain('d=identicon');
      expect(url).not.toContain('initials=');
    });

    it('uses initials for regular accounts', () => {
      const url = generateGravatarUrl('john.doe@example.com');
      expect(url).toContain('d=initials');
      expect(url).toContain('initials=JD');
    });

    it('generates consistent hash for same email', () => {
      const url1 = generateGravatarUrl('user@example.com');
      const url2 = generateGravatarUrl('user@example.com');
      expect(url1).toBe(url2);
    });

    it('normalizes email to lowercase for consistent hashing', () => {
      const url1 = generateGravatarUrl('User@Example.COM');
      const url2 = generateGravatarUrl('user@example.com');
      expect(url1).toBe(url2);
    });

    it('trims whitespace from email for hash calculation', () => {
      const url1 = generateGravatarUrl('  user@example.com  ');
      const url2 = generateGravatarUrl('user@example.com');
      // Both URLs should have the same hash (avatar ID)
      const hash1 = url1.split('?')[0].split('/').pop();
      const hash2 = url2.split('?')[0].split('/').pop();
      expect(hash1).toBe(hash2);
    });

    it('returns null for empty or null email', () => {
      expect(generateGravatarUrl('')).toBe(null);
      expect(generateGravatarUrl(null)).toBe(null);
      expect(generateGravatarUrl(undefined)).toBe(null);
    });

    it('encodes initials for URL safety', () => {
      const url = generateGravatarUrl('user@example.com', 50);
      // Check that URL is properly formatted
      expect(url).toMatch(/^https:\/\/www\.gravatar\.com\/avatar\/[a-f0-9]+\?/);
    });
  });

  describe('getInitialsFromName', () => {
    it('extracts initials from two-word names', () => {
      expect(getInitialsFromName('John Doe')).toBe('JD');
      expect(getInitialsFromName('Alice Smith')).toBe('AS');
      expect(getInitialsFromName('María García')).toBe('MG');
    });

    it('extracts initials from multi-word names', () => {
      expect(getInitialsFromName('John Michael Doe')).toBe('JD');
      expect(getInitialsFromName('Ana María García López')).toBe('AL');
    });

    it('handles single-word names by taking first two chars', () => {
      expect(getInitialsFromName('Alice')).toBe('AL');
      expect(getInitialsFromName('Jo')).toBe('JO');
      expect(getInitialsFromName('A')).toBe('A');
    });

    it('returns uppercase initials', () => {
      expect(getInitialsFromName('john doe')).toBe('JD');
      expect(getInitialsFromName('alice')).toBe('AL');
    });

    it('handles extra whitespace', () => {
      expect(getInitialsFromName('  John   Doe  ')).toBe('JD');
      expect(getInitialsFromName('John\t\tDoe')).toBe('JD');
    });

    it('returns ? for empty or null values', () => {
      expect(getInitialsFromName('')).toBe('?');
      expect(getInitialsFromName(null)).toBe('?');
      expect(getInitialsFromName(undefined)).toBe('?');
    });
  });

  describe('getInitialsFromEmail', () => {
    it('extracts initials from emails with dots', () => {
      expect(getInitialsFromEmail('john.doe@example.com')).toBe('JD');
      expect(getInitialsFromEmail('alice.smith@gmail.com')).toBe('AS');
    });

    it('extracts initials from emails with underscores', () => {
      expect(getInitialsFromEmail('john_doe@example.com')).toBe('JD');
      expect(getInitialsFromEmail('alice_smith@gmail.com')).toBe('AS');
    });

    it('extracts initials from emails with hyphens', () => {
      expect(getInitialsFromEmail('john-doe@example.com')).toBe('JD');
      expect(getInitialsFromEmail('alice-smith@gmail.com')).toBe('AS');
    });

    it('handles mixed separators', () => {
      expect(getInitialsFromEmail('john.doe-smith@example.com')).toBe('JD');
      expect(getInitialsFromEmail('alice_marie.smith@example.com')).toBe('AM');
    });

    it('handles simple emails without separators', () => {
      expect(getInitialsFromEmail('johndoe@example.com')).toBe('JO');
      expect(getInitialsFromEmail('alice@gmail.com')).toBe('AL');
    });

    it('returns uppercase initials', () => {
      expect(getInitialsFromEmail('JOHN.DOE@example.com')).toBe('JD');
    });

    it('returns ? for empty or null values', () => {
      expect(getInitialsFromEmail('')).toBe('?');
      expect(getInitialsFromEmail(null)).toBe('?');
      expect(getInitialsFromEmail(undefined)).toBe('?');
    });
  });

  describe('getInitials', () => {
    it('detects email and uses getInitialsFromEmail', () => {
      expect(getInitials('john.doe@example.com')).toBe('JD');
      expect(getInitials('user@gmail.com')).toBe('US');
    });

    it('detects name and uses getInitialsFromName', () => {
      expect(getInitials('John Doe')).toBe('JD');
      expect(getInitials('Alice')).toBe('AL');
    });

    it('returns ? for empty or null values', () => {
      expect(getInitials('')).toBe('?');
      expect(getInitials(null)).toBe('?');
      expect(getInitials(undefined)).toBe('?');
    });

    it('handles edge cases correctly', () => {
      // String with @ is treated as email
      expect(getInitials('user@test')).toBe('US');
      // String without @ is treated as name
      expect(getInitials('admin')).toBe('AD');
    });
  });

  describe('createAvatarElement', () => {
    it('creates container with avatar-container class', () => {
      const element = createAvatarElement({ email: 'user@example.com' });
      expect(element.classList.contains('avatar-container')).toBe(true);
    });

    it('adds custom CSS classes', () => {
      const element = createAvatarElement({
        email: 'user@example.com',
        cssClasses: ['custom-class', 'another-class'],
      });
      expect(element.classList.contains('avatar-container')).toBe(true);
      expect(element.classList.contains('custom-class')).toBe(true);
      expect(element.classList.contains('another-class')).toBe(true);
    });

    it('sets title attribute with email for tooltip', () => {
      const element = createAvatarElement({ email: 'user@example.com' });
      expect(element.title).toBe('user@example.com');
    });

    it('does not set title if no email provided', () => {
      const element = createAvatarElement({ name: 'John Doe' });
      expect(element.title).toBe('');
    });

    it('sets border color when provided', () => {
      const element = createAvatarElement({
        email: 'user@example.com',
        color: '#ff0000',
      });
      expect(element.style.borderColor).toBe('#ff0000');
    });

    describe('with gravatarUrl', () => {
      it('creates img element with correct attributes', () => {
        const element = createAvatarElement({
          email: 'user@example.com',
          gravatarUrl: 'https://gravatar.com/avatar/test',
          size: 60,
        });
        const img = element.querySelector('img');
        expect(img).not.toBe(null);
        expect(img.src).toBe('https://gravatar.com/avatar/test');
        expect(img.classList.contains('exe-gravatar')).toBe(true);
        expect(img.width).toBe(60);
        expect(img.height).toBe(60);
      });

      it('sets alt attribute to email or name', () => {
        const element1 = createAvatarElement({
          email: 'user@example.com',
          gravatarUrl: 'https://gravatar.com/avatar/test',
        });
        expect(element1.querySelector('img').alt).toBe('user@example.com');

        const element2 = createAvatarElement({
          name: 'John Doe',
          gravatarUrl: 'https://gravatar.com/avatar/test',
        });
        expect(element2.querySelector('img').alt).toBe('John Doe');
      });

      it('has onerror handler that shows initials on image load failure', () => {
        const element = createAvatarElement({
          email: 'user@example.com',
          gravatarUrl: 'https://gravatar.com/avatar/test',
        });
        const img = element.querySelector('img');

        // Verify onerror is set
        expect(img.onerror).not.toBe(null);

        // Simulate image error
        img.onerror();

        // Check that img is hidden and initials span is added
        expect(img.style.display).toBe('none');
        const initialsSpan = element.querySelector('.avatar-initials');
        expect(initialsSpan).not.toBe(null);
        expect(initialsSpan.textContent).toBe('US');
      });
    });

    describe('without gravatarUrl', () => {
      it('creates initials span directly', () => {
        const element = createAvatarElement({
          email: 'john.doe@example.com',
        });
        const img = element.querySelector('img');
        const initialsSpan = element.querySelector('.avatar-initials');

        expect(img).toBe(null);
        expect(initialsSpan).not.toBe(null);
        expect(initialsSpan.textContent).toBe('JD');
      });

      it('uses provided initials over computed ones', () => {
        const element = createAvatarElement({
          email: 'john.doe@example.com',
          initials: 'XY',
        });
        const initialsSpan = element.querySelector('.avatar-initials');
        expect(initialsSpan.textContent).toBe('XY');
      });

      it('computes initials from name if no email', () => {
        const element = createAvatarElement({
          name: 'Alice Smith',
        });
        const initialsSpan = element.querySelector('.avatar-initials');
        expect(initialsSpan.textContent).toBe('AS');
      });

      it('shows ? when no email or name provided', () => {
        const element = createAvatarElement({});
        const initialsSpan = element.querySelector('.avatar-initials');
        expect(initialsSpan.textContent).toBe('?');
      });
    });

    it('uses default size of 40', () => {
      const element = createAvatarElement({
        email: 'user@example.com',
        gravatarUrl: 'https://gravatar.com/avatar/test',
      });
      const img = element.querySelector('img');
      expect(img.width).toBe(40);
      expect(img.height).toBe(40);
    });
  });

  describe('createAvatarHTML', () => {
    describe('with gravatarUrl', () => {
      it('creates img HTML with correct attributes', () => {
        const html = createAvatarHTML({
          email: 'user@example.com',
          gravatarUrl: 'https://gravatar.com/avatar/test',
          size: 50,
        });

        expect(html).toContain('<img');
        expect(html).toContain('class="exe-gravatar"');
        expect(html).toContain('src="https://gravatar.com/avatar/test"');
        expect(html).toContain('width="50"');
        expect(html).toContain('height="50"');
      });

      it('includes title attribute with email', () => {
        const html = createAvatarHTML({
          email: 'user@example.com',
          gravatarUrl: 'https://gravatar.com/avatar/test',
        });
        expect(html).toContain('title="user@example.com"');
      });

      it('includes onerror handler for fallback', () => {
        const html = createAvatarHTML({
          email: 'john.doe@example.com',
          gravatarUrl: 'https://gravatar.com/avatar/test',
        });
        expect(html).toContain('onerror=');
        expect(html).toContain('avatar-initials');
        expect(html).toContain('JD');
      });

      it('uses default size of 40', () => {
        const html = createAvatarHTML({
          email: 'user@example.com',
          gravatarUrl: 'https://gravatar.com/avatar/test',
        });
        expect(html).toContain('width="40"');
        expect(html).toContain('height="40"');
      });
    });

    describe('without gravatarUrl', () => {
      it('creates initials span HTML', () => {
        const html = createAvatarHTML({
          email: 'john.doe@example.com',
        });

        expect(html).toContain('<span');
        expect(html).toContain('class="avatar-initials"');
        expect(html).toContain('JD');
      });

      it('includes title attribute with email', () => {
        const html = createAvatarHTML({
          email: 'user@example.com',
        });
        expect(html).toContain('title="user@example.com"');
      });

      it('uses provided initials', () => {
        const html = createAvatarHTML({
          email: 'user@example.com',
          initials: 'XY',
        });
        expect(html).toContain('XY');
      });

      it('computes initials from name', () => {
        const html = createAvatarHTML({
          name: 'Alice Smith',
        });
        expect(html).toContain('AS');
      });
    });

    it('escapes HTML in email to prevent XSS', () => {
      const html = createAvatarHTML({
        email: '<script>alert("xss")</script>@example.com',
        gravatarUrl: 'https://gravatar.com/avatar/test',
      });

      // Should be escaped, not raw script tag
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('escapes HTML in gravatarUrl', () => {
      const html = createAvatarHTML({
        email: 'user@example.com',
        gravatarUrl: 'https://gravatar.com/avatar/test"><script>alert(1)</script>',
      });

      // Should be escaped
      expect(html).not.toContain('<script>');
    });
  });

  describe('window.AvatarUtils global export', () => {
    it('exports all functions to window.AvatarUtils', () => {
      expect(window.AvatarUtils).toBeDefined();
      expect(typeof window.AvatarUtils.isGuestAccount).toBe('function');
      expect(typeof window.AvatarUtils.generateGravatarUrl).toBe('function');
      expect(typeof window.AvatarUtils.getInitialsFromName).toBe('function');
      expect(typeof window.AvatarUtils.getInitialsFromEmail).toBe('function');
      expect(typeof window.AvatarUtils.getInitials).toBe('function');
      expect(typeof window.AvatarUtils.createAvatarElement).toBe('function');
      expect(typeof window.AvatarUtils.createAvatarHTML).toBe('function');
    });

    it('global functions work the same as imported ones', () => {
      expect(window.AvatarUtils.isGuestAccount('guest@guest.local')).toBe(true);
      expect(window.AvatarUtils.getInitials('John Doe')).toBe('JD');
    });
  });
});
