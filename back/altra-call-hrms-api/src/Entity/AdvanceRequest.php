<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'advance_requests')]
class AdvanceRequest
{
    public const STATUS_DRAFT = 'DRAFT';
    public const STATUS_SUBMITTED = 'SUBMITTED';
    /** One manager signed, waiting for the second manager (when manager2 exists). */
    public const STATUS_MANAGER_APPROVED = 'MANAGER_APPROVED';
    public const STATUS_APPROVED = 'APPROVED';
    public const STATUS_REJECTED = 'REJECTED';

    #[ORM\Id, ORM\GeneratedValue, ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?User $user = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $manager = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'manager2_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?User $manager2 = null;

    #[ORM\Column(name: 'manager_comment', type: 'text', nullable: true)]
    private ?string $managerComment = null;

    #[ORM\Column(name: 'manager2_comment', type: 'text', nullable: true)]
    private ?string $manager2Comment = null;

    #[ORM\Column(name: 'manager_signed_at', type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $managerSignedAt = null;

    #[ORM\Column(name: 'manager2_signed_at', type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $manager2SignedAt = null;

    #[ORM\Column(type: 'float')]
    private float $amount = 0;

    #[ORM\Column(type: 'string', length: 3)]
    private string $currency = 'TND';

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $reason = null;

    #[ORM\Column(type: 'string', length: 30)]
    private string $status = self::STATUS_DRAFT;

    #[ORM\Column(name: 'period_year', type: 'integer')]
    private int $periodYear;

    #[ORM\Column(name: 'period_month', type: 'integer')]
    private int $periodMonth;

    #[ORM\Column(type: 'datetime')]
    private \DateTimeInterface $createdAt;

    #[ORM\Column(type: 'datetime')]
    private \DateTimeInterface $updatedAt;

    public function __construct()
    {
        $now = new \DateTimeImmutable();
        $this->createdAt = $now;
        $this->updatedAt = $now;
        $this->periodYear = (int)$now->format('Y');
        $this->periodMonth = (int)$now->format('n');
    }

    public function getId(): ?int { return $this->id; }

    public function getUser(): ?User { return $this->user; }
    public function setUser(User $u): self { $this->user = $u; return $this; }

    public function getManager(): ?User { return $this->manager; }
    public function setManager(?User $m): self { $this->manager = $m; return $this; }

    public function getManager2(): ?User { return $this->manager2; }
    public function setManager2(?User $m): self { $this->manager2 = $m; return $this; }

    public function getManagerComment(): ?string { return $this->managerComment; }
    public function setManagerComment(?string $c): self { $this->managerComment = $c; return $this; }

    public function getManager2Comment(): ?string { return $this->manager2Comment; }
    public function setManager2Comment(?string $c): self { $this->manager2Comment = $c; return $this; }

    public function getManagerSignedAt(): ?\DateTimeImmutable { return $this->managerSignedAt; }
    public function setManagerSignedAt(?\DateTimeImmutable $d): self { $this->managerSignedAt = $d; return $this; }

    public function getManager2SignedAt(): ?\DateTimeImmutable { return $this->manager2SignedAt; }
    public function setManager2SignedAt(?\DateTimeImmutable $d): self { $this->manager2SignedAt = $d; return $this; }

    public function getAmount(): float { return $this->amount; }
    public function setAmount(float $a): self { $this->amount = $a; return $this; }

    public function getCurrency(): string { return $this->currency; }
    public function setCurrency(string $c): self { $this->currency = $c; return $this; }

    public function getReason(): ?string { return $this->reason; }
    public function setReason(?string $r): self { $this->reason = $r; return $this; }

    public function getStatus(): string { return $this->status; }
    public function setStatus(string $s): self { $this->status = $s; return $this; }

    public function getPeriodYear(): int { return $this->periodYear; }
    public function setPeriodYear(int $y): self { $this->periodYear = $y; return $this; }

    public function getPeriodMonth(): int { return $this->periodMonth; }
    public function setPeriodMonth(int $m): self { $this->periodMonth = $m; return $this; }

    public function setPeriod(int $year, int $month): self { $this->periodYear = $year; $this->periodMonth = $month; return $this; }

    public function touch(): void { $this->updatedAt = new \DateTimeImmutable(); }

    public function getCreatedAt(): \DateTimeInterface { return $this->createdAt; }
    public function getUpdatedAt(): \DateTimeInterface { return $this->updatedAt; }

    public function needsSecondManagerApproval(): bool
    {
        return $this->manager2 !== null;
    }

    public function isFullyApproved(): bool
    {
        if ($this->status === self::STATUS_REJECTED) return false;
        if ($this->manager !== null && $this->managerSignedAt === null) return false;
        if ($this->manager2 !== null && $this->manager2SignedAt === null) return false;
        return true;
    }
}
