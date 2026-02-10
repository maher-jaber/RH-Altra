<?php
namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'leave_attachments')]
class LeaveAttachment
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type:'integer')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: LeaveRequest::class)]
    #[ORM\JoinColumn(nullable:false, onDelete:'CASCADE')]
    private ?LeaveRequest $leaveRequest = null;

    #[ORM\Column(type:'string', length:255)]
    private string $path;

    #[ORM\Column(type:'string', length:120)]
    private string $originalName;

    #[ORM\Column(type:'datetime')]
    private \DateTimeInterface $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function getPath(): string { return $this->path; }
    public function setPath(string $p): self { $this->path=$p; return $this; }
    public function getOriginalName(): string { return $this->originalName; }
    public function setOriginalName(string $n): self { $this->originalName=$n; return $this; }
    public function setLeaveRequest(LeaveRequest $lr): self { $this->leaveRequest=$lr; return $this; }
    public function getCreatedAt(): \DateTimeInterface { return $this->createdAt; }
}
