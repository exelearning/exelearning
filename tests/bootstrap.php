<?php
// tests/bootstrap.php
use Symfony\Component\Dotenv\Dotenv;
use Symfony\Component\Filesystem\Filesystem;
use Symfony\Component\Process\Process;

require dirname(__DIR__).'/vendor/autoload.php';

if (file_exists(dirname(__DIR__).'/config/bootstrap.php')) {
    require dirname(__DIR__).'/config/bootstrap.php';
} elseif (method_exists(Dotenv::class, 'bootEnv')) {
    (new Dotenv())->bootEnv(dirname(__DIR__).'/.env');
}

// Ensure we use the test environment
// $_SERVER['APP_ENV'] = 'test';
// putenv('APP_ENV=test');


// Create a unique temporary filename for the SQLite database
$dbFile = sys_get_temp_dir() . '/test_' . uniqid() . '.db';

// Path to the var directory
$varDir = dirname(__DIR__).'/var';

// Clear test cache
(new Filesystem())->remove($varDir.'/cache/test');

// // Execute commands to prepare the database
// echo "Setting up the test database...\n";


// // Configure the SQLite database connection URL
// $_SERVER['DATABASE_URL'] = 'sqlite:///' . $dbFile;
// putenv('DATABASE_URL=sqlite:///' . $dbFile);

// Clear test cache
$filesystem = new Filesystem();
$varDir = dirname(__DIR__).'/var';
$filesystem->remove($varDir.'/cache/test');

// // Register a cleanup function to delete the database file upon completion
// register_shutdown_function(function() use ($dbFile, $filesystem) {
//     if ($filesystem->exists($dbFile)) {
//         $filesystem->remove($dbFile);
//         echo "Temporary database deleted: $dbFile\n";
//     }
// });

// echo "Temporary SQLite database configured: $dbFile\n";


// Create the database
$process = new Process(['php', 'bin/console', 'doctrine:schema:update', '--env=test', '--force']);
$process->run();
if (!$process->isSuccessful()) {
    echo "Error creating the database schema: " . $process->getErrorOutput();
    exit(1);
}

// Create test user using environment variables
// $process = new Process(['php', 'bin/console', 'app:create-user', ${TEST_USER_EMAIL}, "${TEST_USER_PASSWORD}", "${TEST_USER_USERNAME}", "--no-fail"]);
// $process->run();
// if (!$process->isSuccessful()) {
//     echo "Error creating the database schema: " . $process->getErrorOutput();
//     exit(1);
// }

// Cache clear
$process = new Process(['php', 'bin/console', 'cache:clear']);
$process->run();
if (!$process->isSuccessful()) {
    echo "Error creating the database schema: " . $process->getErrorOutput();
    exit(1);
}


// Assets install
$process = new Process(['php', 'bin/console', 'assets:install', 'public']);
$process->run();
if (!$process->isSuccessful()) {
    echo "Error creating the database schema: " . $process->getErrorOutput();
    exit(1);
}
echo "Test database successfully configured.\n";


// Enable error handler for deprecated warnings when running with --debug
// This will print the full backtrace for E_DEPRECATED notices, useful for finding the exact line.
// To activate it, run PHPUnit with the --debug flag:
//     vendor/bin/phpunit --debug
//
// If --debug is not used, this block will not run, but deprecations may still be reported in summary.
// Tip: You can also enable this manually with `DEBUG=1` if needed.

$debug = in_array('--debug', $_SERVER['argv'] ?? [], true);

if ($debug) {
    $previousErrorHandler = set_error_handler(function ($errno, $errstr, $errfile, $errline) {
        if ($errno === E_DEPRECATED) {
            fwrite(STDERR, "\033[33mDeprecated: $errstr in $errfile:$errline\033[0m\n");
            debug_print_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS);
        }
        return false;
    });
} else {
    fwrite(STDERR, "\033[33m[DEBUG] Error handler for deprecations not active. Run PHPUnit with --debug to enable detailed backtraces.\033[0m\n");
}
