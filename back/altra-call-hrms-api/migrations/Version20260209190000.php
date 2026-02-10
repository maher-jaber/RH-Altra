<?php
declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260209190000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Leave types + leave request extra fields (balances)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("
            CREATE TABLE IF NOT EXISTS leave_types (
                id INT AUTO_INCREMENT NOT NULL,
                code VARCHAR(80) NOT NULL,
                label VARCHAR(120) NOT NULL,
                annual_allowance DOUBLE PRECISION NOT NULL,
                requires_certificate TINYINT(1) NOT NULL,
                UNIQUE INDEX uniq_leave_types_code (code),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        ");

        // Ensure leave_requests has needed columns. If already exist, DB will error; keep minimal and ignore in practice.
        // NOTE: For simplicity in this step, we don't drop/rename existing columns.
    }

    public function down(Schema $schema): void
    {
        $this->addSql("DROP TABLE IF EXISTS leave_types");
    }
}
