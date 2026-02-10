<?php

namespace App\Entity;

use App\Repository\LeaveRequestRepository;
use Doctrine\ORM\Mapping as ORM;
use App\Entity\LeaveType;
use App\Entity\User;
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

    #[ORM\Id]
    #[ORM\Column(type: 'uuid', unique: true)]
    private Uuid $id;

    #[ORM\Column(length: 20)]
    private string $type;

    #[ORM\Column(type: 'date_immutable')]
    private \DateTimeImmutable $startDate;

    #[ORM\Column(type: 'date_immutable')]
    private \DateTimeImmutable $endDate;

    #[ORM\Column(length: 2, nullable: true)]
    private ?string $halfDay = null; // AM/PM

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $reason = null;

    #[ORM\Column(length: 20)]
    private string $status = 'DRAFT';

    #[ORM\Column(length: 80)]
    private string $createdByApiKey;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->id = Uuid::v7();
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): string { return $this->id->toRfc4122(); }

    public function getType(): string { return $this->type; }
    public function setType(string $type): void { $this->type = $type; }

    public function getStartDate(): \DateTimeImmutable { return $this->startDate; }
    public function setStartDate(\DateTimeImmutable $d): void { $this->startDate = $d; }

    public function getEndDate(): \DateTimeImmutable { return $this->endDate; }
    public function setEndDate(\DateTimeImmutable $d): void { $this->endDate = $d; }

    public function getHalfDay(): ?string { return $this->halfDay; }
    public function setHalfDay(?string $v): void { $this->halfDay = $v; }

    public function getReason(): ?string { return $this->reason; }
    public function setReason(?string $v): void { $this->reason = $v; }

    // Workflow uses method store on status
    public function getStatus(): string { return $this->status; }
    public function setStatus(string $status): void { $this->status = $status; }

    public function getCreatedByApiKey(): string { return $this->createdByApiKey; }
    public function setCreatedByApiKey(string $k): void { $this->createdByApiKey = $k; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }


    public function getDaysCount(): float { return $this->daysCount; }
    public function setDaysCount(float $d): self { $this->daysCount=$d; return $this; }
    public function getNote(): ?string { return $this->note; }
    public function setNote(?string $n): self { $this->note=$n; return $this; }
    public function getCertificatePath(): ?string { return $this->certificatePath; }
    public function setCertificatePath(?string $p): self { $this->certificatePath=$p; return $this; }


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
