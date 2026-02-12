<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260212095000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add app_settings table for configurable parameters (mail notifications, leave days, work hours)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE app_settings (id INT AUTO_INCREMENT NOT NULL, key_name VARCHAR(190) NOT NULL, value JSON DEFAULT NULL, updated_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\', UNIQUE INDEX UNIQ_APP_SETTINGS_KEY (key_name), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE app_settings');
    }
}
