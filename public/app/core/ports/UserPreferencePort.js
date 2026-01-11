/**
 * UserPreferencePort - Domain interface for user preference operations.
 * Implemented by ServerUserPreferenceAdapter and StaticUserPreferenceAdapter.
 */
export class UserPreferencePort {
    /**
     * Get user preferences.
     * @returns {Promise<{userPreferences: Object}>}
     */
    async getPreferences() {
        throw new Error('UserPreferencePort.getPreferences() not implemented');
    }

    /**
     * Save user preferences.
     * @param {Object} params - Preferences to save
     * @returns {Promise<{success: boolean}>}
     */
    async savePreferences(params) {
        throw new Error('UserPreferencePort.savePreferences() not implemented');
    }

    /**
     * Accept LOPD (data protection).
     * @returns {Promise<{success: boolean}>}
     */
    async acceptLopd() {
        throw new Error('UserPreferencePort.acceptLopd() not implemented');
    }

    /**
     * Check if LOPD has been accepted.
     * @returns {Promise<boolean>}
     */
    async isLopdAccepted() {
        throw new Error('UserPreferencePort.isLopdAccepted() not implemented');
    }

    /**
     * Get a specific preference value.
     * @param {string} key - Preference key
     * @param {*} defaultValue - Default value if not found
     * @returns {Promise<*>}
     */
    async getPreference(key, defaultValue = null) {
        throw new Error('UserPreferencePort.getPreference() not implemented');
    }

    /**
     * Set a specific preference value.
     * @param {string} key - Preference key
     * @param {*} value - Preference value
     * @returns {Promise<{success: boolean}>}
     */
    async setPreference(key, value) {
        throw new Error('UserPreferencePort.setPreference() not implemented');
    }
}

export default UserPreferencePort;
