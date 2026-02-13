<?php
namespace App\Service;

use App\Entity\Holiday;
use Doctrine\ORM\EntityManagerInterface;
use App\Service\SettingsService;

class WorkingDaysService {
    public function __construct(private EntityManagerInterface $em, private SettingsService $settings){}

    public function countWorkingDays(\DateTimeInterface $start, \DateTimeInterface $end): int {
        if ($end < $start) return 0;

        $weekend = $this->settings->getWeekendDays();

        $startD = new \DateTimeImmutable($start->format('Y-m-d'));
        $endD = new \DateTimeImmutable($end->format('Y-m-d'));

        

        // Fetch only holidays within the requested range (performance)
        $qb = $this->em->createQueryBuilder();
        $qb->select('h')
            ->from(Holiday::class, 'h')
            ->where('h.date BETWEEN :s AND :e')
            ->setParameters(['s' => $startD, 'e' => $endD]);
        $holidays = array_map(
            fn(Holiday $h)=>$h->getDate()->format('Y-m-d'),
            $qb->getQuery()->getResult()
        );

        $days = 0;
        $d = $startD;
        

        while ($d <= $endD) {
            $w = (int)$d->format('N');
            if (!in_array($w, $weekend, true) && !in_array($d->format('Y-m-d'), $holidays, true)) {
                $days++;
            }
            $d = $d->modify('+1 day');
        }
        return $days;
    }
}
