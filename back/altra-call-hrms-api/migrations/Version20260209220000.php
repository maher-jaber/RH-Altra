<?php
declare(strict_types=1);
namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260209220000 extends AbstractMigration
{
    public function up(Schema $schema): void
    {
        // Idempotent migration (dev-friendly)
        $db = (string) $this->connection->fetchOne('SELECT DATABASE()');

        $attachmentsExists = (int) $this->connection->fetchOne(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ? AND table_name = 'leave_attachments'",
            [$db]
        );
        if ($attachmentsExists === 0) {
            $this->addSql("CREATE TABLE leave_attachments (
                id INT AUTO_INCREMENT NOT NULL,
                leave_request_id CHAR(36) NOT NULL,
                path VARCHAR(255) NOT NULL,
                original_name VARCHAR(120) NOT NULL,
                created_at DATETIME NOT NULL,
                INDEX IDX_LA_REQ (leave_request_id),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB");
            $this->addSql("ALTER TABLE leave_attachments ADD CONSTRAINT fk_leave_attachments_req FOREIGN KEY (leave_request_id) REFERENCES leave_requests (id) ON DELETE CASCADE");
        }

        $auditExists = (int) $this->connection->fetchOne(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ? AND table_name = 'leave_audit'",
            [$db]
        );
        if ($auditExists === 0) {
            $this->addSql("CREATE TABLE leave_audit (
                id INT AUTO_INCREMENT NOT NULL,
                leave_request_id CHAR(36) NOT NULL,
                action VARCHAR(50) NOT NULL,
                actor VARCHAR(255) NOT NULL,
                comment LONGTEXT DEFAULT NULL,
                created_at DATETIME NOT NULL,
                INDEX IDX_LAUDIT_REQ (leave_request_id),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB");
            $this->addSql("ALTER TABLE leave_audit ADD CONSTRAINT fk_leave_audit_req FOREIGN KEY (leave_request_id) REFERENCES leave_requests (id) ON DELETE CASCADE");
        }
    }
    public function down(Schema $schema): void {}
}
