<?php

declare(strict_types=1);

namespace App\Tests\Controller;

use App\Dto\PrintDocument;
use App\Dto\PrintPage;
use App\Entity\net\exelearning\Entity\OdeFiles;
use App\Entity\net\exelearning\Entity\User;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Repository\net\exelearning\Repository\OdeFilesRepository;
use App\Service\PrintDocumentBuilder;
use DateTimeImmutable;
use InvalidArgumentException;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Doctrine\ORM\Tools\ToolsException;
use DAMA\DoctrineTestBundle\Doctrine\DBAL\StaticDriver;
use PHPUnit\Framework\MockObject\MockObject;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\Security\Core\User\UserInterface;

final class ExportControllerTest extends WebTestCase
{
    private string $projectId;
    private string $ownerEmail;

    private PrintDocument $document;

    /** @var MockObject&PrintDocumentBuilder */
    private MockObject $builderMock;

    /** @var MockObject&OdeFilesRepository */
    private MockObject $odeFilesRepositoryMock;

    /** @var MockObject&UserHelper */
    private MockObject $userHelperMock;

    private OdeFiles $fixtureFile;

    private static ?string $databasePath = null;

    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();

        StaticDriver::setKeepStaticConnections(false);
        self::$databasePath = sys_get_temp_dir().'/export-controller-'.bin2hex(random_bytes(6)).'.sqlite';
        putenv('DB_DRIVER=pdo_sqlite');
        putenv('DB_PATH='.self::$databasePath);
        $_ENV['DB_DRIVER'] = 'pdo_sqlite';
        $_ENV['DB_PATH'] = self::$databasePath;
        $_SERVER['DB_DRIVER'] = 'pdo_sqlite';
        $_SERVER['DB_PATH'] = self::$databasePath;

        $kernel = static::createKernel();
        $kernel->boot();

        /** @var EntityManagerInterface $entityManager */
        $entityManager = $kernel->getContainer()->get('doctrine')->getManager();
        $metadata = $entityManager->getMetadataFactory()->getAllMetadata();
        if (!empty($metadata)) {
            $schemaTool = new SchemaTool($entityManager);
            try {
                $schemaTool->dropSchema($metadata);
            } catch (ToolsException) {
                // ignore failures when schema is not present yet
            }
            $schemaTool->createSchema($metadata);
            StaticDriver::commit();
        }

        $kernel->shutdown();
    }

    public static function tearDownAfterClass(): void
    {
        if (self::$databasePath && file_exists(self::$databasePath)) {
            @unlink(self::$databasePath);
        }

        StaticDriver::setKeepStaticConnections(true);

        parent::tearDownAfterClass();
    }

    protected function setUp(): void
    {
        parent::setUp();

        $this->projectId = 'project-print-demo';
        $this->ownerEmail = 'print-owner@example.com';

        $this->document = new PrintDocument(
            $this->projectId,
            'Print Export Demo',
            'Unit Test Author',
            'This is a synthetic document used by the functional test suite.',
            'en',
            new DateTimeImmutable('2024-01-01T12:00:00+00:00'),
            [
                new PrintPage('page-1', 'Introduction', 0, '<p>Welcome</p>', 'page-1-introduction'),
                new PrintPage('page-2', 'First steps', 1, '<p>Chapter</p>', 'page-2-first-steps'),
            ]
        );

        $this->fixtureFile = (new OdeFiles())
            ->setOdeId($this->projectId)
            ->setOdeVersionId('version-1')
            ->setTitle('Fixture project')
            ->setFileName('fixture.elp')
            ->setFileType('elp')
            ->setDiskFilename('fixture.elp')
            ->setSize('1024')
            ->setUser($this->ownerEmail)
            ->setIsManualSave(true);

        $document = $this->document;
        $projectId = $this->projectId;

        $this->builderMock = $this->createMock(PrintDocumentBuilder::class);
        $this->builderMock
            ->method('build')
            ->willReturnCallback(static function (string $requestedProjectId) use ($projectId, $document): PrintDocument {
                if ($requestedProjectId !== $projectId) {
                    throw new InvalidArgumentException('Project not found');
                }

                return $document;
            });

        $fixtureFile = $this->fixtureFile;
        $this->odeFilesRepositoryMock = $this->createMock(OdeFilesRepository::class);
        $this->odeFilesRepositoryMock
            ->method('getLastFileForOde')
            ->willReturnCallback(static function (string $requestedProjectId) use ($projectId, $fixtureFile): ?OdeFiles {
                return $requestedProjectId === $projectId ? $fixtureFile : null;
            });

        $this->userHelperMock = $this->createMock(UserHelper::class);
        $this->userHelperMock
            ->method('getLoggedUserName')
            ->willReturnCallback(static fn (?UserInterface $user): string => $user?->getUserIdentifier() ?? '');
    }

    public function testPrintViewAccessibleForOwner(): void
    {
        $client = $this->createClientWithStubs();
        $client->loginUser($this->createUser($this->ownerEmail));

        $client->request('GET', sprintf('/project/%s/print', $this->projectId));

        $this->assertResponseIsSuccessful();
        $content = $client->getResponse()->getContent();
        self::assertIsString($content);
        $this->assertStringContainsString($this->document->getTitle(), $content);
        $this->assertStringContainsString('Introduction', $content);
        $this->assertStringContainsString('First steps', $content);
    }

    public function testPrintViewForbiddenForOtherUser(): void
    {
        $client = $this->createClientWithStubs();
        $client->loginUser($this->createUser('other-user@example.com'));

        $client->request('GET', sprintf('/project/%s/print', $this->projectId));

        $this->assertResponseStatusCodeSame(403);
    }

    public function testUnknownProjectReturnsNotFound(): void
    {
        $client = $this->createClientWithStubs();
        $client->loginUser($this->createUser($this->ownerEmail));

        $client->request('GET', '/project/UNKNOWN_PROJECT_ID/print');

        $this->assertResponseStatusCodeSame(404);
    }

    private function createClientWithStubs(): KernelBrowser
    {
        putenv('APP_ENV=test');
        $_ENV['APP_ENV'] = 'test';
        $_SERVER['APP_ENV'] = 'test';
        try {
            StaticDriver::rollBack();
        } catch (\Throwable) {
            // ignore when no transaction is active yet
        }
        static::ensureKernelShutdown();
        $client = static::createClient();
        $container = static::getContainer();
        $container->set(PrintDocumentBuilder::class, $this->builderMock);
        $container->set('test.'.PrintDocumentBuilder::class, $this->builderMock);
        $container->set(OdeFilesRepository::class, $this->odeFilesRepositoryMock);
        $container->set('test.'.OdeFilesRepository::class, $this->odeFilesRepositoryMock);
        $container->set(UserHelper::class, $this->userHelperMock);
        $container->set('test.'.UserHelper::class, $this->userHelperMock);

        return $client;
    }

    private function createUser(string $email): UserInterface
    {
        /** @var EntityManagerInterface $entityManager */
        $entityManager = static::getContainer()->get('doctrine')->getManager();

        $existing = $entityManager->getRepository(User::class)->findOneBy(['email' => $email]);
        if ($existing instanceof UserInterface) {
            return $existing;
        }

        $user = new User();
        $user->setEmail($email);
        $user->setUserId('usr_'.bin2hex(random_bytes(6)));
        $user->setRoles(['ROLE_USER']);
        $user->setIsLopdAccepted(true);
        $user->setPassword('test-password');

        $entityManager->persist($user);
        $entityManager->flush();
        $entityManager->refresh($user);

        return $user;
    }
}
