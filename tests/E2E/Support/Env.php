<?php
declare(strict_types=1);

namespace App\Tests\E2E\Support;

/**
 * Centralized environment helpers for E2E tests.
 */
final class Env
{
    public static function baseUri(): string
    {
        $uri = $_ENV['PANTHER_BASE_URI'] ?? getenv('PANTHER_BASE_URI') ?: 'http://exelearning:8080';
        return rtrim($uri, '/');
    }

    /**
     * If you deep-link documents, build the path with $documentId here.
     */
    public static function workareaPath(?string $documentId = null): string
    {
        $path = $_ENV['WORKAREA_PATH'] ?? getenv('WORKAREA_PATH') ?: '/';
        return $path ?: '/';
    }

    public static function headless(): bool
    {
        $v = $_ENV['HEADLESS'] ?? getenv('HEADLESS') ?: '1';
        return $v === '1';
    }
}
