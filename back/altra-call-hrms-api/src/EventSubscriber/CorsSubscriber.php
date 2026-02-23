<?php

namespace App\EventSubscriber;

use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\KernelEvents;

class CorsSubscriber implements EventSubscriberInterface
{
    public static function getSubscribedEvents(): array
    {
        return [KernelEvents::RESPONSE => 'onResponse'];
    }

    public function onResponse(ResponseEvent $event): void
    {
        $req = $event->getRequest();
        $res = $event->getResponse();

        if (!str_starts_with($req->getPathInfo(), '/api/')) {
            return;
        }

        $origin = $req->headers->get('Origin');
        if ($origin === 'http://localhost:8008') {
            $res->headers->set('Access-Control-Allow-Origin', $origin);
            $res->headers->set('Vary', 'Origin');
        }

        $res->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        $res->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-KEY');
        $res->headers->set('Access-Control-Max-Age', '3600');
    }
}
