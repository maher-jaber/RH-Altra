<?php
namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'leave_audit')]
class LeaveAudit
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type:'integer')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: LeaveRequest::class)]
    #[ORM\JoinColumn(nullable:false, onDelete:'CASCADE')]
    private ?LeaveRequest $leaveRequest = null;

    #[ORM\Column(type:'string', length:50)]
    private string $action;

    #[ORM\Column(type:'string', length:255)]
    private string $actor;

    #[ORM\Column(type:'text', nullable:true)]
    private ?string $comment = null;

    #[ORM\Column(type:'datetime')]
    private \DateTimeInterface $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function setLeaveRequest(LeaveRequest $lr): self { $this->leaveRequest=$lr; return $this; }
    public function setAction(string $a): self { $this->action=$a; return $this; }
    public function setActor(string $a): self { $this->actor=$a; return $this; }
    public function setComment(?string $c): self { $this->comment=$c; return $this; }
    public function getCreatedAt(): \DateTimeInterface { return $this->createdAt; }
}
