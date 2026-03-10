<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260304140000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add payslips table (secure storage + matching + publishing)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE payslips (
            id INT AUTO_INCREMENT NOT NULL,
            user_id INT DEFAULT NULL,
            uploaded_by_id INT DEFAULT NULL,
            period_month VARCHAR(7) NOT NULL,
            original_filename VARCHAR(255) NOT NULL,
            stored_filename VARCHAR(255) NOT NULL,
            match_score DOUBLE PRECISION DEFAULT NULL,
            match_method VARCHAR(30) DEFAULT NULL,
            status VARCHAR(20) NOT NULL,
            uploaded_at DATETIME NOT NULL COMMENT "(DC2Type:datetime_immutable)",
            published_at DATETIME DEFAULT NULL COMMENT "(DC2Type:datetime_immutable)",
            PRIMARY KEY(id),
            INDEX idx_payslips_user_month (user_id, period_month),
            INDEX idx_payslips_month (period_month),
            INDEX IDX_PAYSLIPS_USER (user_id),
            INDEX IDX_PAYSLIPS_UPLOADED_BY (uploaded_by_id),
            CONSTRAINT FK_PAYSLIPS_USER FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
            CONSTRAINT FK_PAYSLIPS_UPLOADED_BY FOREIGN KEY (uploaded_by_id) REFERENCES users (id) ON DELETE SET NULL
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE payslips');
    }
}
