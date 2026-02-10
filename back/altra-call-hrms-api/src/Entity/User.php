<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use App\Entity\Department;
use App\Entity\Company;

#[ORM\Entity]
#[ORM\Table(name: 'users')]
#[ORM\UniqueConstraint(name: 'uniq_users_email', columns: ['email'])]
#[ORM\UniqueConstraint(name: 'uniq_users_api_key', columns: ['api_key'])]
class User
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\Column(type: 'string', length: 180)]
    private string $email;

    #[ORM\Column(name: 'password_hash', type: 'string', length: 255)]
    private string $passwordHash;

    #[ORM\Column(type: 'json')]
    private array $roles = [];

    #[ORM\Column(name: 'api_key', type: 'string', length: 80)]
    private string $apiKey;

    #[ORM\Column(name: 'full_name', type: 'string', length: 120, nullable: true)]
    private ?string $fullName = null;

    #[ORM\ManyToOne(targetEntity: Company::class)]
    #[ORM\JoinColumn(name:'company_id', referencedColumnName:'id', nullable:true, onDelete:'SET NULL')]
    private ?Company $company = null;


#[ORM\ManyToOne(targetEntity: Department::class)]
#[ORM\JoinColumn(name: 'department_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
private ?Department $department = null;

#[ORM\ManyToOne(targetEntity: self::class)]
#[ORM\JoinColumn(name: 'manager_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
private ?self $manager = null;

#[ORM\ManyToOne(targetEntity: self::class)]
#[ORM\JoinColumn(name: 'manager2_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
private ?self $manager2 = null;

    #[ORM\Column(name: 'created_at', type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function getEmail(): string { return $this->email; }
    public function setEmail(string $email): self { $this->email = strtolower(trim($email)); return $this; }

    public function getPasswordHash(): string { return $this->passwordHash; }
    public function setPasswordHash(string $hash): self { $this->passwordHash = $hash; return $this; }

    public function getRoles(): array { return $this->roles; }
    public function setRoles(array $roles): self { $this->roles = array_values(array_unique($roles)); return $this; }

    public function getApiKey(): string { return $this->apiKey; }
    public function setApiKey(string $apiKey): self { $this->apiKey = $apiKey; return $this; }

    public function getFullName(): ?string { return $this->fullName; }
    public function setFullName(?string $fullName): self { $this->fullName = $fullName; return $this; }

    public function getCompany(): ?Company { return $this->company; }
    public function setCompany(?Company $c): self { $this->company=$c; return $this; }


public function getDepartment(): ?Department { return $this->department; }
public function setDepartment(?Department $department): self { $this->department = $department; return $this; }

public function getManager(): ?self { return $this->manager; }
public function setManager(?self $manager): self { $this->manager = $manager; return $this; }

public function getManager2(): ?self { return $this->manager2; }
public function setManager2(?self $manager2): self { $this->manager2 = $manager2; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
