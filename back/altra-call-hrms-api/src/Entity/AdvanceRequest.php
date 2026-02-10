<?php
namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name:'advance_requests')]
class AdvanceRequest
{
    public const STATUS_DRAFT='DRAFT';
    public const STATUS_SUBMITTED='SUBMITTED';
    public const STATUS_APPROVED='APPROVED';
    public const STATUS_REJECTED='REJECTED';

    #[ORM\Id, ORM\GeneratedValue, ORM\Column(type:'integer')]
    private ?int $id=null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable:false, onDelete:'CASCADE')]
    private ?User $user=null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable:true, onDelete:'SET NULL')]
    private ?User $manager=null;

    #[ORM\Column(type:'float')]
    private float $amount=0;

    #[ORM\Column(type:'string', length:3)]
    private string $currency='TND';

    #[ORM\Column(type:'text', nullable:true)]
    private ?string $reason=null;

    #[ORM\Column(type:'string', length:30)]
    private string $status=self::STATUS_DRAFT;

    #[ORM\Column(type:'datetime')]
    private \DateTimeInterface $createdAt;

    #[ORM\Column(type:'datetime')]
    private \DateTimeInterface $updatedAt;

    public function __construct(){
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function getUser(): ?User { return $this->user; }
    public function setUser(User $u): self { $this->user=$u; return $this; }
    public function getManager(): ?User { return $this->manager; }
    public function setManager(?User $m): self { $this->manager=$m; return $this; }
    public function getAmount(): float { return $this->amount; }
    public function setAmount(float $a): self { $this->amount=$a; return $this; }
    public function getCurrency(): string { return $this->currency; }
    public function setCurrency(string $c): self { $this->currency=$c; return $this; }
    public function getReason(): ?string { return $this->reason; }
    public function setReason(?string $r): self { $this->reason=$r; return $this; }
    public function getStatus(): string { return $this->status; }
    public function setStatus(string $s): self { $this->status=$s; return $this; }
    public function touch(): void { $this->updatedAt = new \DateTimeImmutable(); }

public function getCreatedAt(): \DateTimeInterface { return $this->createdAt; }
    public function getUpdatedAt(): \DateTimeInterface { return $this->updatedAt; }
}
