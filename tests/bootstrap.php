<?php

// tests/bootstrap.php
use Symfony\Component\Dotenv\Dotenv;

// Force CWD to the project root so relative paths are stable
chdir(\dirname(__DIR__));
// Standardize permissions of files generated in tests
umask(0002);

// Disable Panther Extension only when testsuite is "unit"
if (getenv('DISABLE_PANTHER_EXT')) {
    class __NoOpPantherServerExtension implements \PHPUnit\Runner\Extension\Extension {
        public function bootstrap(
            \PHPUnit\TextUI\Configuration\Configuration $configuration,
            \PHPUnit\Runner\Extension\Facade $facade,
            \PHPUnit\Runner\Extension\ParameterCollection $parameters
        ): void {}
    }
    class_alias(__NoOpPantherServerExtension::class, \Symfony\Component\Panther\ServerExtension::class);
}

// --- Load the real bootstrap ---
require dirname(__DIR__).'/vendor/autoload.php';

if (method_exists(Dotenv::class, 'bootEnv')) {
    (new Dotenv())->bootEnv(dirname(__DIR__).'/.env');
}
