import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * UserPreferences entity
 * Stores user preferences as key-value pairs
 *
 * Note: userId is stored as a string (not a foreign key) for flexibility
 * This matches the Symfony implementation
 */
@Entity('users_preferences')
@Index('fk_users_preferences_1_idx', ['userId'])
export class UserPreferences extends BaseEntity {
    @Column({ name: 'user_id', type: 'varchar', length: 255 })
    userId: string;

    @Column({ name: 'preference_key', type: 'varchar', length: 255 })
    preferenceKey: string;

    @Column({ name: 'value', type: 'text' })
    value: string;

    @Column({ name: 'description', type: 'text', nullable: true })
    description: string | null;
}
