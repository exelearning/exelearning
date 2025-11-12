<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20251109000329 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        // Use Schema API for cross-database compatibility (works with SQLite, MySQL, MariaDB, PostgreSQL)

        // Only create projects table if it doesn't exist
        if (!$schema->hasTable('projects')) {
            $table = $schema->createTable('projects');
            $table->addColumn('id', 'string', ['length' => 20, 'notnull' => true]);
            $table->addColumn('title', 'string', ['length' => 255, 'notnull' => true]);
            $table->addColumn('visibility', 'string', ['length' => 10, 'notnull' => true]);
            $table->addColumn('created_at', 'datetime', ['notnull' => true]);
            $table->addColumn('last_accessed_at', 'datetime', ['notnull' => false]);
            $table->addColumn('is_archived', 'boolean', ['notnull' => true]);
            $table->addColumn('owner_id', 'integer', ['notnull' => true]);
            $table->setPrimaryKey(['id']);
            $table->addIndex(['owner_id'], 'idx_owner');
            $table->addIndex(['visibility'], 'idx_visibility');
            $table->addIndex(['created_at'], 'idx_created_at');
            $table->addForeignKeyConstraint('users', ['owner_id'], ['id'], [], 'FK_5C93B3A47E3C61F9');
        }

        // Only create project_collaborators table if it doesn't exist
        if (!$schema->hasTable('project_collaborators')) {
            $table = $schema->createTable('project_collaborators');
            $table->addColumn('id', 'integer', ['autoincrement' => true, 'notnull' => true]);
            $table->addColumn('role', 'string', ['length' => 20, 'notnull' => true]);
            $table->addColumn('granted_at', 'datetime', ['notnull' => true]);
            $table->addColumn('project_id', 'string', ['length' => 20, 'notnull' => true]);
            $table->addColumn('user_id', 'integer', ['notnull' => true]);
            $table->addColumn('granted_by_id', 'integer', ['notnull' => false, 'default' => null]);
            $table->setPrimaryKey(['id']);
            $table->addIndex(['granted_by_id'], 'IDX_964C08523151C11F');
            $table->addIndex(['project_id'], 'idx_project');
            $table->addIndex(['user_id'], 'idx_user');
            $table->addIndex(['role'], 'idx_role');
            $table->addUniqueIndex(['project_id', 'user_id'], 'uniq_project_user');
            $table->addForeignKeyConstraint('projects', ['project_id'], ['id'], ['onDelete' => 'CASCADE'], 'FK_964C0852166D1F9C');
            $table->addForeignKeyConstraint('users', ['user_id'], ['id'], ['onDelete' => 'CASCADE'], 'FK_964C0852A76ED395');
            $table->addForeignKeyConstraint('users', ['granted_by_id'], ['id'], ['onDelete' => 'SET NULL'], 'FK_964C08523151C11F');
        }
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        // Only drop tables if they exist in the actual database (safe rollback)

        if ($schema->hasTable('project_collaborators')) {
            $schema->dropTable('project_collaborators');
        }

        if ($schema->hasTable('projects')) {
            $schema->dropTable('projects');
        }
    }
}
