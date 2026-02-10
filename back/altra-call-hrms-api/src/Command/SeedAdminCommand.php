<?php

namespace App\Command;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'app:seed-admin', description: 'Ensure default admin user exists')]
class SeedAdminCommand extends Command
{
    public function __construct(private EntityManagerInterface $em)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $email = $_ENV['DEFAULT_ADMIN_EMAIL'] ?? 'admin@altracall.com';
        $pass  = $_ENV['DEFAULT_ADMIN_PASSWORD'] ?? 'Admin@1234';

        $repo = $this->em->getRepository(User::class);
        $existing = $repo->findOneBy(['email' => strtolower($email)]);

        if ($existing) {
            $output->writeln('<info>[seed] Admin already exists: '.$existing->getEmail().'</info>');
            return Command::SUCCESS;
        }

        $apiKey = bin2hex(random_bytes(16));

        $u = (new User())
            ->setEmail($email)
            ->setPasswordHash(password_hash($pass, PASSWORD_BCRYPT))
            ->setRoles(['ROLE_ADMIN'])
            ->setApiKey($apiKey)
            ->setFullName('Admin');

        $this->em->persist($u);
        $this->em->flush();

        $output->writeln('<info>[seed] Admin created</info>');
        $output->writeln('  email: '.$email);
        $output->writeln('  password: '.$pass);
        $output->writeln('  token (X-API-KEY): '.$apiKey);

        return Command::SUCCESS;
    }
}
