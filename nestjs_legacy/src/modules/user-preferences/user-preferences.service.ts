import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreferences } from '../../entities/user-preferences.entity';

/**
 * UserPreferencesService
 * Service for managing user preferences (key-value store per user)
 */
@Injectable()
export class UserPreferencesService {
    constructor(
        @InjectRepository(UserPreferences)
        private readonly userPreferencesRepository: Repository<UserPreferences>,
    ) {}

    /**
     * Get all preferences for a user
     * @param userId User ID
     * @returns Array of user preferences
     */
    async findAllByUserId(userId: string): Promise<UserPreferences[]> {
        return this.userPreferencesRepository.find({
            where: { userId, isActive: true },
            order: { preferenceKey: 'ASC' },
        });
    }

    /**
     * Get a specific preference value for a user
     * @param userId User ID
     * @param key Preference key
     * @returns UserPreferences or null
     */
    async findByUserIdAndKey(userId: string, key: string): Promise<UserPreferences | null> {
        return this.userPreferencesRepository.findOne({
            where: { userId, preferenceKey: key, isActive: true },
        });
    }

    /**
     * Get preferences as a key-value object
     * @param userId User ID
     * @returns Object with preference keys and values
     */
    async getPreferencesObject(userId: string): Promise<Record<string, string>> {
        const preferences = await this.findAllByUserId(userId);

        return preferences.reduce(
            (acc, pref) => {
                acc[pref.preferenceKey] = pref.value;
                return acc;
            },
            {} as Record<string, string>,
        );
    }

    /**
     * Create or update a preference
     * @param userId User ID
     * @param key Preference key
     * @param value Preference value
     * @param description Optional description
     * @returns Created/updated preference
     */
    async upsertPreference(
        userId: string,
        key: string,
        value: string,
        description?: string,
    ): Promise<UserPreferences> {
        const existing = await this.userPreferencesRepository.findOne({
            where: { userId, preferenceKey: key },
        });

        if (existing) {
            existing.value = value;
            if (description !== undefined) {
                existing.description = description;
            }
            existing.isActive = true;
            return this.userPreferencesRepository.save(existing);
        } else {
            const newPreference = this.userPreferencesRepository.create({
                userId,
                preferenceKey: key,
                value,
                description: description || null,
            });
            return this.userPreferencesRepository.save(newPreference);
        }
    }

    /**
     * Update multiple preferences at once
     * @param userId User ID
     * @param preferences Object with key-value pairs
     * @returns Array of updated preferences
     */
    async upsertMultiplePreferences(
        userId: string,
        preferences: Record<string, string>,
    ): Promise<UserPreferences[]> {
        const results: UserPreferences[] = [];

        for (const [key, value] of Object.entries(preferences)) {
            const updated = await this.upsertPreference(userId, key, value);
            results.push(updated);
        }

        return results;
    }

    /**
     * Delete a preference (soft delete by setting isActive = false)
     * @param userId User ID
     * @param key Preference key
     * @returns True if deleted, false if not found
     */
    async deletePreference(userId: string, key: string): Promise<boolean> {
        const preference = await this.userPreferencesRepository.findOne({
            where: { userId, preferenceKey: key, isActive: true },
        });

        if (!preference) {
            return false;
        }

        preference.isActive = false;
        await this.userPreferencesRepository.save(preference);
        return true;
    }

    /**
     * Delete all preferences for a user (soft delete)
     * @param userId User ID
     * @returns Number of preferences deleted
     */
    async deleteAllByUserId(userId: string): Promise<number> {
        const preferences = await this.findAllByUserId(userId);

        for (const pref of preferences) {
            pref.isActive = false;
            await this.userPreferencesRepository.save(pref);
        }

        return preferences.length;
    }
}
