<?php

namespace App\Repository;

use App\Entity\LeaveRequest;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<LeaveRequest>
 */
class LeaveRequestRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, LeaveRequest::class);
    }

    /** @return LeaveRequest[] */
    public function findByCreator(string $apiKey): array
    {
        return $this->createQueryBuilder('l')
            ->andWhere('l.createdByApiKey = :k')
            ->setParameter('k', $apiKey)
            ->orderBy('l.createdAt', 'DESC')
            ->getQuery()->getResult();
    }
}
