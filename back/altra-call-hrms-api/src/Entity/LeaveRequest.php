<?php

namespace App\Entity;

use App\Repository\LeaveRequestRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity(repositoryClass: LeaveRequestRepository::class)]
#[ORM\Table(name: 'leave_requests')]
class LeaveRequest
{
    public const STATUS_DRAFT='DRAFT';
    public const STATUS_SUBMITTED='SUBMITTED';
    public const STATUS_MANAGER_APPROVED='MANAGER_APPROVED';
    public const STATUS_HR_APPROVED='HR_APPROVED';
    public const STATUS_REJECTED='REJECTED';
    public const STATUS_CANCELLED='CANCELLED';

    #[ORM\Id]
    #[ORM\Column(type: 'guid', unique: true)]
    private string $id;

    /**
     * Legacy type code (column: type). Kept for backward compatibility and easy reporting.
     * The UI uses LeaveType entity via $type.
     */
    #[ORM\Column(name: 'type', length: 80)]
    private string $typeCode = 'ANNUAL';

    #[ORM\ManyToOne(targetEntity: LeaveType::class)]
    #[ORM\JoinColumn(name: 'type_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?LeaveType $type = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?User $user = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'manager_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?User $manager = null;

    #[ORM\Column(name: 'start_date', type: 'date_immutable')]
    private ?\DateTimeImmutable $startDate = null;

    #[ORM\Column(name: 'end_date', type: 'date_immutable')]
    private ?\DateTimeImmutable $endDate = null;

    #[ORM\Column(name: 'days_count', type: 'float')]
    private float $daysCount = 0.0;

    #[ORM\Column(length: 2, nullable: true)]
    private ?string $halfDay = null; // AM/PM

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $reason = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $note = null;

    #[ORM\Column(name: 'certificate_path', length: 255, nullable: true)]
    private ?string $certificatePath = null;

    #[ORM\Column(length: 20)]
    private string $status = self::STATUS_DRAFT;

    #[ORM\Column(name: 'created_by_api_key', length: 80, nullable: true)]
    private ?string $createdByApiKey = null;

    #[ORM\Column(name: 'created_at', type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(name: 'manager_comment', type: 'text', nullable: true)]
    private ?string $managerComment = null;

    #[ORM\Column(name: 'hr_comment', type: 'text', nullable: true)]
    private ?string $hrComment = null;

    #[ORM\Column(name: 'manager_signed_at', type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $managerSignedAt = null;

    #[ORM\Column(name: 'hr_signed_at', type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $hrSignedAt = null;

    #[ORM\Column(name: 'manager_signature', type: 'text', nullable: true)]
    private ?string $managerSignature = null;

    #[ORM\Column(name: 'hr_signature', type: 'text', nullable: true)]
    private ?string $hrSignature = null;

    #[ORM\Column(name: 'manager_signer_name', length: 120, nullable: true)]
    private ?string $managerSignerName = null;

    #[ORM\Column(name: 'hr_signer_name', length: 120, nullable: true)]
    private ?string $hrSignerName = null;

    public function __construct()
    {
        $this->id = Uuid::v7()->toRfc4122();
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): string { return $this->id; }

    // --- Type (LeaveType) ---
    public function getType(): ?LeaveType { return $this->type; }
    public function setType(?LeaveType $type): self
    {
        $this->type = $type;
        if ($type) { $this->typeCode = $type->getCode(); }
        return $this;
    }

    // --- Legacy type code ---
    public function getTypeCode(): string { return $this->typeCode; }
    public function setTypeCode(string $code): self { $this->typeCode = $code; return $this; }

    // --- User / manager ---
    public function getUser(): ?User { return $this->user; }
    public function setUser(?User $u): self { $this->user=$u; return $this; }
    public function getManager(): ?User { return $this->manager; }
    public function setManager(?User $m): self { $this->manager=$m; return $this; }

    // --- Dates / days ---
    public function getStartDate(): ?\DateTimeImmutable { return $this->startDate; }
    public function setStartDate(?\DateTimeImmutable $d): self { $this->startDate=$d; return $this; }
    public function getEndDate(): ?\DateTimeImmutable { return $this->endDate; }
    public function setEndDate(?\DateTimeImmutable $d): self { $this->endDate=$d; return $this; }
    public function getDaysCount(): float { return $this->daysCount; }
    public function setDaysCount(float $d): self { $this->daysCount=$d; return $this; }

    public function getHalfDay(): ?string { return $this->halfDay; }
    public function setHalfDay(?string $v): self { $this->halfDay=$v; return $this; }
    public function getReason(): ?string { return $this->reason; }
    public function setReason(?string $v): self { $this->reason=$v; return $this; }

    // --- Note / certificate ---
    public function getNote(): ?string { return $this->note; }
    public function setNote(?string $n): self { $this->note=$n; return $this; }
    public function getCertificatePath(): ?string { return $this->certificatePath; }
    public function setCertificatePath(?string $p): self { $this->certificatePath=$p; return $this; }

    // --- Status / audit ---
    public function getStatus(): string { return $this->status; }
    public function setStatus(string $status): self { $this->status=$status; return $this; }

    public function getCreatedByApiKey(): ?string { return $this->createdByApiKey; }
    public function setCreatedByApiKey(?string $k): self { $this->createdByApiKey=$k; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }

    public function getManagerComment(): ?string { return $this->managerComment; }
    public function setManagerComment(?string $c): self { $this->managerComment=$c; return $this; }
    public function getHrComment(): ?string { return $this->hrComment; }
    public function setHrComment(?string $c): self { $this->hrComment=$c; return $this; }

    // --- Signatures ---
    public function getManagerSignedAt(): ?\DateTimeImmutable { return $this->managerSignedAt; }
    public function setManagerSignedAt(?\DateTimeImmutable $d): self { $this->managerSignedAt=$d; return $this; }
    public function getHrSignedAt(): ?\DateTimeImmutable { return $this->hrSignedAt; }
    public function setHrSignedAt(?\DateTimeImmutable $d): self { $this->hrSignedAt=$d; return $this; }

    public function getManagerSignature(): ?string { return $this->managerSignature; }
    public function setManagerSignature(?string $s): self { $this->managerSignature=$s; return $this; }
    public function getHrSignature(): ?string { return $this->hrSignature; }
    public function setHrSignature(?string $s): self { $this->hrSignature=$s; return $this; }

    public function getManagerSignerName(): ?string { return $this->managerSignerName; }
    public function setManagerSignerName(?string $n): self { $this->managerSignerName=$n; return $this; }
    public function getHrSignerName(): ?string { return $this->hrSignerName; }
    public function setHrSignerName(?string $n): self { $this->hrSignerName=$n; return $this; }
}
