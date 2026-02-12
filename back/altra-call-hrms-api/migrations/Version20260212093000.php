<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Notifications: add action_url + payload (rich notifications).
 */
final class Version20260212093000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Notifications: add action_url and payload fields';
    }

    public function up(Schema $schema): void
    {
        $sm = $this->connection->createSchemaManager();

        if (!$sm->tablesExist(['notifications'])) {
            return;
        }

        $cols = $sm->listTableColumns('notifications');
        $has = fn(string $c) => array_key_exists($c, $cols);

        if (!$has('action_url')) {
            $this->addSql("ALTER TABLE notifications ADD action_url VARCHAR(255) DEFAULT NULL");
        }
        if (!$has('payload')) {
            $this->addSql("ALTER TABLE notifications ADD payload JSON DEFAULT NULL");
        }
    }

    public function down(Schema $schema): void
    {
        // Non-destructive in dev.
    }
}
