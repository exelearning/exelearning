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
        // Crear tabla de bloqueos de edición
        $this->addSql('CREATE TABLE IF NOT EXISTS ode_edit_locks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ode_session_id VARCHAR(20) NOT NULL,
            resource_type VARCHAR(20) NOT NULL,
            resource_id VARCHAR(64) NOT NULL,
            locked_by VARCHAR(128) NOT NULL,
            locked_at DATETIME NOT NULL,
            expires_at DATETIME NOT NULL
        )');

        // Índice único: solo un bloqueo por recurso en una sesión
        $this->addSql('CREATE UNIQUE INDEX IF NOT EXISTS uniq_session_resource
            ON ode_edit_locks(ode_session_id, resource_type, resource_id)');

        // Índice para búsquedas por sesión
        $this->addSql('CREATE INDEX IF NOT EXISTS idx_ode_session_id
            ON ode_edit_locks(ode_session_id)');

        // Índice para búsquedas por usuario
        $this->addSql('CREATE INDEX IF NOT EXISTS idx_locked_by
            ON ode_edit_locks(locked_by)');

        // Índice para cleanup de bloqueos expirados
        $this->addSql('CREATE INDEX IF NOT EXISTS idx_expires_at
            ON ode_edit_locks(expires_at)');

        // Índice para búsquedas por tipo de recurso
        $this->addSql('CREATE INDEX IF NOT EXISTS idx_resource_type
            ON ode_edit_locks(resource_type)');
    }

    public function down(Schema $schema): void
    {
        // Eliminar índices
        $this->addSql('DROP INDEX IF EXISTS idx_resource_type');
        $this->addSql('DROP INDEX IF EXISTS idx_expires_at');
        $this->addSql('DROP INDEX IF EXISTS idx_locked_by');
        $this->addSql('DROP INDEX IF EXISTS idx_ode_session_id');
        $this->addSql('DROP INDEX IF EXISTS uniq_session_resource');

        // Eliminar tabla
        $this->addSql('DROP TABLE IF EXISTS ode_edit_locks');
    }
}
