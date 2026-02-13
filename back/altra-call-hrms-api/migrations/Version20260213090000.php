<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260213090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add manager2 fields to leave_requests for dual-manager approvals.';
    }

    public function up(Schema $schema): void
    {
        // manager2_id is a FK to users(id)
        $this->addSql('ALTER TABLE leave_requests ADD manager2_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE leave_requests ADD manager2_comment LONGTEXT DEFAULT NULL');
        $this->addSql("ALTER TABLE leave_requests ADD manager2_signed_at DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)'");
        $this->addSql('ALTER TABLE leave_requests ADD CONSTRAINT FK_LEAVE_REQUESTS_MANAGER2 FOREIGN KEY (manager2_id) REFERENCES users (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_LEAVE_REQUESTS_MANAGER2 ON leave_requests (manager2_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE leave_requests DROP FOREIGN KEY FK_LEAVE_REQUESTS_MANAGER2');
        $this->addSql('DROP INDEX IDX_LEAVE_REQUESTS_MANAGER2 ON leave_requests');
        $this->addSql('ALTER TABLE leave_requests DROP manager2_id, DROP manager2_comment, DROP manager2_signed_at');
    }
}
