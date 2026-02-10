<?php
declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260209235000 extends AbstractMigration
{
    public function getDescription(): string { return 'Add advances/exits/reports/notifications'; }

    public function up(Schema $schema): void
    {
        $this->addSql("CREATE TABLE IF NOT EXISTS advance_requests (
            id INT AUTO_INCREMENT NOT NULL,
            user_id INT NOT NULL,
            manager_id INT DEFAULT NULL,
            amount DOUBLE PRECISION NOT NULL,
            currency VARCHAR(3) NOT NULL,
            reason LONGTEXT DEFAULT NULL,
            status VARCHAR(30) NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            INDEX IDX_ADV_USER (user_id),
            INDEX IDX_ADV_MGR (manager_id),
            PRIMARY KEY(id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE=InnoDB");

        $this->addSql("CREATE TABLE IF NOT EXISTS exit_permissions (
            id INT AUTO_INCREMENT NOT NULL,
            user_id INT NOT NULL,
            manager_id INT DEFAULT NULL,
            start_at DATETIME NOT NULL,
            end_at DATETIME NOT NULL,
            reason LONGTEXT DEFAULT NULL,
            status VARCHAR(30) NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            INDEX IDX_EXIT_USER (user_id),
            INDEX IDX_EXIT_MGR (manager_id),
            PRIMARY KEY(id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE=InnoDB");

        $this->addSql("CREATE TABLE IF NOT EXISTS daily_reports (
            id INT AUTO_INCREMENT NOT NULL,
            user_id INT NOT NULL,
            day DATE NOT NULL,
            content LONGTEXT NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            UNIQUE INDEX uniq_report_user_day (user_id, day),
            INDEX IDX_REPORT_USER (user_id),
            PRIMARY KEY(id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE=InnoDB");

        $this->addSql("CREATE TABLE IF NOT EXISTS notifications (
            id INT AUTO_INCREMENT NOT NULL,
            user_id INT NOT NULL,
            title VARCHAR(120) NOT NULL,
            body LONGTEXT DEFAULT NULL,
            type VARCHAR(60) NOT NULL,
            is_read TINYINT(1) NOT NULL,
            created_at DATETIME NOT NULL,
            INDEX IDX_NOTIF_USER (user_id),
            PRIMARY KEY(id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE=InnoDB");
    }

    public function down(Schema $schema): void {}
}
