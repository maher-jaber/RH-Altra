<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'app_settings')]
class AppSetting
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\Column(type: 'string', length: 190, unique: true)]
    private string $keyName;

    #[ORM\Column(type: 'json', nullable: true)]
    private $value = null;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $updatedAt;

    public function __construct()
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }

    public function getKeyName(): string { return $this->keyName; }
    public function setKeyName(string $k): self { $this->keyName = $k; return $this; }

    public function getValue() { return $this->value; }
    public function setValue($v): self { $this->value = $v; $this->updatedAt = new \DateTimeImmutable(); return $this; }

    public function getUpdatedAt(): \DateTimeImmutable { return $this->updatedAt; }
}
