export default class ApiCallBaseFunctions {
    constructor() {
        this.bodyElement = document.querySelector('body');
        this.nCurretPetitions = 0;
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
            return {};
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
            return {};
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
            return {};
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
            return {};
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
            return {};
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
            return {};
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
        if (waiting) {
            this.addWaitingPetition();
        }

        try {
            return await $.ajax({
                url: url,
                method: method,
                data: data,
                timeout: eXeLearning.config.clientCallWaitingTime,
                dataType: 'json',
            });
        } catch (xhr) {
            const errorResponse =
                xhr && typeof xhr === 'object' && xhr.responseJSON
                    ? xhr.responseJSON
                    : null;

            return {
                __error: true,
                status: xhr && typeof xhr.status === 'number' ? xhr.status : 0,
                statusText:
                    xhr && typeof xhr.statusText === 'string'
                        ? xhr.statusText
                        : '',
                responseMessage:
                    errorResponse && errorResponse.responseMessage
                        ? errorResponse.responseMessage
                        : null,
                detail:
                    errorResponse && errorResponse.detail
                        ? errorResponse.detail
                        : null,
                payload: errorResponse,
            };
        } finally {
            if (waiting) {
                setTimeout(() => {
                    this.removeWaitingPetition();
                }, 100);
            }
        }
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
        let response = {};
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
