<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260209090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Initial tables for leave_requests and notifications';
    }

    public function up(Schema $schema): void
    {
        // MySQL/MariaDB compatible
        $this->addSql("
            CREATE TABLE leave_requests (
              id CHAR(36) NOT NULL,
              type VARCHAR(20) NOT NULL,
              start_date DATE NOT NULL,
              end_date DATE NOT NULL,
              half_day VARCHAR(2) DEFAULT NULL,
              reason LONGTEXT DEFAULT NULL,
              status VARCHAR(20) NOT NULL,
              created_by_api_key VARCHAR(80) NOT NULL,
              created_at DATETIME NOT NULL,
              PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        ");
        $this->addSql('CREATE INDEX idx_leave_created_by ON leave_requests (created_by_api_key)');
    
        $this->addSql("
            CREATE TABLE notifications (
              id CHAR(36) NOT NULL,
              recipient_api_key VARCHAR(80) NOT NULL,
              title VARCHAR(120) NOT NULL,
              message LONGTEXT NOT NULL,
              created_at DATETIME NOT NULL,
              read_at DATETIME DEFAULT NULL,
              PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        ");
        $this->addSql('CREATE INDEX idx_notif_recipient ON notifications (recipient_api_key)');
    }
    

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE notifications');
        $this->addSql('DROP TABLE leave_requests');
    }
}
