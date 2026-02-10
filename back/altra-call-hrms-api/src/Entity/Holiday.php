<?php
namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'holidays')]
class Holiday {
    #[ORM\Id, ORM\GeneratedValue, ORM\Column(type:'integer')]
    private ?int $id=null;

    #[ORM\Column(type:'date')]
    private \DateTimeInterface $date;

    #[ORM\Column(length:120)]
    private string $label;

    public function getId(): ?int { return $this->id; }
    public function getDate(): \DateTimeInterface { return $this->date; }
    public function setDate(\DateTimeInterface $d): self { $this->date=$d; return $this; }
    public function getLabel(): string { return $this->label; }
    public function setLabel(string $l): self { $this->label=$l; return $this; }
}
