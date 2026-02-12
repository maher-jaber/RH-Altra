<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260211120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add action_url and payload to notifications for rich in-app + email navigation';
    }

    public function up(Schema $schema): void
    {
        // MySQL
        $this->addSql("ALTER TABLE notifications ADD action_url VARCHAR(255) DEFAULT NULL, ADD payload JSON DEFAULT NULL");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE notifications DROP action_url, DROP payload');
    }
}
