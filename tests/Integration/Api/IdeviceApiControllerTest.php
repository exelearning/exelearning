<?php

declare(strict_types=1);

namespace App\Tests\Integration\Api;

use App\Entity\net\exelearning\Entity\User;
use App\Helper\net\exelearning\Helper\IdeviceHelper;
use App\Service\net\exelearning\Service\FilesDir\FilesDirServiceInterface;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Doctrine\ORM\Tools\ToolsException;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

final class IdeviceApiControllerTest extends WebTestCase
{
    private KernelBrowser $client;
    private User $user;

    public static function setUpBeforeClass(): void
    {
        $token = getenv('TEST_TOKEN') ?: getmypid();
        $dbDir = sys_get_temp_dir().'/exelearning_test_db_'.$token;
        if (!is_dir($dbDir)) {
            mkdir($dbDir, 0777, true);
        }
        $dbPath = $dbDir.'/db.sqlite';
        putenv('DB_PATH='.$dbPath);
        $_ENV['DB_PATH'] = $dbPath;
        $_SERVER['DB_PATH'] = $dbPath;

        parent::setUpBeforeClass();
    }

    protected function setUp(): void
    {
        static::ensureKernelShutdown();
        $this->client = static::createClient();

        /** @var EntityManagerInterface $em */
        $em = static::getContainer()->get('doctrine')->getManager();
        $this->resetDatabaseSchema($em);
        /** @var FilesDirServiceInterface $filesDirService */
        $filesDirService = static::getContainer()->get(FilesDirServiceInterface::class);
        $checkResult = $filesDirService->checkFilesDir();
        self::assertTrue($checkResult['checked'] ?? false, 'Failed to initialize FILES_DIR structure.');
        $filesDir = rtrim((string) static::getContainer()->getParameter('filesdir'), DIRECTORY_SEPARATOR).
            DIRECTORY_SEPARATOR;
        self::assertDirectoryExists($filesDir.'perm/idevices/base');
        /** @var IdeviceHelper $ideviceHelper */
        $ideviceHelper = static::getContainer()->get(IdeviceHelper::class);
        $baseList = $ideviceHelper->getInstalledBaseIdevices();
        self::assertNotEmpty($baseList, 'No base idevices detected after initializing FILES_DIR.');
        $this->user = $this->createAndPersistUser($em);

        $this->client->loginUser($this->user);
    }

    private function resetDatabaseSchema(EntityManagerInterface $em): void
    {
        $metadata = $em->getMetadataFactory()->getAllMetadata();
        if ($metadata === []) {
            return;
        }

        $schemaTool = new SchemaTool($em);

        try {
            $schemaTool->dropSchema($metadata);
        } catch (ToolsException $exception) {
            // Ignore drop failures (e.g. tables not yet created in fresh database)
        }

        $schemaTool->createSchema($metadata);
    }

    private function createAndPersistUser(EntityManagerInterface $em): User
    {
        $user = new User();
        $user->setEmail('idevice_int_'.bin2hex(random_bytes(4)).'@example.com');
        $user->setUserId('usr_'.bin2hex(random_bytes(4)));
        $user->setPassword('dummy-password');
        $user->setIsLopdAccepted(true);
        $user->setRoles(['ROLE_USER']);

        $em->persist($user);
        $em->flush();
        $em->refresh($user);

        return $user;
    }

    public function testInstalledIdevicesEndpointReturnsBaseIdevices(): void
    {
        $this->client->request(
            'GET',
            '/api/idevice-management/idevices/installed',
            server: ['HTTP_ACCEPT' => 'application/json']
        );

        self::assertResponseStatusCodeSame(Response::HTTP_OK);

        $content = $this->client->getResponse()->getContent();
        $payload = json_decode($content, true, flags: JSON_THROW_ON_ERROR);
        self::assertIsArray($payload);
        self::assertArrayHasKey('idevices', $payload);
        self::assertNotEmpty($payload['idevices']);

        $targetDevice = null;
        $targetDirName = 'example';
        foreach ($payload['idevices'] as $device) {
            self::assertIsArray($device);
            self::assertArrayHasKey('name', $device);
            self::assertArrayHasKey('dirName', $device);
            if ($device['dirName'] === $targetDirName) {
                $targetDevice = $device;
            }
        }

        self::assertNotNull(
            $targetDevice,
            sprintf('Expected to find the built-in "%s" idevice in the installed list', $targetDirName)
        );
        self::assertSame($targetDirName, $targetDevice['dirName']);
        self::assertSame('/files/perm/idevices/base/'.$targetDirName, $targetDevice['url']);
        self::assertArrayHasKey('downloadable', $targetDevice);
        self::assertTrue((bool) ($targetDevice['downloadable'] ?? false));
    }

    public function testDownloadIdeviceEndpointReturnsZipPayload(): void
    {
        $sessionId = 'session1';
        $ideviceDirName = 'example';

        $this->client->request(
            'GET',
            sprintf('/api/idevice-management/idevices/%s/%s/download', $sessionId, $ideviceDirName),
            server: ['HTTP_ACCEPT' => 'application/json']
        );

        self::assertResponseStatusCodeSame(Response::HTTP_OK);

        $content = $this->client->getResponse()->getContent();
        $payload = json_decode($content, true, flags: JSON_THROW_ON_ERROR);
        self::assertIsArray($payload);
        self::assertSame($ideviceDirName.'.zip', $payload['zipFileName'] ?? null);

        $binary = base64_decode($payload['zipBase64'] ?? '', true);
        self::assertNotFalse($binary, 'Zip payload must be valid base64');
        self::assertSame('PK', substr($binary, 0, 2));

        if (class_exists(\ZipArchive::class)) {
            $tmpZip = tempnam(sys_get_temp_dir(), 'idevice_zip_');
            self::assertNotFalse($tmpZip);
            file_put_contents($tmpZip, $binary);

            $zip = new \ZipArchive();
            self::assertTrue($zip->open($tmpZip) === true, 'Generated payload must be a valid ZIP archive');
            self::assertNotFalse($zip->locateName('config.xml'), 'ZIP archive should contain the idevice config.xml file');
            $zip->close();

            @unlink($tmpZip);
        }
    }
}
