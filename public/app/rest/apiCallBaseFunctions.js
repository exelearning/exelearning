export default class ApiCallBaseFunctions {
    constructor() {
        this.bodyElement = document.querySelector('body');
        this.nCurretPetitions = 0;
        this._accessErrorHandled = false;
    }

    /**
     * Handle access denied errors (401/403)
     * Shows a toast notification and redirects appropriately
     * @param {number} status - HTTP status code
     * @param {string} responseText - Response body
     * @returns {boolean} - true if error was handled
     */
    handleAccessError(status, responseText) {
        // Prevent multiple redirects
        if (this._accessErrorHandled) return true;

        const basePath = window.eXeLearning?.config?.basePath || '';

        if (status === 401) {
            this._accessErrorHandled = true;
            // Session expired or not authenticated
            if (window.eXeLearning?.app?.toasts?.default) {
                window.eXeLearning.app.toasts.default.createToast({
                    icon: 'error',
                    title: window._ ? _('Session Expired') : 'Session Expired',
                    body: window._ ? _('Your session has expired. Please log in again.') : 'Your session has expired. Please log in again.',
                    error: true,
                    remove: 5000
                });
            }
            setTimeout(() => {
                window.location.href = basePath + '/login';
            }, 2000);
            return true;
        }

        if (status === 403) {
            this._accessErrorHandled = true;
            // Access denied - user no longer has permission
            if (window.eXeLearning?.app?.toasts?.default) {
                window.eXeLearning.app.toasts.default.createToast({
                    icon: 'error',
                    title: window._ ? _('Access Denied') : 'Access Denied',
                    body: window._ ? _('You no longer have access to this project.') : 'You no longer have access to this project.',
                    error: true,
                    remove: 5000
                });
            }
            setTimeout(() => {
                window.location.href = basePath + '/workarea';
            }, 2000);
            return true;
        }

        return false;
    }

    /**
     *
     * @param {String} url
     * @param {Object} data
     * @returns
     */
    async get(url, data, waiting = true) {
        try {
            return await this.doAjax(url, 'GET', data, waiting);
        } catch (err) {
            // Return error response body if available (for 4xx/5xx errors)
            if (err.responseJSON) {
                return err.responseJSON;
            }
            return { responseMessage: 'ERROR', error: err.statusText || 'Request failed' };
        }
    }

    /**
     *
     * @param {String} url
     * @param {Object} data
     * @returns
     */
    async post(url, data, waiting = true) {
        try {
            return await this.doAjax(url, 'POST', data, waiting);
        } catch (err) {
            // Return error response body if available (for 4xx/5xx errors)
            if (err.responseJSON) {
                return err.responseJSON;
            }
            return { responseMessage: 'ERROR', error: err.statusText || 'Request failed' };
        }
    }

    /**
     *
     * @param {String} url
     * @param {Object} data
     * @returns
     */
    async fileSendPost(url, data, waiting = true) {
        try {
            return await this.doFileSendAjax(url, 'POST', data, waiting);
        } catch (err) {
            // Return error response body if available (for 4xx/5xx errors)
            if (err.responseJSON) {
                return err.responseJSON;
            }
            return { responseMessage: 'ERROR', error: err.statusText || 'Request failed' };
        }
    }

    /**
     * POST request with JSON content type
     * Use this for endpoints that expect complex objects/arrays
     *
     * @param {String} url
     * @param {Object} data
     * @returns
     */
    async postJson(url, data, waiting = true) {
        try {
            return await this.doJsonAjax(url, 'POST', data, waiting);
        } catch (err) {
            // Return error response body if available (for 4xx/5xx errors)
            if (err.responseJSON) {
                return err.responseJSON;
            }
            return { responseMessage: 'ERROR', error: err.statusText || 'Request failed' };
        }
    }

    /**
     *
     * @param {String} url
     * @param {Object} data
     * @returns
     */
    async put(url, data, waiting = true) {
        try {
            return await this.doAjax(url, 'PUT', data, waiting);
        } catch (err) {
            // Return error response body if available (for 4xx/5xx errors)
            if (err.responseJSON) {
                return err.responseJSON;
            }
            return { responseMessage: 'ERROR', error: err.statusText || 'Request failed' };
        }
    }

    /**
     *
     * @param {String} url
     * @param {Object} data
     * @returns
     */
    async delete(url, data, waiting = true) {
        try {
            return await this.doAjax(url, 'DELETE', data, waiting);
        } catch (err) {
            // Return error response body if available (for 4xx/5xx errors)
            if (err.responseJSON) {
                return err.responseJSON;
            }
            return { responseMessage: 'ERROR', error: err.statusText || 'Request failed' };
        }
    }

    /**
     *
     * @param {String} method
     * @param {String} url
     * @param {Object} data
     * @returns
     */
    async do(method, url, data, waiting = true) {
        try {
            return await this.doAjax(url, method, data, waiting);
        } catch (err) {
            // Return error response body if available (for 4xx/5xx errors)
            if (err.responseJSON) {
                return err.responseJSON;
            }
            return { responseMessage: 'ERROR', error: err.statusText || 'Request failed' };
        }
    }

    /**
     *
     * @param {*} url
     * @param {*} type
     * @param {*} data
     * @returns
     */
    async doAjax(url, method, data, waiting = true) {
        if (waiting) this.addWaitingPetition();
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        let response = {};
        try {
            response = await $.ajax({
                url: url,
                method: method,
                data: data,
                timeout: eXeLearning.config.clientCallWaitingTime,
                dataType: 'json',
                success: function (response) {
                    return response;
                },
                error: function (xhr, textStatus, errorThrown) {
                    // Handle access errors (401/403)
                    self.handleAccessError(xhr.status, xhr.responseText);
                    return { error: errorThrown, status: xhr.status };
                },
            });
        } catch (err) {
            // jQuery throws on error, handle access errors here too
            if (err.status) {
                this.handleAccessError(err.status, err.responseText);
            }
            throw err;
        }
        setTimeout(() => {
            this.removeWaitingPetition();
        }, 100);
        return response;
    }

    /**
     * AJAX call with JSON content type
     * Properly serializes complex objects/arrays
     *
     * @param {*} url
     * @param {*} method
     * @param {*} data
     * @returns
     */
    async doJsonAjax(url, method, data, waiting = true) {
        if (waiting) this.addWaitingPetition();
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        let response = {};
        try {
            response = await $.ajax({
                url: url,
                method: method,
                data: JSON.stringify(data),
                timeout: eXeLearning.config.clientCallWaitingTime,
                contentType: 'application/json',
                dataType: 'json',
                success: function (response) {
                    return response;
                },
                error: function (xhr, textStatus, errorThrown) {
                    // Handle access errors (401/403)
                    self.handleAccessError(xhr.status, xhr.responseText);
                    return { error: errorThrown, status: xhr.status };
                },
            });
        } catch (err) {
            // jQuery throws on error, handle access errors here too
            if (err.status) {
                this.handleAccessError(err.status, err.responseText);
            }
            throw err;
        }
        setTimeout(() => {
            this.removeWaitingPetition();
        }, 100);
        return response;
    }

    /**
     *
     * @param {*} url
     * @param {*} type
     * @param {*} data
     * @returns
     */
    async doFileSendAjax(url, method, data, waiting = true) {
        if (waiting) this.addWaitingPetition();
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        let response = {};
        try {
            response = await $.ajax({
                url: url,
                method: method,
                data: data,
                timeout: eXeLearning.config.clientCallWaitingTime,
                cache: false,
                contentType: false,
                processData: false,
                type: 'POST',
                success: function (response) {
                    return response;
                },
                error: function (xhr, textStatus, errorThrown) {
                    // Handle access errors (401/403)
                    self.handleAccessError(xhr.status, xhr.responseText);
                    return { error: errorThrown, status: xhr.status };
                },
            });
        } catch (err) {
            // jQuery throws on error, handle access errors here too
            if (err.status) {
                this.handleAccessError(err.status, err.responseText);
            }
            throw err;
        }
        setTimeout(() => {
            this.removeWaitingPetition();
        }, 100);
        return response;
    }

    /**
     *
     * @param {*} url
     * @returns
     */
    async getText(url, waiting = true) {
        if (waiting) this.addWaitingPetition();
        let response = {};
        response = await $.ajax({
            url: url,
            dataType: 'text',
            mimeType: 'text/plain',
            async: false,
            success: (response) => {
                return response;
            },
            error: function (XMLHttpRequest, textStatus, errorThrown) {
                return { error: errorThrown };
            },
        });
        setTimeout(() => {
            this.removeWaitingPetition();
        }, 100);
        return response;
    }

    /**
     * Add class to body to indicate that a request is in progress
     *
     */
    addWaitingPetition() {
        this.nCurretPetitions++;
        document.querySelector('body').classList.add('ajax-petition-on');
    }

    /**
     * Remove class to body to indicate that a request is no longer in progress
     *
     */
    removeWaitingPetition() {
        this.nCurretPetitions--;
        if (this.nCurretPetitions <= 0) {
            document.querySelector('body').classList.remove('ajax-petition-on');
        }
    }
}
