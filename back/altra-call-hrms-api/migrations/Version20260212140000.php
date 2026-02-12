<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260212140000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add composite indexes for leave_requests and notifications (performance)';
    }

    public function up(Schema $schema): void
    {
        $sm = $this->connection->createSchemaManager();

        if ($sm->tablesExist(['leave_requests'])) {
            $leaveIdx = array_map(fn($i) => $i->getName(), $sm->listTableIndexes('leave_requests'));
            $hasLeaveIdx = fn(string $name) => in_array($name, $leaveIdx, true);

            if (!$hasLeaveIdx('idx_leave_status')) {
                $this->addSql('CREATE INDEX idx_leave_status ON leave_requests (status)');
            }
            if (!$hasLeaveIdx('idx_leave_user_created_at')) {
                $this->addSql('CREATE INDEX idx_leave_user_created_at ON leave_requests (user_id, created_at)');
            }
            if (!$hasLeaveIdx('idx_leave_manager_status_created_at')) {
                $this->addSql('CREATE INDEX idx_leave_manager_status_created_at ON leave_requests (manager_id, status, created_at)');
            }
        }

        if ($sm->tablesExist(['notifications'])) {
            $notifIdx = array_map(fn($i) => $i->getName(), $sm->listTableIndexes('notifications'));
            $hasNotifIdx = fn(string $name) => in_array($name, $notifIdx, true);

            if (!$hasNotifIdx('idx_notifications_user_created_at')) {
                $this->addSql('CREATE INDEX idx_notifications_user_created_at ON notifications (user_id, created_at)');
            }
            if (!$hasNotifIdx('idx_notifications_user_is_read_created_at')) {
                $this->addSql('CREATE INDEX idx_notifications_user_is_read_created_at ON notifications (user_id, is_read, created_at)');
            }
        }
    }

    public function down(Schema $schema): void
    {
        // non-destructive
    }
}
