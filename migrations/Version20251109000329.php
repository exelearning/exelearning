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
        $this->addSql('CREATE TABLE project_collaborators (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, role VARCHAR(20) NOT NULL, granted_at DATETIME NOT NULL, project_id VARCHAR(20) NOT NULL, user_id INTEGER NOT NULL, granted_by_id INTEGER DEFAULT NULL, CONSTRAINT FK_964C0852166D1F9C FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE, CONSTRAINT FK_964C0852A76ED395 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE, CONSTRAINT FK_964C08523151C11F FOREIGN KEY (granted_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE INITIALLY IMMEDIATE)');
        $this->addSql('CREATE INDEX IDX_964C08523151C11F ON project_collaborators (granted_by_id)');
        $this->addSql('CREATE INDEX idx_project ON project_collaborators (project_id)');
        $this->addSql('CREATE INDEX idx_user ON project_collaborators (user_id)');
        $this->addSql('CREATE INDEX idx_role ON project_collaborators (role)');
        $this->addSql('CREATE UNIQUE INDEX uniq_project_user ON project_collaborators (project_id, user_id)');
        $this->addSql('CREATE TABLE projects (id VARCHAR(20) NOT NULL, title VARCHAR(255) NOT NULL, visibility VARCHAR(10) NOT NULL, created_at DATETIME NOT NULL, last_accessed_at DATETIME DEFAULT NULL, is_archived BOOLEAN NOT NULL, owner_id INTEGER NOT NULL, PRIMARY KEY (id), CONSTRAINT FK_5C93B3A47E3C61F9 FOREIGN KEY (owner_id) REFERENCES users (id) NOT DEFERRABLE INITIALLY IMMEDIATE)');
        $this->addSql('CREATE INDEX idx_owner ON projects (owner_id)');
        $this->addSql('CREATE INDEX idx_visibility ON projects (visibility)');
        $this->addSql('CREATE INDEX idx_created_at ON projects (created_at)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('DROP TABLE project_collaborators');
        $this->addSql('DROP TABLE projects');
    }
}
