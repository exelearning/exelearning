/**
 * Avatar Utilities - Centralized functions for avatar generation
 *
 * Provides consistent avatar handling across the application:
 * - Registered users: Gravatar if exists, initials as fallback
 * - Guest users (@guest.local): Identicon from Gravatar
 * - Offline fallback: Always show initials
 * - Tooltip: Shows user email
 */

const GUEST_DOMAIN = '@guest.local';
const GRAVATAR_BASE_URL = 'https://www.gravatar.com/avatar/';

/**
 * Detect if email belongs to a guest account
 * @param {string} email
 * @returns {boolean}
 */
export function isGuestAccount(email) {
    return email && email.toLowerCase().endsWith(GUEST_DOMAIN);
}

/**
 * Simple hash function for Gravatar (fallback when MD5 not available)
 * @param {string} str
 * @returns {string}
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(32, '0');
}

/**
 * Generate Gravatar URL for an email
 * Uses 'identicon' for guests, 'initials' for regular users
 * @param {string} email
 * @param {number} size - Size in pixels (default 50)
 * @returns {string|null}
 */
export function generateGravatarUrl(email, size = 50) {
    if (!email) return null;
    const hash = simpleHash(email.trim().toLowerCase());
    const isGuest = isGuestAccount(email);
    const defaultType = isGuest ? 'identicon' : 'initials';

    let url = `${GRAVATAR_BASE_URL}${hash}?d=${defaultType}&s=${size}&r=g`;

    // Add initials parameter for non-guest users
    if (!isGuest) {
        const initials = getInitialsFromEmail(email);
        url += `&initials=${encodeURIComponent(initials)}`;
    }

    return url;
}

/**
 * Extract initials from a full name
 * "John Doe" → "JD", "Alice" → "AL"
 * @param {string} name
 * @returns {string} Initials (1-2 chars uppercase)
 */
export function getInitialsFromName(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Extract initials from an email address
 * "john.doe@mail.com" → "JD"
 * @param {string} email
 * @returns {string} Initials (1-2 chars uppercase)
 */
export function getInitialsFromEmail(email) {
    if (!email) return '?';
    const localPart = email.split('@')[0];
    const parts = localPart.split(/[._-]/).filter(Boolean);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return localPart.substring(0, 2).toUpperCase();
}

/**
 * Get initials from either name or email
 * Automatically detects the input type
 * @param {string} nameOrEmail
 * @returns {string} Initials (1-2 chars uppercase)
 */
export function getInitials(nameOrEmail) {
    if (!nameOrEmail) return '?';
    if (nameOrEmail.includes('@')) {
        return getInitialsFromEmail(nameOrEmail);
    }
    return getInitialsFromName(nameOrEmail);
}

/**
 * Create an avatar DOM element with Gravatar image and initials fallback
 *
 * @param {Object} options
 * @param {string} options.email - User email (used for tooltip)
 * @param {string} options.name - User display name
 * @param {string} options.gravatarUrl - Gravatar URL from backend
 * @param {string} options.initials - Pre-calculated initials (optional)
 * @param {number} options.size - Size in pixels (default 40)
 * @param {string[]} options.cssClasses - Additional CSS classes
 * @param {string} options.color - Border color (optional)
 * @returns {HTMLElement}
 */
export function createAvatarElement(options = {}) {
    const {
        email = '',
        name = '',
        gravatarUrl = '',
        initials = '',
        size = 40,
        cssClasses = [],
        color = ''
    } = options;

    const container = document.createElement('div');
    container.className = ['avatar-container', ...cssClasses].join(' ');

    // Tooltip with email
    if (email) {
        container.title = email;
    }

    // Border color
    if (color) {
        container.style.borderColor = color;
    }

    const fallbackInitials = initials || getInitials(name || email);

    if (gravatarUrl) {
        const img = document.createElement('img');
        img.className = 'exe-gravatar';
        img.src = gravatarUrl;
        img.alt = email || name || 'User';
        img.width = size;
        img.height = size;

        // Fallback: if image fails to load, show initials
        img.onerror = function () {
            this.style.display = 'none';
            const initialsSpan = document.createElement('span');
            initialsSpan.className = 'avatar-initials';
            initialsSpan.textContent = fallbackInitials;
            container.appendChild(initialsSpan);
        };

        container.appendChild(img);
    } else {
        // No URL, show initials directly
        const initialsSpan = document.createElement('span');
        initialsSpan.className = 'avatar-initials';
        initialsSpan.textContent = fallbackInitials;
        container.appendChild(initialsSpan);
    }

    return container;
}

/**
 * Generate avatar HTML string (for templates using innerHTML)
 *
 * @param {Object} options
 * @param {string} options.email - User email (used for tooltip)
 * @param {string} options.name - User display name
 * @param {string} options.gravatarUrl - Gravatar URL from backend
 * @param {string} options.initials - Pre-calculated initials (optional)
 * @param {number} options.size - Size in pixels (default 40)
 * @returns {string} HTML string
 */
export function createAvatarHTML(options = {}) {
    const {
        email = '',
        name = '',
        gravatarUrl = '',
        initials = '',
        size = 40
    } = options;

    const fallbackInitials = initials || getInitials(name || email);
    const tooltip = email ? `title="${escapeHtml(email)}"` : '';

    if (gravatarUrl) {
        const onerrorHandler = `this.style.display='none';this.parentElement.innerHTML+='<span class=\\'avatar-initials\\'>${fallbackInitials}</span>';`;
        return `<img class="exe-gravatar" src="${escapeHtml(gravatarUrl)}" alt="${escapeHtml(email || name)}" width="${size}" height="${size}" ${tooltip} onerror="${onerrorHandler}">`;
    }

    return `<span class="avatar-initials" ${tooltip}>${fallbackInitials}</span>`;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Also export globally for non-ES6 modules (like YjsDocumentManager)
if (typeof window !== 'undefined') {
    window.AvatarUtils = {
        isGuestAccount,
        generateGravatarUrl,
        getInitialsFromName,
        getInitialsFromEmail,
        getInitials,
        createAvatarElement,
        createAvatarHTML
    };
}
