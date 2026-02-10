<?php
namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name:'leave_archives')]
class LeaveArchive
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column(type:'integer')]
    private ?int $id=null;

    #[ORM\OneToOne(targetEntity: LeaveRequest::class)]
    #[ORM\JoinColumn(nullable:false, onDelete:'CASCADE')]
    private ?LeaveRequest $leaveRequest=null;

    #[ORM\Column(length:255)]
    private string $path;

    #[ORM\Column(length:64)]
    private string $sha256;

    #[ORM\Column(type:'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    public function __construct(){ $this->createdAt=new \DateTimeImmutable(); }

    public function setLeaveRequest(LeaveRequest $lr): self { $this->leaveRequest=$lr; return $this; }
    public function setPath(string $p): self { $this->path=$p; return $this; }
    public function setSha256(string $h): self { $this->sha256=$h; return $this; }
    public function getPath(): string { return $this->path; }
    public function getSha256(): string { return $this->sha256; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
