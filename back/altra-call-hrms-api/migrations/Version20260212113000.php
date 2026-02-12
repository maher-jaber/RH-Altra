<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260212113000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add users.net_salary and advances period (month/year) for monthly advance rules';
    }

    public function up(Schema $schema): void
    {
        // users.net_salary
        $this->addSql("ALTER TABLE users ADD net_salary NUMERIC(10,2) DEFAULT NULL");

        // advance_requests period
        $this->addSql("ALTER TABLE advance_requests ADD period_year INT DEFAULT NULL, ADD period_month INT DEFAULT NULL");
        $this->addSql("UPDATE advance_requests SET period_year = YEAR(created_at), period_month = MONTH(created_at) WHERE period_year IS NULL OR period_month IS NULL");
        $this->addSql("ALTER TABLE advance_requests MODIFY period_year INT NOT NULL, MODIFY period_month INT NOT NULL");
        $this->addSql("CREATE INDEX IDX_ADV_USER_PERIOD ON advance_requests (user_id, period_year, period_month)");
    }

    public function down(Schema $schema): void
    {
        $this->addSql("DROP INDEX IDX_ADV_USER_PERIOD ON advance_requests");
        $this->addSql("ALTER TABLE advance_requests DROP period_year, DROP period_month");
        $this->addSql("ALTER TABLE users DROP net_salary");
    }
}
