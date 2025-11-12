<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Integración completa del sistema de proyectos con almacenamiento de archivos.
 * - Agrega índices de rendimiento
 * - Integra project_id en tablas existentes
 * - Crea tabla de bloqueos de proyecto
 * - Migra datos existentes a proyectos
 */
final class Version20251109071500 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Integrate Project system with ODE file storage, add performance indexes, and create project locks table';
    }

    public function up(Schema $schema): void
    {
        // =================================================================
        // PASO 1: AGREGAR ÍNDICES DE RENDIMIENTO
        // =================================================================

        // Índices en ode_files para mejorar queries
        $this->addSql('CREATE INDEX IF NOT EXISTS idx_ode_files_user_manual ON ode_files(ode_id, user, is_manual_save)');
        $this->addSql('CREATE INDEX IF NOT EXISTS idx_ode_files_user_updated ON ode_files(user, updated_at)');
        $this->addSql('CREATE INDEX IF NOT EXISTS idx_ode_files_ode_updated ON ode_files(ode_id, updated_at)');

        // Índices en current_ode_users para búsquedas más rápidas
        $this->addSql('CREATE INDEX IF NOT EXISTS idx_current_ode_session_user ON current_ode_users(ode_session_id, user)');
        $this->addSql('CREATE INDEX IF NOT EXISTS idx_current_ode_last_action ON current_ode_users(last_action)');
        $this->addSql('CREATE INDEX IF NOT EXISTS idx_current_ode_id ON current_ode_users(ode_id)');

        // =================================================================
        // PASO 2: AGREGAR CAMPO project_id A TABLAS EXISTENTES
        // =================================================================

        // Agregar project_id a current_ode_users (SQLite no soporta IF NOT EXISTS en ALTER TABLE)
        $table = $schema->getTable('current_ode_users');
        if (!$table->hasColumn('project_id')) {
            $table->addColumn('project_id', 'string', ['length' => 20, 'notnull' => false]);
            $table->addIndex(['project_id'], 'idx_current_ode_project');
        }

        // Agregar project_id a ode_files
        $table = $schema->getTable('ode_files');
        if (!$table->hasColumn('project_id')) {
            $table->addColumn('project_id', 'string', ['length' => 20, 'notnull' => false]);
            $table->addIndex(['project_id'], 'idx_ode_files_project');
        }

        // =================================================================
        // PASO 3: CREAR TABLA DE BLOQUEOS DE PROYECTO
        // =================================================================

        // Use Schema API instead of raw SQL for cross-database compatibility
        if (!$schema->hasTable('project_locks')) {
            $table = $schema->createTable('project_locks');
            $table->addColumn('id', 'integer', ['autoincrement' => true, 'notnull' => true]);
            $table->addColumn('project_id', 'string', ['length' => 20, 'notnull' => true]);
            $table->addColumn('locked_by_id', 'integer', ['notnull' => true]);
            $table->addColumn('session_id', 'string', ['length' => 20, 'notnull' => true]);
            $table->addColumn('locked_at', 'datetime', ['notnull' => true]);
            $table->addColumn('expires_at', 'datetime', ['notnull' => true]);
            $table->setPrimaryKey(['id']);
            $table->addIndex(['project_id'], 'idx_lock_project');
            $table->addIndex(['expires_at'], 'idx_lock_expires');
            $table->addIndex(['session_id'], 'idx_lock_session');
            $table->addForeignKeyConstraint('projects', ['project_id'], ['id'], ['onDelete' => 'CASCADE'], 'fk_lock_project');
            $table->addForeignKeyConstraint('users', ['locked_by_id'], ['id'], ['onDelete' => 'CASCADE'], 'fk_lock_user');
        }
    }

    /**
     * Migrar datos después de que el esquema ha sido actualizado.
     */
    public function postUp(Schema $schema): void
    {
        // =================================================================
        // PASO 4: MIGRAR DATOS EXISTENTES
        // =================================================================

        $platform = $this->connection->getDatabasePlatform();
        $isSQLite = $platform instanceof \Doctrine\DBAL\Platforms\SqlitePlatform;
        $isPostgreSQL = $platform instanceof \Doctrine\DBAL\Platforms\PostgreSQLPlatform;
        $isMySQL = $platform instanceof \Doctrine\DBAL\Platforms\MySQLPlatform;

        // 4.1: Actualizar project_id en ode_files (usar ode_id como project_id)
        $this->connection->executeStatement('UPDATE ode_files SET project_id = ode_id WHERE project_id IS NULL');

        // 4.2: Actualizar project_id en current_ode_users (usar ode_id como project_id)
        $this->connection->executeStatement('UPDATE current_ode_users SET project_id = ode_id WHERE project_id IS NULL');

        // 4.3: Insertar proyectos faltantes que puedan existir en ode_files pero no en projects
        // Esto maneja casos edge donde ode_files tenga registros sin project correspondiente

        // Cross-database compatible INSERT IGNORE / ON CONFLICT
        if ($isSQLite) {
            // SQLite: INSERT OR IGNORE with || for concatenation
            $insertProjectsSql = 'INSERT OR IGNORE INTO projects (id, title, visibility, owner_id, created_at, last_accessed_at, is_archived)
                SELECT
                    of.ode_id as id,
                    COALESCE(of.title, "Proyecto " || of.ode_id) as title,
                    "private" as visibility,
                    COALESCE(
                        (SELECT id FROM users WHERE email = of.user LIMIT 1),
                        (SELECT id FROM users ORDER BY id LIMIT 1)
                    ) as owner_id,
                    MIN(of.created_at) as created_at,
                    MAX(of.updated_at) as last_accessed_at,
                    0 as is_archived
                FROM ode_files of
                WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = of.ode_id)
                GROUP BY of.ode_id, of.title, of.user';
        } elseif ($isPostgreSQL) {
            // PostgreSQL: ON CONFLICT DO NOTHING with || for concatenation
            $insertProjectsSql = 'INSERT INTO projects (id, title, visibility, owner_id, created_at, last_accessed_at, is_archived)
                SELECT
                    of.ode_id as id,
                    COALESCE(of.title, \'Proyecto \' || of.ode_id) as title,
                    \'private\' as visibility,
                    COALESCE(
                        (SELECT id FROM users WHERE email = of.user LIMIT 1),
                        (SELECT id FROM users ORDER BY id LIMIT 1)
                    ) as owner_id,
                    MIN(of.created_at) as created_at,
                    MAX(of.updated_at) as last_accessed_at,
                    false as is_archived
                FROM ode_files of
                WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = of.ode_id)
                GROUP BY of.ode_id, of.title, of.user
                ON CONFLICT (id) DO NOTHING';
        } else {
            // MySQL/MariaDB: INSERT IGNORE with CONCAT
            $insertProjectsSql = 'INSERT IGNORE INTO projects (id, title, visibility, owner_id, created_at, last_accessed_at, is_archived)
                SELECT
                    of.ode_id as id,
                    COALESCE(of.title, CONCAT("Proyecto ", of.ode_id)) as title,
                    "private" as visibility,
                    COALESCE(
                        (SELECT id FROM users WHERE email = of.user LIMIT 1),
                        (SELECT id FROM users ORDER BY id LIMIT 1)
                    ) as owner_id,
                    MIN(of.created_at) as created_at,
                    MAX(of.updated_at) as last_accessed_at,
                    0 as is_archived
                FROM ode_files of
                WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = of.ode_id)
                GROUP BY of.ode_id, of.title, of.user';
        }

        $this->connection->executeStatement($insertProjectsSql);

        // 4.4: Crear colaboradores (owners) para proyectos nuevos
        if ($isSQLite) {
            $insertCollaboratorsSql = 'INSERT OR IGNORE INTO project_collaborators (project_id, user_id, role, granted_at, granted_by_id)
                SELECT
                    p.id as project_id,
                    p.owner_id as user_id,
                    "owner" as role,
                    p.created_at as granted_at,
                    NULL as granted_by_id
                FROM projects p
                WHERE NOT EXISTS (
                    SELECT 1 FROM project_collaborators pc
                    WHERE pc.project_id = p.id AND pc.user_id = p.owner_id
                )';
        } elseif ($isPostgreSQL) {
            $insertCollaboratorsSql = 'INSERT INTO project_collaborators (project_id, user_id, role, granted_at, granted_by_id)
                SELECT
                    p.id as project_id,
                    p.owner_id as user_id,
                    \'owner\' as role,
                    p.created_at as granted_at,
                    NULL as granted_by_id
                FROM projects p
                WHERE NOT EXISTS (
                    SELECT 1 FROM project_collaborators pc
                    WHERE pc.project_id = p.id AND pc.user_id = p.owner_id
                )
                ON CONFLICT (project_id, user_id) DO NOTHING';
        } else {
            $insertCollaboratorsSql = 'INSERT IGNORE INTO project_collaborators (project_id, user_id, role, granted_at, granted_by_id)
                SELECT
                    p.id as project_id,
                    p.owner_id as user_id,
                    "owner" as role,
                    p.created_at as granted_at,
                    NULL as granted_by_id
                FROM projects p
                WHERE NOT EXISTS (
                    SELECT 1 FROM project_collaborators pc
                    WHERE pc.project_id = p.id AND pc.user_id = p.owner_id
                )';
        }

        $this->connection->executeStatement($insertCollaboratorsSql);
    }

    public function down(Schema $schema): void
    {
        // Revertir cambios en orden inverso

        // Eliminar tabla de bloqueos
        if ($schema->hasTable('project_locks')) {
            $schema->dropTable('project_locks');
        }

        // Eliminar project_id de ode_files
        if ($schema->hasTable('ode_files')) {
            $table = $schema->getTable('ode_files');
            if ($table->hasIndex('idx_ode_files_project')) {
                $table->dropIndex('idx_ode_files_project');
            }
            if ($table->hasColumn('project_id')) {
                $table->dropColumn('project_id');
            }
        }

        // Eliminar project_id de current_ode_users
        if ($schema->hasTable('current_ode_users')) {
            $table = $schema->getTable('current_ode_users');
            if ($table->hasIndex('idx_current_ode_project')) {
                $table->dropIndex('idx_current_ode_project');
            }
            if ($table->hasColumn('project_id')) {
                $table->dropColumn('project_id');
            }
        }

        // Eliminar índices de rendimiento (use raw SQL for IF EXISTS in indexes)
        $this->addSql('DROP INDEX IF EXISTS idx_ode_files_user_manual');
        $this->addSql('DROP INDEX IF EXISTS idx_ode_files_user_updated');
        $this->addSql('DROP INDEX IF EXISTS idx_ode_files_ode_updated');
        $this->addSql('DROP INDEX IF EXISTS idx_current_ode_session_user');
        $this->addSql('DROP INDEX IF EXISTS idx_current_ode_last_action');
        $this->addSql('DROP INDEX IF EXISTS idx_current_ode_id');
    }
}
