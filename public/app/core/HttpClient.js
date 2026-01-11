/**
 * HttpClient - HTTP abstraction for server communication.
 * Used by server adapters to make API calls.
 */
import { NetworkError, AuthError } from './errors.js';

export class HttpClient {
    /**
     * @param {string} baseUrl - Base URL for all requests
     */
    constructor(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    }

    /**
     * Make a GET request.
     * @param {string} path - API path
     * @param {Object} [options] - Fetch options
     * @returns {Promise<any>}
     */
    async get(path, options = {}) {
        return this._request('GET', path, null, options);
    }

    /**
     * Make a POST request.
     * @param {string} path - API path
     * @param {Object|FormData} data - Request body
     * @param {Object} [options] - Fetch options
     * @returns {Promise<any>}
     */
    async post(path, data, options = {}) {
        return this._request('POST', path, data, options);
    }

    /**
     * Make a PUT request.
     * @param {string} path - API path
     * @param {Object} data - Request body
     * @param {Object} [options] - Fetch options
     * @returns {Promise<any>}
     */
    async put(path, data, options = {}) {
        return this._request('PUT', path, data, options);
    }

    /**
     * Make a PATCH request.
     * @param {string} path - API path
     * @param {Object} data - Request body
     * @param {Object} [options] - Fetch options
     * @returns {Promise<any>}
     */
    async patch(path, data, options = {}) {
        return this._request('PATCH', path, data, options);
    }

    /**
     * Make a DELETE request.
     * @param {string} path - API path
     * @param {Object} [options] - Fetch options
     * @returns {Promise<any>}
     */
    async delete(path, options = {}) {
        return this._request('DELETE', path, null, options);
    }

    /**
     * Upload a file.
     * @param {string} path - API path
     * @param {FormData} formData - Form data with file
     * @param {Function} [onProgress] - Progress callback
     * @returns {Promise<any>}
     */
    async upload(path, formData, onProgress = null) {
        const url = this._buildUrl(path);

        // Use XMLHttpRequest for progress support
        if (onProgress) {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', url);
                xhr.withCredentials = true;

                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        onProgress(e.loaded / e.total);
                    }
                });

                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            resolve(JSON.parse(xhr.responseText));
                        } catch {
                            resolve(xhr.responseText);
                        }
                    } else {
                        reject(
                            new NetworkError(
                                `Upload failed: ${xhr.statusText}`,
                                xhr.status
                            )
                        );
                    }
                });

                xhr.addEventListener('error', () => {
                    reject(new NetworkError('Upload failed: Network error'));
                });

                xhr.send(formData);
            });
        }

        // Use fetch for simple uploads
        return this._request('POST', path, formData, { isFormData: true });
    }

    /**
     * Download a file as Blob.
     * @param {string} path - API path
     * @returns {Promise<Blob>}
     */
    async downloadBlob(path) {
        const url = this._buildUrl(path);
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
        });

        if (!response.ok) {
            throw new NetworkError(
                `Download failed: ${response.statusText}`,
                response.status
            );
        }

        return response.blob();
    }

    /**
     * Internal request method.
     * @private
     */
    async _request(method, path, data, options = {}) {
        const url = this._buildUrl(path);
        const headers = {};

        let body = null;
        if (data) {
            if (options.isFormData || data instanceof FormData) {
                body = data;
                // Don't set Content-Type for FormData (browser sets it with boundary)
            } else {
                headers['Content-Type'] = 'application/json';
                body = JSON.stringify(data);
            }
        }

        const fetchOptions = {
            method,
            headers,
            credentials: 'include', // Include cookies for session
            body,
            ...options,
        };

        // Remove our custom options from fetch
        delete fetchOptions.isFormData;

        try {
            const response = await fetch(url, fetchOptions);

            // Handle authentication errors
            if (response.status === 401) {
                throw new AuthError('Session expired', true);
            }

            if (response.status === 403) {
                throw new AuthError('Access denied');
            }

            if (!response.ok) {
                let errorData = null;
                try {
                    errorData = await response.json();
                } catch {
                    // Ignore JSON parse errors
                }
                throw new NetworkError(
                    errorData?.message ||
                        `Request failed: ${response.statusText}`,
                    response.status,
                    errorData
                );
            }

            // Return empty for 204 No Content
            if (response.status === 204) {
                return null;
            }

            // Try to parse JSON, fall back to text
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                return response.json();
            }

            return response.text();
        } catch (error) {
            if (error instanceof NetworkError || error instanceof AuthError) {
                throw error;
            }
            // Network failure (no response)
            throw new NetworkError(`Network error: ${error.message}`);
        }
    }

    /**
     * Build full URL from path.
     * @private
     */
    _buildUrl(path) {
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path;
        }
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        return `${this.baseUrl}${cleanPath}`;
    }
}

export default HttpClient;
