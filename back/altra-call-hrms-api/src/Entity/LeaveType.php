<?php
namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'leave_types')]
class LeaveType
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\Column(length: 80, unique: true)]
    private string $code;

    #[ORM\Column(length: 120)]
    private string $label;

    #[ORM\Column(type: 'float')]
    private float $annualAllowance = 0.0;

    #[ORM\Column(type: 'boolean')]
    private bool $requiresCertificate = false;

    public function getId(): ?int { return $this->id; }
    public function getCode(): string { return $this->code; }
    public function setCode(string $code): self { $this->code = $code; return $this; }
    public function getLabel(): string { return $this->label; }
    public function setLabel(string $label): self { $this->label = $label; return $this; }
    public function getAnnualAllowance(): float { return $this->annualAllowance; }
    public function setAnnualAllowance(float $a): self { $this->annualAllowance = $a; return $this; }
    public function getRequiresCertificate(): bool { return $this->requiresCertificate; }
    public function setRequiresCertificate(bool $v): self { $this->requiresCertificate = $v; return $this; }
}
