<?php
namespace App\Service;

use Symfony\Contracts\HttpClient\HttpClientInterface;

class SlackNotifier
{
    public function __construct(private HttpClientInterface $http){}

    public function send(string $text): void
    {
        $url = $_ENV['SLACK_WEBHOOK_URL'] ?? $_SERVER['SLACK_WEBHOOK_URL'] ?? '';
        if (!$url) return;
        try {
            $this->http->request('POST', $url, ['json' => ['text' => $text]]);
        } catch (\Throwable) {}
    }
}
