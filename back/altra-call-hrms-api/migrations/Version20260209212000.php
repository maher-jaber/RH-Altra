<?php
declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260209212000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Leave requests fields for full creation flow (certificate, note, days, dates, comments)';
    }

    public function up(Schema $schema): void
    {
        $sm = $this->connection->createSchemaManager();
        $cols = $sm->listTableColumns('leave_requests');

        $has = fn(string $c) => array_key_exists($c, $cols);

        if (!$has('certificate_path'))
            $this->addSql("ALTER TABLE leave_requests ADD certificate_path VARCHAR(255) DEFAULT NULL");
        if (!$has('note'))
            $this->addSql("ALTER TABLE leave_requests ADD note LONGTEXT DEFAULT NULL");
        if (!$has('days_count'))
            $this->addSql("ALTER TABLE leave_requests ADD days_count DOUBLE PRECISION NOT NULL DEFAULT 0");
        if (!$has('start_date'))
            $this->addSql("ALTER TABLE leave_requests ADD start_date DATE DEFAULT NULL");
        if (!$has('end_date'))
            $this->addSql("ALTER TABLE leave_requests ADD end_date DATE DEFAULT NULL");
        if (!$has('manager_comment'))
            $this->addSql("ALTER TABLE leave_requests ADD manager_comment LONGTEXT DEFAULT NULL");
        if (!$has('hr_comment'))
            $this->addSql("ALTER TABLE leave_requests ADD hr_comment LONGTEXT DEFAULT NULL");
    }


    public function down(Schema $schema): void
    {
    }
}
