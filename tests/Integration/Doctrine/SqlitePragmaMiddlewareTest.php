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
            self::assertSame('wal', strtolower((string) $connection->fetchOne('PRAGMA journal_mode;')));
            self::assertSame('1', (string) $connection->fetchOne('PRAGMA synchronous;'));
            self::assertSame('5000', (string) $connection->fetchOne('PRAGMA busy_timeout;'));
            self::assertSame('1', (string) $connection->fetchOne('PRAGMA foreign_keys;'));
            self::assertSame('2', (string) $connection->fetchOne('PRAGMA temp_store;'));
            self::assertSame('-4000', (string) $connection->fetchOne('PRAGMA cache_size;'));
        } finally {
            $connection->close();
            @unlink($dbFile);
        }
    }

    /**
     * @test
     */
    public function test_concurrent_writers_do_not_trigger_lock_errors(): void
    {
        if (! \function_exists('proc_open')) {
            self::markTestSkipped('proc_open is required to spawn concurrent writer processes.');
        }

        $middlewareFactory = static function (): Configuration {
            $config = new Configuration();
            $config->setMiddlewares([new SqlitePragmaMiddleware()]);

            return $config;
        };

        $dbFile = tempnam(sys_get_temp_dir(), 'exe_sqlite_load_');
        self::assertNotFalse($dbFile);

        $scriptFileBase = tempnam(sys_get_temp_dir(), 'exe_sqlite_worker_');
        self::assertNotFalse($scriptFileBase);
        $scriptFile = $scriptFileBase . '.php';
        self::assertTrue(rename($scriptFileBase, $scriptFile));

        $autoloadPath = self::getContainer()->getParameter('kernel.project_dir') . '/vendor/autoload.php';
        $scriptSource = <<<'PHP'
<?php
declare(strict_types=1);

[$dbPath, $worker, $txnCount, $rowsPerTxn, $autoload] = array_slice($argv, 1);

require $autoload;

use App\Doctrine\Middleware\SqlitePragmaMiddleware;
use Doctrine\DBAL\Configuration;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\DriverManager;

$config = new Configuration();
$config->setMiddlewares([new SqlitePragmaMiddleware()]);

$connection = DriverManager::getConnection([
    'driver' => 'pdo_sqlite',
    'path'   => $dbPath,
], $config);

try {
    $worker     = (int) $worker;
    $txnCount   = (int) $txnCount;
    $rowsPerTxn = (int) $rowsPerTxn;

    for ($txn = 0; $txn < $txnCount; $txn++) {
        $connection->transactional(static function (Connection $conn) use ($worker, $txn, $rowsPerTxn): void {
            for ($row = 0; $row < $rowsPerTxn; $row++) {
                $conn->executeStatement(
                    'INSERT INTO load_test(worker, payload) VALUES (?, ?)',
                    [$worker, sprintf('w%1$d-t%2$d-r%3$d', $worker, $txn, $row)]
                );
            }

            usleep(random_int(500, 2000));
        });
    }
} catch (\Throwable $throwable) {
    fwrite(STDERR, $throwable->getMessage());
    exit(1);
}

$connection->close();
PHP;

        file_put_contents($scriptFile, $scriptSource);

        $setupConnection = DriverManager::getConnection([
            'driver' => 'pdo_sqlite',
            'path'   => $dbFile,
        ], $middlewareFactory());
        $setupConnection->executeStatement('CREATE TABLE IF NOT EXISTS load_test (id INTEGER PRIMARY KEY AUTOINCREMENT, worker INT, payload TEXT)');
        $setupConnection->close();

        $workers               = 4;
        $transactionsPerWorker = 12;
        $rowsPerTransaction    = 5;

        $processes = [];
        for ($i = 0; $i < $workers; $i++) {
            $process = new Process([
                PHP_BINARY,
                $scriptFile,
                $dbFile,
                (string) $i,
                (string) $transactionsPerWorker,
                (string) $rowsPerTransaction,
                $autoloadPath,
            ]);

            $process->start();
            $processes[] = $process;
        }

        $failures = [];
        foreach ($processes as $idx => $process) {
            $process->wait();

            if (! $process->isSuccessful()) {
                $errorOutput = trim($process->getErrorOutput());
                $output      = trim($process->getOutput());
                $failures[]  = sprintf(
                    'worker %d failed: %s',
                    $idx,
                    $errorOutput !== '' ? $errorOutput : $output
                );
            }
        }

        $finalConnection = DriverManager::getConnection([
            'driver' => 'pdo_sqlite',
            'path'   => $dbFile,
        ], $middlewareFactory());

        $expectedRows = $workers * $transactionsPerWorker * $rowsPerTransaction;
        $actualRows   = (int) $finalConnection->fetchOne('SELECT COUNT(*) FROM load_test');

        $finalConnection->close();
        @unlink($dbFile);
        @unlink($scriptFile);

        self::assertSame([], $failures, 'Worker processes reported failures: ' . implode('; ', $failures));
        self::assertSame($expectedRows, $actualRows, 'Not all rows were persisted under concurrent writes.');
    }
}
