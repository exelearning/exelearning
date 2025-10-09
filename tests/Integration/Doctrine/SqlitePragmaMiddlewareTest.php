<?php

namespace App\Tests\Integration\Doctrine;

use App\Doctrine\Middleware\SqlitePragmaMiddleware;
use Doctrine\DBAL\Configuration;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\DriverManager;
use Doctrine\DBAL\Exception;
use Symfony\Component\Process\Process;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

class SqlitePragmaMiddlewareTest extends KernelTestCase
{
    protected function setUp(): void
    {
        self::bootKernel();
    }

    /**
     * @test
     *
     * @throws Exception
     */
    public function test_it_applies_tuned_pragmas_to_file_based_connections(): void
    {
        $config = new Configuration();
        $config->setMiddlewares([new SqlitePragmaMiddleware()]);

        $dbFile = tempnam(sys_get_temp_dir(), 'exe_sqlite_');
        self::assertNotFalse($dbFile, 'Could not create temporary SQLite file.');

        // Middleware runs during connect() and applies the PRAGMA directives.
        $connection = DriverManager::getConnection([
            'driver'   => 'pdo_sqlite',
            'path'     => $dbFile,
        ], $config);

        try {
            self::assertSame('1', (string) $connection->fetchOne('PRAGMA synchronous;'));
            self::assertSame('5000', (string) $connection->fetchOne('PRAGMA busy_timeout;'));
            self::assertSame('2', (string) $connection->fetchOne('PRAGMA temp_store;'));
            self::assertSame('-4000', (string) $connection->fetchOne('PRAGMA cache_size;'));
        } finally {
            $connection->close();
            @unlink($dbFile);
        }
    }

}
