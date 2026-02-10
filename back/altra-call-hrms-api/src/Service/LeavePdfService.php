<?php
namespace App\Service;

use App\Entity\LeaveRequest;
use Dompdf\Dompdf;

class LeavePdfService
{
    public function generate(LeaveRequest $lr): string
    {
        $html = "<h1>Demande de congé</h1>
        <p>Employé: {$lr->getUser()->getFullName()}</p>
        <p>Type: {$lr->getType()->getLabel()}</p>
        <p>Période: {$lr->getStartDate()->format('Y-m-d')} → {$lr->getEndDate()->format('Y-m-d')}</p>
        <p>Jours: {$lr->getDaysCount()}</p>";

        $dompdf = new Dompdf();
        $dompdf->loadHtml($html);
        $dompdf->render();

        $file = sys_get_temp_dir().'/leave_'.$lr->getId().'.pdf';
        file_put_contents($file, $dompdf->output());
        return $file;
    }
}
