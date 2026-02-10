<?php
namespace App\Service;

use App\Entity\LeaveRequest;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;
use App\Service\SlackNotifier;
use App\Service\WhatsAppNotifier;

class LeaveNotificationService
{
    public function __construct(private MailerInterface $mailer, private SlackNotifier $slack, private WhatsAppNotifier $wa){}

    public function notify(string $to, string $subject, string $content): void
    {
        $email = (new Email())
            ->from('hr@altra-call.com')
            ->to($to)
            ->subject($subject)
            ->html($content);

        $this->mailer->send($email);
    }

    public function onSubmit(LeaveRequest $lr): void
    {
        $this->notify($lr->getManager()->getEmail(),
            'Nouvelle demande de congé',
            '<p>Une nouvelle demande de congé vous attend.</p>'
        );
    }

    public function onManagerDecision(LeaveRequest $lr): void
    {
        $this->notify($lr->getUser()->getEmail(),
            'Décision manager sur votre congé',
            '<p>Votre manager a traité votre demande.</p>'
        );
    }

    public function onHrDecision(LeaveRequest $lr): void
    {
        $this->notify($lr->getUser()->getEmail(),
            'Décision RH sur votre congé',
            '<p>La RH a finalisé votre demande.</p>'
        );
    }
}
