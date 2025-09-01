<?php

// tests/bootstrap.php
use Symfony\Component\Dotenv\Dotenv;

// Force CWD to the project root so relative paths are stable
chdir(\dirname(__DIR__));
// Standardize permissions of files generated in tests
umask(0002);

// --- START: Dynamic FILES_DIR for parallel tests ---
if (isset($_SERVER['APP_ENV']) && 'test' === $_SERVER['APP_ENV']) {
    // Get a unique token for the test process. Paratest provides TEST_TOKEN.
    // Fallback to the process ID (pid) for single test runs.
    $token = getenv('TEST_TOKEN') ?: getmypid();
    $filesDir = sys_get_temp_dir().'/exelearning_test_files_'.$token;

    // Ensure the directory exists and is writable
    if (!is_dir($filesDir)) {
        mkdir($filesDir, 0777, true);
    }

    // Set the environment variable that Symfony will use to configure the 'filesdir' parameter
    $_ENV['FILES_DIR'] = $filesDir;
    putenv('FILES_DIR='.$filesDir);

    // Register a shutdown function to automatically clean up the temporary directory
    // after the test process finishes.
    register_shutdown_function(function () use ($filesDir) {
        if (is_dir($filesDir)) {
            // Use the application's own utility for recursive directory removal
            // This requires the autoloader to be available at shutdown.
            require_once __DIR__.'/../src/Util/net/exelearning/Util/FileUtil.php';
            \App\Util\net\exelearning\Util\FileUtil::removeDir($filesDir);
        }
    });
}
// --- END: Dynamic FILES_DIR for parallel tests ---

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
