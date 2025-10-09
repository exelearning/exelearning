<?php

namespace App\Doctrine\Middleware;

use Doctrine\DBAL\Driver;
use Doctrine\DBAL\Driver\Connection;
use Doctrine\DBAL\Driver\Middleware;
use Doctrine\DBAL\Driver\Middleware\AbstractDriverMiddleware;

/**
 * Forces SQLite connections to adopt WAL + tuned PRAGMAs for concurrent dev workloads.
 */
class SqlitePragmaMiddleware implements Middleware
{
    public function wrap(Driver $driver): Driver
    {
        return new class($driver) extends AbstractDriverMiddleware {
            /**
             * @param array<string, mixed> $params
             */
            public function connect(
                #[\SensitiveParameter]
                array $params,
            ): Connection {
                $connection = parent::connect($params);

                if (!$this->isSqlite($params)) {
                    return $connection;
                }

                // Skip WAL and disk-related PRAGMAs for pure in-memory DBs.
                if (!$this->isMemory($params)) {
                    // WAL keeps readers and writers from blocking each other.
                    $connection->exec('PRAGMA journal_mode = WAL');
                    // NORMAL sync trims redundant fsyncs without losing crash safety on checkpoints.
                    $connection->exec('PRAGMA synchronous = NORMAL');
                    // Retries for ~5s curb transient "database is locked" errors when writers race.
                    $connection->exec('PRAGMA busy_timeout = 5000');
                    // Doctrine disables foreign keys by default for SQLite; force them back on.
                    $connection->exec('PRAGMA foreign_keys = ON');
                    // Temp tables and sorting spill to memory to avoid disk-backed temp files.
                    $connection->exec('PRAGMA temp_store = MEMORY');
                    // Negative cache size sets ~4MB memory caching for hot pages (no disk persistence).
                    $connection->exec('PRAGMA cache_size = -4000');
                }

                return $connection;
            }

            /**
             * @param array<string, mixed> $params
             */
            private function isSqlite(array $params): bool
            {
                $driver = $params['driver'] ?? null;
                if (is_string($driver) && str_contains($driver, 'sqlite')) {
                    return true;
                }

                $driverClass = $params['driverClass'] ?? null;
                if (is_string($driverClass) && str_contains(strtolower($driverClass), 'sqlite')) {
                    return true;
                }

                $wrapperClass = $params['wrapperClass'] ?? null;
                if (is_string($wrapperClass) && str_contains(strtolower($wrapperClass), 'sqlite')) {
                    return true;
                }

                $url = $params['url'] ?? null;
                if (is_string($url) && str_starts_with($url, 'sqlite')) {
                    return true;
                }

                return false;
            }

            /**
             * Detects in-memory SQLite (":memory:" or memory param).
             *
             * @param array<string, mixed> $params
             */
            private function isMemory(array $params): bool
            {
                if (!empty($params['memory'])) {
                    return true;
                }
                $url = $params['url'] ?? null;
                if (\is_string($url) && \str_contains($url, ':memory:')) {
                    return true;
                }
                $path = $params['path'] ?? null;
                if (\is_string($path) && ':memory:' === $path) {
                    return true;
                }

                return false;
            }
        };
    }
}
