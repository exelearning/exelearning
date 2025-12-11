import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

/**
 * Get the appropriate binary column type based on database driver
 */
function getBinaryType(queryRunner: QueryRunner): string {
    const dbType = queryRunner.connection.options.type;
    switch (dbType) {
        case 'postgres':
            return 'bytea';
        case 'mysql':
        case 'mariadb':
            return 'longblob';
        case 'sqljs':
        case 'sqlite':
        case 'better-sqlite3':
        default:
            return 'blob';
    }
}

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
 * Migration: Create Yjs-based schema
 * Creates tables for the new Yjs-first architecture:
 * - projects: Project metadata and ownership
 * - yjs_documents: Yjs snapshot storage
 * - yjs_updates: Incremental update log
 * - assets: Project asset metadata
 * - project_collaborators: Many-to-many join table
 */
export class CreateYjsSchema1700000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const binaryType = getBinaryType(queryRunner);
        // Get the appropriate datetime type for this database
        const dateTimeType = getDateTimeType(queryRunner);

        // Create projects table
        await queryRunner.createTable(
            new Table({
                name: 'projects',
                columns: [
                    {
                        name: 'id',
                        type: 'integer',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'uuid',
                        type: 'varchar',
                        length: '36',
                        isUnique: true,
                        isNullable: false,
                    },
                    {
                        name: 'title',
                        type: 'varchar',
                        length: '255',
                        isNullable: false,
                    },
                    {
                        name: 'description',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'owner_id',
                        type: 'integer',
                        isNullable: false,
                    },
                    {
                        name: 'status',
                        type: 'varchar',
                        length: '50',
                        default: "'active'",
                    },
                    {
                        name: 'visibility',
                        type: 'varchar',
                        length: '20',
                        default: "'private'",
                    },
                    {
                        name: 'language',
                        type: 'varchar',
                        length: '10',
                        isNullable: true,
                    },
                    {
                        name: 'author',
                        type: 'varchar',
                        length: '255',
                        isNullable: true,
                    },
                    {
                        name: 'license',
                        type: 'varchar',
                        length: '255',
                        isNullable: true,
                    },
                    {
                        name: 'last_accessed_at',
                        type: dateTimeType,
                        isNullable: true,
                    },
                    {
                        name: 'saved_once',
                        type: 'boolean',
                        default: false,
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

        // Create foreign key from projects to users
        await queryRunner.createForeignKey(
            'projects',
            new TableForeignKey({
                columnNames: ['owner_id'],
                referencedTableName: 'users',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }),
        );

        // Create project_collaborators join table
        await queryRunner.createTable(
            new Table({
                name: 'project_collaborators',
                columns: [
                    {
                        name: 'project_id',
                        type: 'integer',
                        isPrimary: true,
                    },
                    {
                        name: 'user_id',
                        type: 'integer',
                        isPrimary: true,
                    },
                ],
            }),
            true,
        );

        await queryRunner.createForeignKey(
            'project_collaborators',
            new TableForeignKey({
                columnNames: ['project_id'],
                referencedTableName: 'projects',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }),
        );

        await queryRunner.createForeignKey(
            'project_collaborators',
            new TableForeignKey({
                columnNames: ['user_id'],
                referencedTableName: 'users',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }),
        );

        // Create yjs_documents table
        await queryRunner.createTable(
            new Table({
                name: 'yjs_documents',
                columns: [
                    {
                        name: 'id',
                        type: 'integer',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'project_id',
                        type: 'integer',
                        isNullable: false,
                        isUnique: true,
                    },
                    {
                        name: 'snapshot_data',
                        type: binaryType,
                        isNullable: false,
                    },
                    {
                        name: 'snapshot_version',
                        type: 'bigint',
                        default: 0,
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

        await queryRunner.createForeignKey(
            'yjs_documents',
            new TableForeignKey({
                columnNames: ['project_id'],
                referencedTableName: 'projects',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }),
        );

        // Create yjs_updates table
        await queryRunner.createTable(
            new Table({
                name: 'yjs_updates',
                columns: [
                    {
                        name: 'id',
                        type: 'integer',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'project_id',
                        type: 'integer',
                        isNullable: false,
                    },
                    {
                        name: 'update_data',
                        type: binaryType,
                        isNullable: false,
                    },
                    {
                        name: 'version',
                        type: 'bigint',
                        isNullable: false,
                    },
                    {
                        name: 'client_id',
                        type: 'varchar',
                        length: '255',
                        isNullable: true,
                    },
                    {
                        name: 'created_at',
                        type: dateTimeType,
                        isNullable: true,
                    },
                ],
            }),
            true,
        );

        await queryRunner.createForeignKey(
            'yjs_updates',
            new TableForeignKey({
                columnNames: ['project_id'],
                referencedTableName: 'projects',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }),
        );

        // Create index on (project_id, version) for efficient querying
        await queryRunner.createIndex(
            'yjs_updates',
            new TableIndex({
                name: 'IDX_yjs_updates_project_version',
                columnNames: ['project_id', 'version'],
            }),
        );

        // Create assets table
        await queryRunner.createTable(
            new Table({
                name: 'assets',
                columns: [
                    {
                        name: 'id',
                        type: 'integer',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'project_id',
                        type: 'integer',
                        isNullable: false,
                    },
                    {
                        name: 'filename',
                        type: 'varchar',
                        length: '255',
                        isNullable: false,
                    },
                    {
                        name: 'storage_path',
                        type: 'varchar',
                        length: '500',
                        isNullable: false,
                    },
                    {
                        name: 'mime_type',
                        type: 'varchar',
                        length: '100',
                        isNullable: true,
                    },
                    {
                        name: 'file_size',
                        type: 'bigint',
                        isNullable: true,
                    },
                    {
                        name: 'client_id',
                        type: 'varchar',
                        length: '36',
                        isNullable: true,
                    },
                    {
                        name: 'component_id',
                        type: 'varchar',
                        length: '255',
                        isNullable: true,
                    },
                    {
                        name: 'content_hash',
                        type: 'varchar',
                        length: '64',
                        isNullable: true,
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

        await queryRunner.createForeignKey(
            'assets',
            new TableForeignKey({
                columnNames: ['project_id'],
                referencedTableName: 'projects',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }),
        );

        // Create unique index on (client_id, project_id) for asset deduplication
        await queryRunner.createIndex(
            'assets',
            new TableIndex({
                name: 'IDX_asset_client_project',
                columnNames: ['client_id', 'project_id'],
                isUnique: true,
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop tables in reverse order (respecting foreign key constraints)
        await queryRunner.dropTable('assets', true);
        await queryRunner.dropTable('yjs_updates', true);
        await queryRunner.dropTable('yjs_documents', true);
        await queryRunner.dropTable('project_collaborators', true);
        await queryRunner.dropTable('projects', true);
    }
}
