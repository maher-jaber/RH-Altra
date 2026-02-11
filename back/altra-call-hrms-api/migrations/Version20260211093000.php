<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Align leave_requests schema with the Leave workflow (LeaveType + User relations)
 * and seed a ready-to-use list of leave types.
 */
final class Version20260211093000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Leave requests: add user/type/manager relations + seed default leave types';
    }

    public function up(Schema $schema): void
    {
        $sm = $this->connection->createSchemaManager();

        // --- leave_types seed (idempotent)
        if ($sm->tablesExist(['leave_types'])) {
            $this->addSql("INSERT IGNORE INTO leave_types (code, label, annual_allowance, requires_certificate) VALUES
                ('ANNUAL','Congé annuel',21,0),
                ('SICK','Congé maladie',0,1),
                ('UNPAID','Congé sans solde',0,0),
                ('EXCEPTIONAL','Congé exceptionnel',3,0),
                ('MATERNITY','Congé maternité',0,0),
                ('PATERNITY','Congé paternité',0,0),
                ('TRAINING','Formation',0,0)
            ");
        }

        if (!$sm->tablesExist(['leave_requests'])) {
            // Nothing else to do.
            return;
        }

        $cols = $sm->listTableColumns('leave_requests');
        $has = fn(string $c) => array_key_exists($c, $cols);

        if (!$has('type_id')) {
            $this->addSql('ALTER TABLE leave_requests ADD type_id INT DEFAULT NULL');
            $this->addSql('CREATE INDEX idx_leave_type_id ON leave_requests (type_id)');
        }
        if (!$has('user_id')) {
            $this->addSql('ALTER TABLE leave_requests ADD user_id INT DEFAULT NULL');
            $this->addSql('CREATE INDEX idx_leave_user_id ON leave_requests (user_id)');
        }
        if (!$has('manager_id')) {
            $this->addSql('ALTER TABLE leave_requests ADD manager_id INT DEFAULT NULL');
            $this->addSql('CREATE INDEX idx_leave_manager_id ON leave_requests (manager_id)');
        }

        // Foreign keys (safe to try; if already exist, MySQL will error in some setups.
        // In dev, this is fine; on prod you typically run once.)
        // We guard using schema manager constraints list.
        $fks = array_map(fn($fk) => $fk->getName(), $sm->listTableForeignKeys('leave_requests'));
        $hasFk = fn(string $name) => in_array($name, $fks, true);

        if ($sm->tablesExist(['leave_types']) && !$hasFk('fk_leave_requests_type')) {
            $this->addSql('ALTER TABLE leave_requests ADD CONSTRAINT fk_leave_requests_type FOREIGN KEY (type_id) REFERENCES leave_types (id) ON DELETE SET NULL');
        }
        if ($sm->tablesExist(['users']) && !$hasFk('fk_leave_requests_user')) {
            $this->addSql('ALTER TABLE leave_requests ADD CONSTRAINT fk_leave_requests_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL');
        }
        if ($sm->tablesExist(['users']) && !$hasFk('fk_leave_requests_manager')) {
            $this->addSql('ALTER TABLE leave_requests ADD CONSTRAINT fk_leave_requests_manager FOREIGN KEY (manager_id) REFERENCES users (id) ON DELETE SET NULL');
        }

        // Backfill user_id from created_by_api_key (if possible)
        if ($sm->tablesExist(['users']) && $has('created_by_api_key')) {
            $this->addSql('UPDATE leave_requests lr JOIN users u ON u.api_key = lr.created_by_api_key SET lr.user_id = u.id WHERE lr.user_id IS NULL');
        }

        // Backfill type_id from legacy type code (if possible)
        if ($sm->tablesExist(['leave_types']) && $has('type')) {
            $this->addSql('UPDATE leave_requests lr JOIN leave_types t ON t.code = lr.type SET lr.type_id = t.id WHERE lr.type_id IS NULL');
        }
    }

    public function down(Schema $schema): void
    {
        // Non-destructive (dev migration)
    }
}
