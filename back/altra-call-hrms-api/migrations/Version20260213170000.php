<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260213170000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add hire_date and leave_initial_balance columns to users.';
    }

    public function up(Schema $schema): void
    {
        // Users table: add hire_date (nullable) and leave_initial_balance (default 0)
        $this->addSql('ALTER TABLE users ADD hire_date DATE DEFAULT NULL');
        $this->addSql('ALTER TABLE users ADD leave_initial_balance DOUBLE PRECISION NOT NULL DEFAULT 0');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE users DROP hire_date');
        $this->addSql('ALTER TABLE users DROP leave_initial_balance');
    }
}
