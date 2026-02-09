<?php

use Symfony\Component\Dotenv\Dotenv;

require dirname(__DIR__).'/vendor/autoload.php';

if (!isset($_SERVER['APP_ENV'])) {
    (new Dotenv())->usePutenv()->bootEnv(dirname(__DIR__).'/.env');
}

if (!isset($_ENV['MESSENGER_TRANSPORT_DSN']) && !isset($_SERVER['MESSENGER_TRANSPORT_DSN'])) {
    $_ENV['MESSENGER_TRANSPORT_DSN'] = 'sync://';
    $_SERVER['MESSENGER_TRANSPORT_DSN'] = 'sync://';
}
