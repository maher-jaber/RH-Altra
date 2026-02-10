<?php
declare(strict_types=1);
namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260209220000 extends AbstractMigration
{
    public function up(Schema $schema): void
    {
        $this->addSql("CREATE TABLE leave_attachments (
            id INT AUTO_INCREMENT NOT NULL,
            leave_request_id INT NOT NULL,
            path VARCHAR(255) NOT NULL,
            original_name VARCHAR(120) NOT NULL,
            created_at DATETIME NOT NULL,
            INDEX IDX_LA_REQ (leave_request_id),
            PRIMARY KEY(id)
        )");
        $this->addSql("CREATE TABLE leave_audit (
            id INT AUTO_INCREMENT NOT NULL,
            leave_request_id INT NOT NULL,
            action VARCHAR(50) NOT NULL,
            actor VARCHAR(255) NOT NULL,
            comment LONGTEXT DEFAULT NULL,
            created_at DATETIME NOT NULL,
            INDEX IDX_LAUDIT_REQ (leave_request_id),
            PRIMARY KEY(id)
        )");
    }
    public function down(Schema $schema): void {}
}
