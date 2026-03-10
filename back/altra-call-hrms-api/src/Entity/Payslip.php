<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use DateTimeImmutable;

#[ORM\Entity]
#[ORM\Table(name: 'payslips')]
#[ORM\Index(name: 'idx_payslips_user_month', columns: ['user_id', 'period_month'])]
#[ORM\Index(name: 'idx_payslips_month', columns: ['period_month'])]
class Payslip
{
    public const STATUS_UNMATCHED = 'UNMATCHED';
    public const STATUS_AUTO = 'AUTO';
    public const STATUS_PROBABLE = 'PROBABLE';
    public const STATUS_AMBIGUOUS = 'AMBIGUOUS';
    public const STATUS_MANUAL = 'MANUAL';
    public const STATUS_PUBLISHED = 'PUBLISHED';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?User $user = null;

    #[ORM\Column(name: 'period_month', type: 'string', length: 7)]
    private string $periodMonth; // YYYY-MM

    #[ORM\Column(name: 'original_filename', type: 'string', length: 255)]
    private string $originalFilename;

    #[ORM\Column(name: 'stored_filename', type: 'string', length: 255)]
    private string $storedFilename;

    #[ORM\Column(name: 'match_score', type: 'float', nullable: true)]
    private ?float $matchScore = null;

    #[ORM\Column(name: 'match_method', type: 'string', length: 30, nullable: true)]
    private ?string $matchMethod = null;

    #[ORM\Column(type: 'string', length: 20)]
    private string $status = self::STATUS_UNMATCHED;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'uploaded_by_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?User $uploadedBy = null;

    #[ORM\Column(name: 'uploaded_at', type: 'datetime_immutable')]
    private DateTimeImmutable $uploadedAt;

    #[ORM\Column(name: 'published_at', type: 'datetime_immutable', nullable: true)]
    private ?DateTimeImmutable $publishedAt = null;

    public function __construct()
    {
        $this->uploadedAt = new DateTimeImmutable();
        $this->periodMonth = (new DateTimeImmutable())->format('Y-m');
        $this->originalFilename = '';
        $this->storedFilename = '';
    }

    public function getId(): ?int { return $this->id; }

    public function getUser(): ?User { return $this->user; }
    public function setUser(?User $u): self { $this->user = $u; return $this; }

    public function getPeriodMonth(): string { return $this->periodMonth; }
    public function setPeriodMonth(string $v): self { $this->periodMonth = $v; return $this; }

    public function getOriginalFilename(): string { return $this->originalFilename; }
    public function setOriginalFilename(string $v): self { $this->originalFilename = $v; return $this; }

    public function getStoredFilename(): string { return $this->storedFilename; }
    public function setStoredFilename(string $v): self { $this->storedFilename = $v; return $this; }

    public function getMatchScore(): ?float { return $this->matchScore; }
    public function setMatchScore(?float $v): self { $this->matchScore = $v; return $this; }

    public function getMatchMethod(): ?string { return $this->matchMethod; }
    public function setMatchMethod(?string $v): self { $this->matchMethod = $v; return $this; }

    public function getStatus(): string { return $this->status; }
    public function setStatus(string $v): self { $this->status = $v; return $this; }

    public function getUploadedBy(): ?User { return $this->uploadedBy; }
    public function setUploadedBy(?User $u): self { $this->uploadedBy = $u; return $this; }

    public function getUploadedAt(): DateTimeImmutable { return $this->uploadedAt; }
    public function setUploadedAt(DateTimeImmutable $d): self { $this->uploadedAt = $d; return $this; }

    public function getPublishedAt(): ?DateTimeImmutable { return $this->publishedAt; }
    public function setPublishedAt(?DateTimeImmutable $d): self { $this->publishedAt = $d; return $this; }

    public function isPublished(): bool { return $this->publishedAt !== null && $this->status === self::STATUS_PUBLISHED; }
}
