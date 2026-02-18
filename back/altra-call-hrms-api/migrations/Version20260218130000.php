<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260218130000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add contract_type to users';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE users ADD contract_type VARCHAR(30) NOT NULL DEFAULT 'CDI'");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE users DROP contract_type');
    }
}
