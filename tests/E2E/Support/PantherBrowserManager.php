<?php
declare(strict_types=1);

namespace App\Tests\E2E\Support;

use Symfony\Component\Panther\Client;
use Symfony\Component\Panther\PantherTestCase;

/**
 * Helper that manages multiple Panther clients (e.g., for realtime tests).
 */
final class PantherBrowserManager
{
    /** @var array<string,Client> */
    private array $clients = [];

    public function __construct(private PantherTestCase $testCase)
    {
    }

    /**
     * Create a new named browser (e.g., "A", "B").
     */
    public function new(string $name, array $options = []): Client
    {
        if (isset($this->clients[$name])) {
            return $this->clients[$name];
        }

        $default = [
            'external_base_uri' => 'http://exelearning:8080',
            'browser' => PantherTestCase::CHROME,
        ];

        /** @var Client $client */
        $client = $this->testCase->makeClient($default + $options);
        $this->clients[$name] = $client;
        return $client;
    }

    public function get(string $name): ?Client
    {
        return $this->clients[$name] ?? null;
    }

    public function all(): array
    {
        return $this->clients;
    }

    /**
     * Close all clients (call in tearDown).
     */
    public function closeAll(): void
    {
        foreach ($this->clients as $client) {
            try {
                $client->quit();
            } catch (\Throwable) {
            }
        }
        $this->clients = [];
    }
}
