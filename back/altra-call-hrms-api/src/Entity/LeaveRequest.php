<?php

namespace App\Entity;

use App\Repository\LeaveRequestRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity(repositoryClass: LeaveRequestRepository::class)]
#[ORM\Table(name: 'leave_requests')]
class LeaveRequest
{
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
}
