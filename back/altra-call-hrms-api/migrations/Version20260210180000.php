<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260210180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Fix legacy notifications schema (drop & recreate if old columns exist)';
    }

    public function up(Schema $schema): void
    {
        $sm = $this->connection->createSchemaManager();

        // If table doesn't exist, just create it.
        if (!$sm->tablesExist(['notifications'])) {
            $this->createNotificationsTable();
            return;
        }

        $cols = $sm->listTableColumns('notifications');
        $has = fn(string $c) => array_key_exists($c, $cols);

        // Legacy schema used recipient_api_key/message/read_at.
        if ($has('recipient_api_key') || $has('message') || $has('read_at')) {
            $this->addSql('DROP TABLE notifications');
            $this->createNotificationsTable();
        }
    }

    private function createNotificationsTable(): void
    {
        $this->addSql(
            "CREATE TABLE notifications (
                id INT AUTO_INCREMENT NOT NULL,
                user_id INT NOT NULL,
                title VARCHAR(180) NOT NULL,
                body LONGTEXT NOT NULL,
                type VARCHAR(60) NOT NULL,
                is_read TINYINT(1) NOT NULL,
                created_at DATETIME NOT NULL,
                INDEX idx_notifications_user (user_id),
                INDEX idx_notifications_is_read (is_read),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB"
        );
    }

    public function down(Schema $schema): void
    {
        // non-destructive
    }
}
