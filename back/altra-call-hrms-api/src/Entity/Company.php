<?php
namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name:'companies')]
class Company
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column(type:'integer')]
    private ?int $id = null;

    #[ORM\Column(length:150, unique:true)]
    private string $name;

    #[ORM\Column(length:60, unique:true)]
    private string $code;

    public function getId(): ?int { return $this->id; }
    public function getName(): string { return $this->name; }
    public function setName(string $n): self { $this->name=$n; return $this; }
    public function getCode(): string { return $this->code; }
    public function setCode(string $c): self { $this->code=$c; return $this; }
}
