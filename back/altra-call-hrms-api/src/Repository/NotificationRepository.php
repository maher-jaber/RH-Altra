<?php

namespace App\Repository;

use App\Entity\Notification;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Notification>
 */
class NotificationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Notification::class);
    }

    /** @return Notification[] */
    public function findForRecipient(string $apiKey): array
    {
        return $this->createQueryBuilder('n')
            ->andWhere('n.recipientApiKey = :k')
            ->setParameter('k', $apiKey)
            ->orderBy('n.createdAt', 'DESC')
            ->getQuery()->getResult();
    }
}
