<?php
namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name:'notifications')]
class Notification
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column(type:'integer')]
    private ?int $id=null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable:false, onDelete:'CASCADE')]
    private ?User $user=null;

    #[ORM\Column(type:'string', length:120)]
    private string $title='';

    #[ORM\Column(type:'text', nullable:true)]
    private ?string $body=null;

    #[ORM\Column(type:'string', length:60)]
    private string $type='INFO';

    #[ORM\Column(type:'boolean')]
    private bool $isRead=false;


    #[ORM\Column(type:'string', length:255, nullable:true)]
    private ?string $actionUrl = null;

    #[ORM\Column(type:'json', nullable:true)]
    private ?array $payload = null;

    #[ORM\Column(type:'datetime')]
    private \DateTimeInterface $createdAt;

    public function __construct(){ $this->createdAt=new \DateTimeImmutable(); }

    public function getId(): ?int { return $this->id; }
    public function setUser(User $u): self { $this->user=$u; return $this; }
    public function getUser(): ?User { return $this->user; }
    public function setTitle(string $t): self { $this->title=$t; return $this; }
    public function getTitle(): string { return $this->title; }
    public function setBody(?string $b): self { $this->body=$b; return $this; }
    public function getBody(): ?string { return $this->body; }
    public function setType(string $t): self { $this->type=$t; return $this; }
    public function getType(): string { return $this->type; }
    public function markRead(): self { $this->isRead=true; return $this; }
    public function isRead(): bool { return $this->isRead; }


    public function setActionUrl(?string $url): self { $this->actionUrl = $url; return $this; }
    public function getActionUrl(): ?string { return $this->actionUrl; }

    public function setPayload(?array $payload): self { $this->payload = $payload; return $this; }
    public function getPayload(): ?array { return $this->payload; }

    public function getCreatedAt(): \DateTimeInterface { return $this->createdAt; }
}
