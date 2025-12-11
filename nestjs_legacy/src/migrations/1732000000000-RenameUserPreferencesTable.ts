import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Rename user_preferences table to users_preferences
 *
 * This migration renames the table to maintain consistency with other table names
 * (users, projects, assets, etc.)
 */
export class RenameUserPreferencesTable1732000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if old table exists and rename it
        const oldTable = await queryRunner.getTable('user_preferences');
        if (oldTable) {
            await queryRunner.renameTable('user_preferences', 'users_preferences');
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Rename back to original name
        const newTable = await queryRunner.getTable('users_preferences');
        if (newTable) {
            await queryRunner.renameTable('users_preferences', 'user_preferences');
        }
    }
}
