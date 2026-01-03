import { getInitials, isGuestAccount, generateGravatarUrl } from '../../../utils/avatarUtils.js';

// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

/**
 * ConcurrentUsers
 * Displays online users using Yjs Awareness protocol.
 * Shows avatars/initials in the header and allows viewing all users in a modal.
 */
export default class ConcurrentUsers {
    constructor(app) {
        this.maxUsersShow = 5;
        this.concurrentUsersElement = document.querySelector(
            '#exe-concurrent-users'
        );
        this.currentUsers = [];
        this.app = app;
        this.unsubscribe = null;
    }

    /**
     * Initialize the concurrent users display
     * Subscribes to Yjs Awareness changes
     */
    async init() {
        // Wait for Yjs to be ready
        if (!this.isYjsReady()) {
            Logger.log('[ConcurrentUsers] Yjs not ready, waiting...');
            // Retry after a short delay
            setTimeout(() => this.init(), 1000);
            return;
        }

        // Subscribe to user changes via Yjs Awareness
        this.subscribeToYjsAwareness();

        // Initial render
        this.updateUsersDisplay();

        Logger.log('[ConcurrentUsers] Initialized with Yjs Awareness');
    }

    /**
     * Check if Yjs is ready
     * @returns {boolean}
     */
    isYjsReady() {
        return !!(
            this.app.project?._yjsEnabled &&
            this.app.project?._yjsBridge?.getDocumentManager()
        );
    }

    /**
     * Get the Yjs Document Manager
     * @returns {YjsDocumentManager|null}
     */
    getDocumentManager() {
        return this.app.project?._yjsBridge?.getDocumentManager();
    }

    /**
     * Subscribe to Yjs Awareness user changes
     */
    subscribeToYjsAwareness() {
        const documentManager = this.getDocumentManager();
        if (!documentManager) {
            console.warn('[ConcurrentUsers] Document manager not available');
            return;
        }

        // Set user info in awareness from current session
        if (this.app.user) {
            documentManager.setUserInfo({
                id: this.app.user.id,
                name: this.app.user.name || this.app.user.username,
                email: this.app.user.email,
                gravatarUrl: this.app.user.gravatarUrl,
            });
        }

        // Subscribe to user presence changes
        this.unsubscribe = documentManager.onUsersChange(({ users }) => {
            this.currentUsers = users;
            this.updateUsersDisplay();
        });

        // Get initial users
        this.currentUsers = documentManager.getOnlineUsers();
    }

    /**
     * Update the concurrent users display
     */
    updateUsersDisplay() {
        if (!this.concurrentUsersElement) return;

        // Remove existing user elements (but keep the "more" button)
        const existingUsers = this.concurrentUsersElement.querySelectorAll(
            '.user-current-letter-icon:not(#button-more-exe-concurrent-users)'
        );
        existingUsers.forEach(el => el.remove());

        // Add user elements
        this.addConcurrentUsersToElement();
        this.updateMoreButton();
    }

    /**
     * Add concurrent users elements to container
     */
    addConcurrentUsersToElement() {
        const numUsers = this.currentUsers.length;
        const usersToShow = this.currentUsers.slice(0, this.maxUsersShow);

        usersToShow.forEach((user) => {
            const userElement = this.createUserElement(user);
            // Insert before the "more" button
            const moreButton = this.concurrentUsersElement.querySelector(
                '#button-more-exe-concurrent-users'
            );
            if (moreButton) {
                this.concurrentUsersElement.insertBefore(userElement, moreButton);
            } else {
                this.concurrentUsersElement.appendChild(userElement);
            }
        });

        this.concurrentUsersElement.setAttribute('num', numUsers);
        this.concurrentUsersElement.setAttribute(
            'show-more-button',
            numUsers > 1
        );
    }

    /**
     * Create a user element (avatar or initials)
     * @param {Object} user - User object from awareness
     * @returns {HTMLElement}
     */
    createUserElement(user) {
        const nodeConcurrentUser = document.createElement('div');
        nodeConcurrentUser.classList.add('user-current-letter-icon');
        nodeConcurrentUser.classList.add('exe-top-icons');
        nodeConcurrentUser.setAttribute('data-username', user.name || 'User');
        nodeConcurrentUser.setAttribute('data-client-id', user.clientId);

        // Tooltip with email
        if (user.email) {
            nodeConcurrentUser.title = user.email;
        }

        // Add color border to indicate user color
        if (user.color) {
            nodeConcurrentUser.style.borderColor = user.color;
            nodeConcurrentUser.style.borderWidth = '2px';
            nodeConcurrentUser.style.borderStyle = 'solid';
        }

        // Mark local user
        if (user.isLocal) {
            nodeConcurrentUser.classList.add('is-local-user');
        }

        const usernameElement = document.createElement('span');
        usernameElement.classList.add('username');
        usernameElement.innerHTML = user.name || 'User';

        // Check if guest user
        const isGuest = isGuestAccount(user.email);

        // Get or generate Gravatar URL
        const gravatarUrl = user.gravatarUrl || generateGravatarUrl(user.email, 50);

        if (gravatarUrl) {
            // Use gravatar image with fallback
            const img = document.createElement('img');
            img.className = 'exe-gravatar rounded-circle';
            img.src = gravatarUrl;
            img.alt = user.name || 'User';
            img.height = 50;
            img.width = 50;

            // Fallback to initials on error
            const fallbackInitials = user.initials || getInitials(user.name || user.email);
            img.onerror = function () {
                this.style.display = 'none';
                const initialsSpan = document.createElement('span');
                initialsSpan.className = 'avatar-initials';
                initialsSpan.textContent = fallbackInitials;
                nodeConcurrentUser.insertBefore(initialsSpan, usernameElement);
            };

            nodeConcurrentUser.appendChild(img);
            nodeConcurrentUser.appendChild(usernameElement);
        } else {
            // Use initials (only if no email)
            const initials = user.initials || getInitials(user.name || user.email);
            nodeConcurrentUser.innerText = initials;
            nodeConcurrentUser.appendChild(usernameElement);
        }

        // Add guest badge if guest user
        if (isGuest) {
            const guestBadge = document.createElement('span');
            guestBadge.classList.add('guest-badge');
            guestBadge.textContent = _('Guest');
            nodeConcurrentUser.appendChild(guestBadge);
        }

        return nodeConcurrentUser;
    }

    /**
     * Update the "more" button visibility and click handler
     */
    updateMoreButton() {
        const buttonMore = this.concurrentUsersElement.querySelector(
            '#button-more-exe-concurrent-users'
        );
        if (!buttonMore) return;

        const numUsers = this.currentUsers.length;

        if (numUsers > 1) {
            buttonMore.classList.add('d-flex');
            buttonMore.style.display = 'block';
        } else {
            buttonMore.classList.remove('d-flex');
            buttonMore.style.display = 'none';
        }

        buttonMore.title = `${_('Users online')} (${numUsers})`;
        buttonMore.setAttribute('title', `${_('Users online')} (${numUsers})`);

        // Remove old event listener and add new one
        const newButton = buttonMore.cloneNode(true);
        buttonMore.parentNode.replaceChild(newButton, buttonMore);

        newButton.addEventListener('click', () => {
            eXeLearning.app.modals.info.show({
                title: `${_('Users online')} (${numUsers})`,
                body: this.makeBodyHTMLConcurrentUsersModal(),
            });
        });
    }

    /**
     * Get list of concurrent users elements for modal
     * @returns {Array<HTMLElement>}
     */
    getConcurrentUsersElementsList() {
        return this.currentUsers.map(user => this.createUserElement(user));
    }

    /**
     * Make body of concurrent users modal
     * @returns {string} HTML string
     */
    makeBodyHTMLConcurrentUsersModal() {
        const bodyConcurrentUsers = document.createElement('div');
        bodyConcurrentUsers.classList.add('exe-concurrent-users');

        this.currentUsers.forEach((user) => {
            const userElement = this.createUserElement(user);

            // Add additional info for modal view
            const infoElement = document.createElement('div');
            infoElement.classList.add('user-info');

            if (user.selectedPageId) {
                const pageInfo = document.createElement('span');
                pageInfo.classList.add('user-page-info');
                pageInfo.textContent = `📄 Viewing page`;
                infoElement.appendChild(pageInfo);
            }

            if (user.isLocal) {
                const localBadge = document.createElement('span');
                localBadge.classList.add('badge', 'bg-primary', 'ms-2');
                localBadge.textContent = _('You');
                infoElement.appendChild(localBadge);
            }

            userElement.appendChild(infoElement);
            bodyConcurrentUsers.appendChild(userElement);
        });

        return bodyConcurrentUsers.outerHTML;
    }

    /**
     * Clean up subscriptions
     */
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        Logger.log('[ConcurrentUsers] Destroyed');
    }
}
