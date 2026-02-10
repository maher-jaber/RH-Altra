<?php
namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name:'daily_reports')]
class DailyReport
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column(type:'integer')]
    private ?int $id=null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable:false, onDelete:'CASCADE')]
    private ?User $user=null;

    #[ORM\Column(type:'date')]
    private \DateTimeInterface $day;

    #[ORM\Column(type:'text')]
    private string $content='';

    #[ORM\Column(type:'datetime')]
    private \DateTimeInterface $createdAt;

    #[ORM\Column(type:'datetime')]
    private \DateTimeInterface $updatedAt;

    public function __construct(){
        $this->createdAt=new \DateTimeImmutable();
        $this->updatedAt=new \DateTimeImmutable();
        $this->day=new \DateTimeImmutable(date('Y-m-d'));
    }

    public function getId(): ?int { return $this->id; }
    public function setUser(User $u): self { $this->user=$u; return $this; }
    public function getUser(): ?User { return $this->user; }
    public function getDay(): \DateTimeInterface { return $this->day; }
    public function setDay(\DateTimeInterface $d): self { $this->day=$d; return $this; }
    public function getContent(): string { return $this->content; }
    public function setContent(string $c): self { $this->content=$c; return $this; }
    public function touch(): void { $this->updatedAt=new \DateTimeImmutable(); }
}
