<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20250821221253 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add quota_mb column to users table';
    }

    public function up(Schema $schema): void
    {
        // Add quota_mb if it does not already exist (tests may have created it via schema:update)
        if ($schema->hasTable('users')) {
            $table = $schema->getTable('users');
            if ($table->hasColumn('quota_mb')) {
                return; // already present
            }
        }

        $platform = $this->connection->getDatabasePlatform()->getName();
        if (str_contains($platform, 'sqlite')) {
            $this->addSql('ALTER TABLE users ADD COLUMN quota_mb INTEGER DEFAULT NULL');
        } elseif (str_contains($platform, 'mysql')) {
            $this->addSql('ALTER TABLE users ADD COLUMN quota_mb INT DEFAULT NULL');
        } else { // postgresql or others
            $this->addSql('ALTER TABLE users ADD COLUMN quota_mb INT NULL');
        }
    }

    public function down(Schema $schema): void
    {
        // SQLite does not support DROP COLUMN in older versions; wrap in try/catch at runtime
        try {
            $this->addSql('ALTER TABLE users DROP COLUMN quota_mb');
        } catch (\Throwable $e) {
            // No-op for platforms not supporting DROP COLUMN easily
        }
    }
}
