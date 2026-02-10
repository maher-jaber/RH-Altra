<?php
namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use App\Entity\Company;

#[ORM\Entity]
class Department {

    #[ORM\Id, ORM\GeneratedValue, ORM\Column(type:"integer")]
    private ?int $id = null;

    #[ORM\Column(length:150, unique:true)]
    private string $name;

    #[ORM\ManyToOne(targetEntity: Company::class)]
    #[ORM\JoinColumn(name:'company_id', referencedColumnName:'id', nullable:true, onDelete:'SET NULL')]
    private ?Company $company = null;

    public function getId(): ?int { return $this->id; }
    public function getName(): string { return $this->name; }
    public function setName(string $name): void { $this->name = $name; }


    public function getCompany(): ?Company { return $this->company; }
    public function setCompany(?Company $c): self { $this->company=$c; return $this; }
}
