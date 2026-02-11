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
              id INT AUTO_INCREMENT NOT NULL,
              user_id INT NOT NULL,
              title VARCHAR(120) NOT NULL,
              body LONGTEXT DEFAULT NULL,
              type VARCHAR(60) NOT NULL,
              is_read TINYINT(1) NOT NULL,
              created_at DATETIME NOT NULL,
              INDEX idx_notifications_user (user_id),
              PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        ");
        // Foreign key to users is added in a later migration (users table is created later).
    }
    

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE notifications');
        $this->addSql('DROP TABLE leave_requests');
    }
}
