<?php
declare(strict_types=1);

namespace App\Tests\Functional;

use App\Controller\net\exelearning\Controller\Api\OdeApiController;
use App\Entity\net\exelearning\Entity\OdePropertiesSync;
use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Service\net\exelearning\Service\Api\OdeServiceInterface;
use App\Tests\Helper\TestDatabaseHelper;
use DAMA\DoctrineTestBundle\Doctrine\DBAL\StaticDriver;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Doctrine\ORM\Tools\ToolsException;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\HttpFoundation\Request;

class CheckBeforeLeaveSessionTest extends KernelTestCase
{
    private OdeApiController $controller;
    private OdeServiceInterface $odeService;
    private EntityManagerInterface $em;

    public static function setUpBeforeClass(): void
    {
        $token = getenv('TEST_TOKEN') ?: getmypid();
        $dbDir = sys_get_temp_dir().'/exelearning_unsaved_modal_'.$token;
        if (!is_dir($dbDir)) {
            mkdir($dbDir, 0777, true);
        }
        $dbPath = $dbDir.'/db.sqlite';
        $databaseUrl = 'sqlite:///'.$dbPath;

        $envVars = [
            'DATABASE_URL' => $databaseUrl,
            'DB_DRIVER' => 'pdo_sqlite',
            'DB_HOST' => 'localhost',
            'DB_PORT' => '',
            'DB_NAME' => 'exetest',
            'DB_USER' => '',
            'DB_PASSWORD' => '',
            'DB_CHARSET' => 'UTF8',
            'DB_SERVER_VERSION' => '3',
            'DB_PATH' => $dbPath,
        ];

        foreach ($envVars as $key => $value) {
            putenv($key.'='.$value);
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }

        parent::setUpBeforeClass();

        // Disable DAMA transaction wrapping so schema resets can run safely.
        StaticDriver::setKeepStaticConnections(false);

        putenv('APP_ENV=test');
        $_SERVER['APP_ENV'] = 'test';
        $_ENV['APP_ENV'] = 'test';

        self::bootKernel();
        $container = static::getContainer();
        $entityManager = $container->get('doctrine')->getManager();
        self::resetDatabaseSchema($entityManager);
        self::ensureKernelShutdown();
    }

    protected function setUp(): void
    {
        putenv('APP_ENV=test');
        $_SERVER['APP_ENV'] = 'test';
        $_ENV['APP_ENV'] = 'test';

        self::bootKernel();
        $container = static::getContainer();
        $this->controller = $container->get(OdeApiController::class);
        $this->odeService = $container->get(OdeServiceInterface::class);
        $this->em = $container->get('doctrine')->getManager();
        self::resetDatabaseSchema($this->em);
    }

    public function test_fresh_session_is_left_without_prompt(): void
    {
        $sessionData = $this->openFixtureSession();

        $responseData = $this->callCheckBeforeLeave($sessionData);

        $this->assertArrayHasKey('leaveSession', $responseData);
        $this->assertTrue($responseData['leaveSession']);
        $this->assertArrayNotHasKey('askSave', $responseData);
    }

    public function test_session_with_metadata_changes_requires_save(): void
    {
        $sessionData = $this->openFixtureSession();

        $propRepo = $this->em->getRepository(OdePropertiesSync::class);
        $titleProperty = $propRepo->findOneBy([
            'odeSessionId' => $sessionData['odeSessionId'],
            'key' => 'pp_title',
        ]);
        $this->assertNotNull($titleProperty, 'Fixture missing pp_title entry');
        $titleProperty->setValue('Updated title '.uniqid('', false));
        $this->em->flush();

        $responseData = $this->callCheckBeforeLeave($sessionData);

        $this->assertArrayHasKey('askSave', $responseData, 'Payload: '.json_encode($responseData));
        $this->assertTrue($responseData['askSave']);
    }

    /**
     * Imports the ELP fixture and returns the session identifiers.
     *
     * @return array{odeId: string, odeVersionId: string, odeSessionId: string}
     */
    private function openFixtureSession(): array
    {
        $elpPath = realpath(__DIR__.'/../Fixtures/tema-10-ejemplo.elp');
        $this->assertNotFalse($elpPath, 'Missing test fixture tema-10-ejemplo.elp');

        $user = TestDatabaseHelper::createUser($this->em);

        $check = $this->odeService->checkLocalOdeFile(
            basename($elpPath),
            $elpPath,
            $user,
            true
        );
        $this->assertSame('OK', $check['responseMessage'] ?? null, 'ELP validation failed');

        $result = $this->odeService->createElpStructureAndCurrentOdeUser(
            basename($elpPath),
            $user,
            $user,
            '127.0.0.1',
            true,
            $check
        );
        $this->assertSame('OK', $result['responseMessage'] ?? null, 'ELP import failed');

        $sessionInfo = [
            'odeId' => $check['odeId'],
            'odeVersionId' => $check['odeVersionId'],
            'odeSessionId' => $check['odeSessionId'],
        ];

        $currentUsers = $this->em->getRepository(CurrentOdeUsers::class)->count(['odeSessionId' => $sessionInfo['odeSessionId']]);
        $this->assertGreaterThan(
            0,
            $currentUsers,
            'Expected at least one CurrentOdeUsers row for the imported session'
        );

        return $sessionInfo;
    }

    /**
     * Calls the controller action and returns the decoded payload.
     *
     * @param array{odeId: string, odeVersionId: string, odeSessionId: string} $sessionData
     *
     * @return array<string, mixed>
     */
    private function callCheckBeforeLeave(array $sessionData): array
    {
        $request = new Request([], [
            'odeSessionId' => $sessionData['odeSessionId'],
            'odeVersionId' => $sessionData['odeVersionId'],
            'odeId' => $sessionData['odeId'],
        ]);

        $response = $this->controller->checkBeforeLeaveOdeSessionAction($request);
        $this->assertSame(200, $response->getStatusCode(), 'Endpoint should respond with HTTP 200');

        $payload = json_decode($response->getContent() ?: '{}', true);
        $this->assertIsArray($payload, 'Response payload should be JSON');

        return $payload;
    }

    private static function resetDatabaseSchema(EntityManagerInterface $em): void
    {
        $metadata = $em->getMetadataFactory()->getAllMetadata();
        if ([] === $metadata) {
            return;
        }

        $schemaTool = new SchemaTool($em);

        try {
            $schemaTool->dropSchema($metadata);
        } catch (ToolsException $exception) {
            // Ignore drop failures when schema is not present yet.
        }

        $schemaTool->createSchema($metadata);
    }

}
