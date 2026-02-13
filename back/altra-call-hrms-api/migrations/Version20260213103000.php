<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260213103000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add dual-manager approval fields to advance_requests and exit_permissions.';
    }

    public function up(Schema $schema): void
    {
        // advance_requests
        $this->addSql('ALTER TABLE advance_requests ADD manager2_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE advance_requests ADD manager_comment LONGTEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE advance_requests ADD manager2_comment LONGTEXT DEFAULT NULL');
        $this->addSql("ALTER TABLE advance_requests ADD manager_signed_at DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)'");
        $this->addSql("ALTER TABLE advance_requests ADD manager2_signed_at DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)'");
        $this->addSql('ALTER TABLE advance_requests ADD CONSTRAINT FK_ADVANCE_MANAGER2 FOREIGN KEY (manager2_id) REFERENCES users (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_ADVANCE_MANAGER2 ON advance_requests (manager2_id)');

        // exit_permissions
        $this->addSql('ALTER TABLE exit_permissions ADD manager2_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE exit_permissions ADD manager_comment LONGTEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE exit_permissions ADD manager2_comment LONGTEXT DEFAULT NULL');
        $this->addSql("ALTER TABLE exit_permissions ADD manager_signed_at DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)'");
        $this->addSql("ALTER TABLE exit_permissions ADD manager2_signed_at DATETIME DEFAULT NULL COMMENT '(DC2Type:datetime_immutable)'");
        $this->addSql('ALTER TABLE exit_permissions ADD CONSTRAINT FK_EXIT_MANAGER2 FOREIGN KEY (manager2_id) REFERENCES users (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_EXIT_MANAGER2 ON exit_permissions (manager2_id)');
    }

    public function down(Schema $schema): void
    {
        // advance_requests
        $this->addSql('ALTER TABLE advance_requests DROP FOREIGN KEY FK_ADVANCE_MANAGER2');
        $this->addSql('DROP INDEX IDX_ADVANCE_MANAGER2 ON advance_requests');
        $this->addSql('ALTER TABLE advance_requests DROP manager2_id, DROP manager_comment, DROP manager2_comment, DROP manager_signed_at, DROP manager2_signed_at');

        // exit_permissions
        $this->addSql('ALTER TABLE exit_permissions DROP FOREIGN KEY FK_EXIT_MANAGER2');
        $this->addSql('DROP INDEX IDX_EXIT_MANAGER2 ON exit_permissions');
        $this->addSql('ALTER TABLE exit_permissions DROP manager2_id, DROP manager_comment, DROP manager2_comment, DROP manager_signed_at, DROP manager2_signed_at');
    }
}
