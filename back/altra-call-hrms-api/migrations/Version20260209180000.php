<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260209180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Departments + hierarchy fields on users (department, manager, manager2)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("
            CREATE TABLE departments (
                id INT AUTO_INCREMENT NOT NULL,
                name VARCHAR(150) NOT NULL,
                UNIQUE INDEX uniq_departments_name (name),
                PRIMARY KEY(id)
            ) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB
        ");

        $this->addSql("ALTER TABLE users ADD department_id INT DEFAULT NULL, ADD manager_id INT DEFAULT NULL, ADD manager2_id INT DEFAULT NULL");
        $this->addSql("CREATE INDEX idx_users_department ON users (department_id)");
        $this->addSql("CREATE INDEX idx_users_manager ON users (manager_id)");
        $this->addSql("CREATE INDEX idx_users_manager2 ON users (manager2_id)");

        $this->addSql("ALTER TABLE users ADD CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE SET NULL");
        $this->addSql("ALTER TABLE users ADD CONSTRAINT fk_users_manager FOREIGN KEY (manager_id) REFERENCES users (id) ON DELETE SET NULL");
        $this->addSql("ALTER TABLE users ADD CONSTRAINT fk_users_manager2 FOREIGN KEY (manager2_id) REFERENCES users (id) ON DELETE SET NULL");
    }

    public function down(Schema $schema): void
    {
        $this->addSql("ALTER TABLE users DROP FOREIGN KEY fk_users_department");
        $this->addSql("ALTER TABLE users DROP FOREIGN KEY fk_users_manager");
        $this->addSql("ALTER TABLE users DROP FOREIGN KEY fk_users_manager2");

        $this->addSql("ALTER TABLE users DROP COLUMN department_id, DROP COLUMN manager_id, DROP COLUMN manager2_id");
        $this->addSql("DROP TABLE departments");
    }
}
