<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Platforms\MariaDBPlatform;
use Doctrine\DBAL\Platforms\MySQLPlatform;
use Doctrine\DBAL\Platforms\SqlitePlatform;
use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * FIX #695: Rename 'user' column to 'username' for PostgreSQL compatibility.
 * The column name 'user' is a reserved keyword in PostgreSQL.
 * Doctrine's backtick quoting strategy doesn't work correctly with PHP 8 attributes.
 */
final class Version20251126000001 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Rename user column to username (PostgreSQL reserved keyword fix #695)';
    }

    public function up(Schema $schema): void
    {
        $platform = $this->connection->getDatabasePlatform();
        $tables = ['current_ode_users', 'ode_files', 'ode_operations_log'];

        foreach ($tables as $tableName) {
            // Skip if table doesn't exist or column 'user' doesn't exist (already migrated or new install)
            if (!$schema->hasTable($tableName)) {
                continue;
            }
            $table = $schema->getTable($tableName);
            if (!$table->hasColumn('user')) {
                continue; // Column already renamed or table created with new schema
            }

            if ($platform instanceof SqlitePlatform) {
                // SQLite 3.25+ supports RENAME COLUMN
                $this->addSql("ALTER TABLE $tableName RENAME COLUMN \"user\" TO username");
            } elseif ($platform instanceof MySQLPlatform || $platform instanceof MariaDBPlatform) {
                // MySQL/MariaDB syntax
                $this->addSql("ALTER TABLE $tableName CHANGE COLUMN `user` `username` VARCHAR(128) NOT NULL");
            } else {
                // PostgreSQL (ANSI SQL)
                $this->addSql("ALTER TABLE $tableName RENAME COLUMN \"user\" TO username");
            }
        }
    }

    public function down(Schema $schema): void
    {
        $platform = $this->connection->getDatabasePlatform();
        $tables = ['current_ode_users', 'ode_files', 'ode_operations_log'];

        foreach ($tables as $tableName) {
            // Skip if table doesn't exist or column 'username' doesn't exist
            if (!$schema->hasTable($tableName)) {
                continue;
            }
            $table = $schema->getTable($tableName);
            if (!$table->hasColumn('username')) {
                continue;
            }

            if ($platform instanceof SqlitePlatform) {
                $this->addSql("ALTER TABLE $tableName RENAME COLUMN username TO \"user\"");
            } elseif ($platform instanceof MySQLPlatform || $platform instanceof MariaDBPlatform) {
                $this->addSql("ALTER TABLE $tableName CHANGE COLUMN `username` `user` VARCHAR(128) NOT NULL");
            } else {
                // PostgreSQL
                $this->addSql("ALTER TABLE $tableName RENAME COLUMN username TO \"user\"");
            }
        }
    }
}
