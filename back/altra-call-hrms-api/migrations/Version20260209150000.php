<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260209150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add users and password reset tokens for email/password authentication';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("
            CREATE TABLE users (
              id INT AUTO_INCREMENT NOT NULL,
              email VARCHAR(180) NOT NULL,
              password_hash VARCHAR(255) NOT NULL,
              roles JSON NOT NULL,
              api_key VARCHAR(80) NOT NULL,
              full_name VARCHAR(120) DEFAULT NULL,
              created_at DATETIME NOT NULL,
              UNIQUE INDEX uniq_users_email (email),
              UNIQUE INDEX uniq_users_api_key (api_key),
              PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        ");

        $this->addSql("
            CREATE TABLE password_reset_tokens (
              id INT AUTO_INCREMENT NOT NULL,
              user_id INT NOT NULL,
              token VARCHAR(100) NOT NULL,
              expires_at DATETIME NOT NULL,
              used_at DATETIME DEFAULT NULL,
              created_at DATETIME NOT NULL,
              INDEX idx_prt_token (token),
              INDEX idx_prt_user (user_id),
              PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        ");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE password_reset_tokens');
        $this->addSql('DROP TABLE users');
    }
}
