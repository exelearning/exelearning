<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Crea la tabla ode_edit_locks para el sistema de bloqueo pesimista en colaboración multi-usuario.
 * - Permite bloquear recursos (páginas, bloques, iDevices) durante edición
 * - Previene ediciones concurrentes conflictivas
 * - Soporta expiración automática de bloqueos
 */
final class Version20251110123427 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create ode_edit_locks table for pessimistic locking in multi-user collaboration';
    }

    public function up(Schema $schema): void
    {
        // Use Doctrine Schema API for cross-database compatibility (SQLite, MySQL, MariaDB, PostgreSQL)

        // Only create ode_edit_locks table if it doesn't exist
        if (!$schema->hasTable('ode_edit_locks')) {
            $table = $schema->createTable('ode_edit_locks');

            // Add columns
            $table->addColumn('id', 'integer', ['autoincrement' => true, 'notnull' => true]);
            $table->addColumn('ode_session_id', 'string', ['length' => 20, 'notnull' => true]);
            $table->addColumn('resource_type', 'string', ['length' => 20, 'notnull' => true]);
            $table->addColumn('resource_id', 'string', ['length' => 64, 'notnull' => true]);
            $table->addColumn('locked_by', 'string', ['length' => 128, 'notnull' => true]);
            $table->addColumn('locked_at', 'datetime', ['notnull' => true]);
            $table->addColumn('expires_at', 'datetime', ['notnull' => true]);

            // Set primary key
            $table->setPrimaryKey(['id']);

            // Add indexes
            // Índice único: solo un bloqueo por recurso en una sesión
            $table->addUniqueIndex(['ode_session_id', 'resource_type', 'resource_id'], 'uniq_session_resource');

            // Índice para búsquedas por sesión
            $table->addIndex(['ode_session_id'], 'idx_ode_session_id');

            // Índice para búsquedas por usuario
            $table->addIndex(['locked_by'], 'idx_locked_by');

            // Índice para cleanup de bloqueos expirados
            $table->addIndex(['expires_at'], 'idx_expires_at');

            // Índice para búsquedas por tipo de recurso
            $table->addIndex(['resource_type'], 'idx_resource_type');
        }
    }

    public function down(Schema $schema): void
    {
        // Drop table if it exists (indexes are automatically dropped with the table)
        if ($schema->hasTable('ode_edit_locks')) {
            $schema->dropTable('ode_edit_locks');
        }
    }
}
