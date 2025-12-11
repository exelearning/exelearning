import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Get the appropriate datetime column type based on database driver
 */
function getDateTimeType(queryRunner: QueryRunner): string {
    const dbType = queryRunner.connection.options.type;
    switch (dbType) {
        case 'postgres':
        case 'mysql':
        case 'mariadb':
            return 'timestamp';
        case 'sqljs':
        case 'sqlite':
        case 'better-sqlite3':
        default:
            return 'datetime';
    }
}

/**
 * Migration: Create Users Schema
 * Creates the users and users_preferences tables.
 * Must run before CreateYjsSchema which references users.
 */
export class CreateUsersSchema1699000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const dateTimeType = getDateTimeType(queryRunner);

        // Create users table
        await queryRunner.createTable(
            new Table({
                name: 'users',
                columns: [
                    {
                        name: 'id',
                        type: 'integer',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'email',
                        type: 'varchar',
                        length: '180',
                        isUnique: true,
                        isNullable: false,
                    },
                    {
                        name: 'user_id',
                        type: 'varchar',
                        length: '40',
                        isNullable: false,
                    },
                    {
                        name: 'password',
                        type: 'varchar',
                        length: '255',
                        isNullable: false,
                    },
                    {
                        name: 'roles',
                        type: 'text',
                        isNullable: false,
                    },
                    {
                        name: 'is_lopd_accepted',
                        type: 'boolean',
                        default: false,
                    },
                    {
                        name: 'quota_mb',
                        type: 'integer',
                        isNullable: true,
                    },
                    {
                        name: 'external_identifier',
                        type: 'varchar',
                        length: '180',
                        isNullable: true,
                    },
                    {
                        name: 'api_token',
                        type: 'varchar',
                        length: '255',
                        isNullable: true,
                    },
                    {
                        name: 'is_active',
                        type: 'boolean',
                        default: true,
                    },
                    {
                        name: 'created_at',
                        type: dateTimeType,
                        isNullable: true,
                    },
                    {
                        name: 'updated_at',
                        type: dateTimeType,
                        isNullable: true,
                    },
                ],
            }),
            true,
        );

        // Create index on email for faster lookups
        await queryRunner.createIndex(
            'users',
            new TableIndex({
                name: 'IDX_users_email',
                columnNames: ['email'],
            }),
        );

        // Create users_preferences table
        await queryRunner.createTable(
            new Table({
                name: 'users_preferences',
                columns: [
                    {
                        name: 'id',
                        type: 'integer',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'user_id',
                        type: 'varchar',
                        length: '255',
                        isNullable: false,
                    },
                    {
                        name: 'preference_key',
                        type: 'varchar',
                        length: '255',
                        isNullable: false,
                    },
                    {
                        name: 'value',
                        type: 'text',
                        isNullable: false,
                    },
                    {
                        name: 'description',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'is_active',
                        type: 'boolean',
                        default: true,
                    },
                    {
                        name: 'created_at',
                        type: dateTimeType,
                        isNullable: true,
                    },
                    {
                        name: 'updated_at',
                        type: dateTimeType,
                        isNullable: true,
                    },
                ],
            }),
            true,
        );

        // Create index on user_id for faster lookups
        await queryRunner.createIndex(
            'users_preferences',
            new TableIndex({
                name: 'fk_users_preferences_1_idx',
                columnNames: ['user_id'],
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('users_preferences', true);
        await queryRunner.dropTable('users', true);
    }
}
