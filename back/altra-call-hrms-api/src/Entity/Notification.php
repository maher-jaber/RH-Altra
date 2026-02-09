<?php

namespace App\Entity;

use App\Repository\NotificationRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity(repositoryClass: NotificationRepository::class)]
#[ORM\Table(name: 'notifications')]
class Notification
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid', unique: true)]
    private Uuid $id;

    #[ORM\Column(length: 80)]
    private string $recipientApiKey;

    #[ORM\Column(length: 120)]
    private string $title;

    #[ORM\Column(type: 'text')]
    private string $message;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $readAt = null;

    public function __construct()
    {
        $this->id = Uuid::v7();
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): string { return $this->id->toRfc4122(); }

    public function getRecipientApiKey(): string { return $this->recipientApiKey; }
    public function setRecipientApiKey(string $k): void { $this->recipientApiKey = $k; }

    public function getTitle(): string { return $this->title; }
    public function setTitle(string $t): void { $this->title = $t; }

    public function getMessage(): string { return $this->message; }
    public function setMessage(string $m): void { $this->message = $m; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }

    public function getReadAt(): ?\DateTimeImmutable { return $this->readAt; }
    public function markRead(): void { $this->readAt = new \DateTimeImmutable(); }
}
