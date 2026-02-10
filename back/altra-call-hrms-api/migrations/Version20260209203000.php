<?php
declare(strict_types=1);
namespace DoctrineMigrations;
use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260209203000 extends AbstractMigration {
    public function getDescription(): string {
        return 'Holidays table for working days calculation';
    }
    public function up(Schema $schema): void {
        $this->addSql("
            CREATE TABLE holidays (
                id INT AUTO_INCREMENT NOT NULL,
                date DATE NOT NULL,
                label VARCHAR(120) NOT NULL,
                UNIQUE INDEX uniq_holidays_date (date),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        ");
    }
    public function down(Schema $schema): void {
        $this->addSql("DROP TABLE holidays");
    }
}
