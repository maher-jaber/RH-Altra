<?php
namespace App\Service;

use App\Entity\Holiday;
use Doctrine\ORM\EntityManagerInterface;

class WorkingDaysService {
    public function __construct(private EntityManagerInterface $em){}

    public function countWorkingDays(\DateTimeInterface $start, \DateTimeInterface $end): int {
        if ($end < $start) return 0;

        $holidays = array_map(
            fn($h)=>$h->getDate()->format('Y-m-d'),
            $this->em->getRepository(Holiday::class)->findAll()
        );

        $days = 0;
        $d = new \DateTimeImmutable($start->format('Y-m-d'));
        $endD = new \DateTimeImmutable($end->format('Y-m-d'));

        while ($d <= $endD) {
            $w = (int)$d->format('N'); // 6,7 = weekend (Sat,Sun)
            if ($w < 6 && !in_array($d->format('Y-m-d'), $holidays, true)) {
                $days++;
            }
            $d = $d->modify('+1 day');
        }
        return $days;
    }
}
