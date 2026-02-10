<?php
namespace App\Service;

class WhatsAppNotifier
{
    // Optional: integrate via Twilio WhatsApp. If credentials are missing, no-op.
    public function send(string $to, string $message): void
    {
        $sid = $_ENV['TWILIO_SID'] ?? '';
        $token = $_ENV['TWILIO_TOKEN'] ?? '';
        $from = $_ENV['TWILIO_WHATSAPP_FROM'] ?? '';
        if (!$sid || !$token || !$from) return;

        // minimal cURL call (no external dependency)
        $url = "https://api.twilio.com/2010-04-01/Accounts/{$sid}/Messages.json";
        $data = http_build_query([
            'From' => $from,
            'To' => $to,
            'Body' => $message,
        ]);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $data,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_USERPWD => $sid . ':' . $token,
        ]);
        @curl_exec($ch);
        @curl_close($ch);
    }
}
