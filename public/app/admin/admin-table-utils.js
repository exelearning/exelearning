/**
 * Admin Table Utilities
 * Shared helper functions for admin panel operations
 */

/**
 * Escape HTML entities to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Show a notification toast
 * @param {string} message - Message to display
 * @param {'success'|'error'|'info'} type - Notification type
 */
export function showNotification(message, type = 'info') {
    // Use simple alert for now - can be replaced with a toast library
    const prefix = type === 'error' ? 'Error: ' : type === 'success' ? '' : 'Info: ';
    alert(prefix + message);
}

/**
 * Create a generic API caller with error handling
 * @param {string} basePath - Base API path
 * @returns {Object} API methods
 */
export function createApiClient(basePath) {
    const request = async (method, path, body = null) => {
        const options = {
            method,
            credentials: 'include',
        };

        if (body) {
            if (body instanceof FormData) {
                options.body = body;
            } else {
                options.headers = { 'Content-Type': 'application/json' };
                options.body = JSON.stringify(body);
            }
        }

        const response = await fetch(`${basePath}${path}`, options);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.message || `Request failed with status ${response.status}`);
        }

        return data;
    };

    return {
        get: (path = '') => request('GET', path),
        post: (path, body) => request('POST', path, body),
        patch: (path, body) => request('PATCH', path, body),
        delete: (path) => request('DELETE', path),
    };
}

/**
 * Create a toggle handler for enable/disable switches
 * @param {string} apiPath - API endpoint path
 * @param {Function} reloadFn - Function to reload the table
 * @returns {Function} Toggle handler
 */
export function createToggleHandler(apiPath, reloadFn) {
    return async function toggleEnabled(id, enabled) {
        try {
            const response = await fetch(`${apiPath}/${id}/enabled`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isEnabled: enabled }),
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Failed to update');
            }
            reloadFn();
        } catch (error) {
            showNotification(error.message, 'error');
            reloadFn(); // Reload to reset checkbox state
        }
    };
}

/**
 * Create a delete handler with confirmation
 * @param {string} apiPath - API endpoint path
 * @param {Function} reloadFn - Function to reload the table
 * @param {string} confirmMessage - Confirmation message template (use %s for item name)
 * @param {string} successMessage - Success notification message
 * @returns {Function} Delete handler
 */
export function createDeleteHandler(apiPath, reloadFn, confirmMessage, successMessage) {
    return async function deleteItem(id, name) {
        const message = confirmMessage.replace('%s', name);
        if (!confirm(message)) {
            return;
        }

        try {
            const response = await fetch(`${apiPath}/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Failed to delete');
            }

            showNotification(successMessage, 'success');
            reloadFn();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };
}

/**
 * Create an upload handler for file uploads
 * @param {string} uploadPath - Upload API endpoint
 * @param {Function} reloadFn - Function to reload the table
 * @param {string} successMessage - Success notification message
 * @param {Object} extraFields - Additional fields to append to FormData
 * @returns {Function} Upload handler
 */
export function createUploadHandler(uploadPath, reloadFn, successMessage, extraFields = {}) {
    return async function uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        for (const [key, value] of Object.entries(extraFields)) {
            if (typeof value === 'function') {
                formData.append(key, value());
            } else {
                formData.append(key, value);
            }
        }

        try {
            const response = await fetch(uploadPath, {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || 'Upload failed');
            }

            showNotification(successMessage, 'success');
            reloadFn();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };
}

/**
 * Render empty table state
 * @param {number} colspan - Number of columns
 * @param {string} message - Message to display
 * @returns {string} HTML string
 */
export function renderEmptyState(colspan, message) {
    return `<tr><td colspan="${colspan}" class="text-center">${escapeHtml(message)}</td></tr>`;
}

/**
 * Render error state
 * @param {number} colspan - Number of columns
 * @param {string} message - Error message
 * @returns {string} HTML string
 */
export function renderErrorState(colspan, message) {
    return `<tr><td colspan="${colspan}" class="text-center text-danger">${escapeHtml(message)}</td></tr>`;
}
