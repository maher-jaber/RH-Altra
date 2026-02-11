<?php

namespace App\EventSubscriber;

use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Ensure API errors are returned as JSON (so the frontend can handle them reliably).
 * This also makes debugging 500s much faster (message is included in dev).
 */
final class JsonExceptionSubscriber implements EventSubscriberInterface
{
    public function __construct(
        #[Autowire('%kernel.environment%')] private readonly string $appEnv
    ) {}

    public static function getSubscribedEvents(): array
    {
        return [KernelEvents::EXCEPTION => ['onKernelException', 100]];
    }

    public function onKernelException(ExceptionEvent $event): void
    {
        $e = $event->getThrowable();

        // Only JSON for API routes
        $path = $event->getRequest()->getPathInfo();
        if (!str_starts_with($path, '/api/')) {
            return;
        }

        $status = 500;
        if ($e instanceof HttpExceptionInterface) {
            $status = $e->getStatusCode();
        }

        $payload = [
            'error' => $status === 401 ? 'unauthorized' : 'server_error',
            'message' => $e->getMessage(),
        ];

        if ($this->appEnv === 'dev') {
            $payload['exception'] = (new \ReflectionClass($e))->getShortName();
        }

        $event->setResponse(new JsonResponse($payload, $status));
    }
}
