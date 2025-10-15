<?php

namespace App\Tests\Functional;

use App\Helper\net\exelearning\Helper\FileHelper;
use App\Service\net\exelearning\Service\Maintenance\TmpFilesCleanupService;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

final class TmpCleanupEndpointTest extends WebTestCase
{
    public function testEndpointRejectsInvalidKey(): void
    {
        $client = static::createClient();
        $client->request('POST', '/maintenance/tmp/cleanup?key=invalid');

        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
        $payload = json_decode($client->getResponse()->getContent(), true, flags: JSON_THROW_ON_ERROR);
        self::assertSame('Invalid cleanup key.', $payload['error']);
    }

    public function testEndpointRunsCleanupWithValidKey(): void
    {
        $client = static::createClient();
        $container = static::getContainer();
        $fileHelper = $container->get(FileHelper::class);
        $tmpDir = $fileHelper->getTemporaryContentStorageDir();
        if (!is_dir($tmpDir)) {
            mkdir($tmpDir, 0777, true);
        }

        $oldFile = $tmpDir.'endpoint-old.txt';
        file_put_contents($oldFile, 'old');
        touch($oldFile, time() - TmpFilesCleanupService::DEFAULT_MAX_AGE_SECONDS - 10);

        $validKey = getenv('TMP_CLEANUP_KEY') ?: 'test-cleanup-key';

        $client->request('POST', '/maintenance/tmp/cleanup?key='.$validKey);

        self::assertResponseIsSuccessful();
        $payload = json_decode($client->getResponse()->getContent(), true, flags: JSON_THROW_ON_ERROR);

        self::assertIsArray($payload['failures']);
        self::assertCount(0, $payload['failures']);
        self::assertGreaterThanOrEqual(1, $payload['removed_files']);
        self::assertSame($tmpDir, $payload['tmp_directory']);
        self::assertFileDoesNotExist($oldFile);
    }
}
