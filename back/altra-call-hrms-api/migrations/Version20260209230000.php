<?php
declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260209230000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Multi-company + signatures + archives + attachments/audit support';
    }

    public function up(Schema $schema): void
    {
        // Idempotent migration (dev-friendly): many users may have pre-created tables via schema:update.
        $db = (string) $this->connection->fetchOne('SELECT DATABASE()');

        $companiesExists = (int) $this->connection->fetchOne(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ? AND table_name = 'companies'",
            [$db]
        );
        if ($companiesExists === 0) {
            $this->addSql("CREATE TABLE companies (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(150) NOT NULL, code VARCHAR(60) NOT NULL, UNIQUE INDEX uniq_companies_name (name), UNIQUE INDEX uniq_companies_code (code), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB");
        }

        $deptHasCompany = (int) $this->connection->fetchOne(
            "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = ? AND table_name = 'departments' AND column_name = 'company_id'",
            [$db]
        );
        if ($deptHasCompany === 0) {
            $this->addSql("ALTER TABLE departments ADD company_id INT DEFAULT NULL");
        }

        $userHasCompany = (int) $this->connection->fetchOne(
            "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = ? AND table_name = 'users' AND column_name = 'company_id'",
            [$db]
        );
        if ($userHasCompany === 0) {
            $this->addSql("ALTER TABLE users ADD company_id INT DEFAULT NULL");
        }

        $cols = ['manager_signed_at','hr_signed_at','manager_signature','hr_signature','manager_signer_name','hr_signer_name'];
        foreach ($cols as $col) {
            $has = (int) $this->connection->fetchOne(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = ? AND table_name = 'leave_requests' AND column_name = ?",
                [$db, $col]
            );
            if ($has === 0) {
                if (in_array($col, ['manager_signed_at','hr_signed_at'], true)) {
                    $this->addSql("ALTER TABLE leave_requests ADD {$col} DATETIME DEFAULT NULL");
                } elseif (in_array($col, ['manager_signer_name','hr_signer_name'], true)) {
                    $this->addSql("ALTER TABLE leave_requests ADD {$col} VARCHAR(120) DEFAULT NULL");
                } else {
                    $this->addSql("ALTER TABLE leave_requests ADD {$col} LONGTEXT DEFAULT NULL");
                }
            }
        }

        $archivesExists = (int) $this->connection->fetchOne(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ? AND table_name = 'leave_archives'",
            [$db]
        );
        if ($archivesExists === 0) {
            // Important (MySQL 8): FK columns on CHAR/VARCHAR must have same charset/collation as referenced column.
            // leave_requests.id is CHAR(36) with utf8mb4_unicode_ci in our schema.
            $this->addSql("CREATE TABLE leave_archives (id INT AUTO_INCREMENT NOT NULL, leave_request_id CHAR(36) COLLATE `utf8mb4_unicode_ci` NOT NULL, path VARCHAR(255) NOT NULL, sha256 VARCHAR(64) NOT NULL, created_at DATETIME NOT NULL, UNIQUE INDEX uniq_leave_archives_lr (leave_request_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB");
            $this->addSql("ALTER TABLE leave_archives ADD CONSTRAINT fk_leave_archives_req FOREIGN KEY (leave_request_id) REFERENCES leave_requests (id) ON DELETE CASCADE");
        }
    }

    public function down(Schema $schema): void {}
}
