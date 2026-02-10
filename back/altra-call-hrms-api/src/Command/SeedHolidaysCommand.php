<?php
namespace App\Command;

use App\Entity\Holiday;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'app:seed-holidays')]
class SeedHolidaysCommand extends Command {
    public function __construct(private EntityManagerInterface $em){ parent::__construct(); }

    protected function execute(InputInterface $input, OutputInterface $output): int {
        $year = (int)date('Y');
        $defaults = [
            ['01-01','Nouvel an'],
            ['03-20','Fête de l\'Indépendance'],
            ['04-09','Journée des Martyrs'],
            ['05-01','Fête du Travail'],
            ['07-25','Fête de la République'],
            ['10-15','Fête de l\'Évacuation'],
        ];
        foreach ($defaults as [$md,$label]) {
            $d = new \DateTimeImmutable($year.'-'.$md);
            $exists = $this->em->getRepository(Holiday::class)->findOneBy(['date'=>$d]);
            if($exists) continue;
            $h = new Holiday();
            $h->setDate($d)->setLabel($label);
            $this->em->persist($h);
        }
        $this->em->flush();
        $output->writeln('Holidays seeded');
        return Command::SUCCESS;
    }
}
