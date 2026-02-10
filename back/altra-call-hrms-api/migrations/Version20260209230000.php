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
        $this->addSql("CREATE TABLE companies (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(150) NOT NULL, code VARCHAR(60) NOT NULL, UNIQUE INDEX uniq_companies_name (name), UNIQUE INDEX uniq_companies_code (code), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB");
        $this->addSql("ALTER TABLE departments ADD company_id INT DEFAULT NULL");
        $this->addSql("ALTER TABLE users ADD company_id INT DEFAULT NULL");

        $this->addSql("ALTER TABLE leave_requests ADD manager_signed_at DATETIME DEFAULT NULL");
        $this->addSql("ALTER TABLE leave_requests ADD hr_signed_at DATETIME DEFAULT NULL");
        $this->addSql("ALTER TABLE leave_requests ADD manager_signature LONGTEXT DEFAULT NULL");
        $this->addSql("ALTER TABLE leave_requests ADD hr_signature LONGTEXT DEFAULT NULL");
        $this->addSql("ALTER TABLE leave_requests ADD manager_signer_name VARCHAR(120) DEFAULT NULL");
        $this->addSql("ALTER TABLE leave_requests ADD hr_signer_name VARCHAR(120) DEFAULT NULL");

        $this->addSql("CREATE TABLE leave_archives (id INT AUTO_INCREMENT NOT NULL, leave_request_id INT NOT NULL, path VARCHAR(255) NOT NULL, sha256 VARCHAR(64) NOT NULL, created_at DATETIME NOT NULL, UNIQUE INDEX uniq_leave_archives_lr (leave_request_id), PRIMARY KEY(id))");
    }

    public function down(Schema $schema): void {}
}
