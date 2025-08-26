<?php

// tests/bootstrap.php
use Symfony\Component\Dotenv\Dotenv;

require dirname(__DIR__).'/vendor/autoload.php';

if (method_exists(Dotenv::class, 'bootEnv')) {
    (new Dotenv())->bootEnv(dirname(__DIR__).'/.env');
}


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
