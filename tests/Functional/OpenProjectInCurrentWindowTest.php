<?php
declare(strict_types=1);

namespace App\Tests\Functional;

use App\Controller\net\exelearning\Controller\Api\OdeApiController;
use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\net\exelearning\Entity\OdePropertiesSync;
use App\Service\net\exelearning\Service\Api\OdeServiceInterface;
use App\Tests\Helper\TestDatabaseHelper;
use DAMA\DoctrineTestBundle\Doctrine\DBAL\StaticDriver;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Doctrine\ORM\Tools\ToolsException;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\HttpFoundation\Request;

/**
 * Tests the behavior of opening projects in the current window.
 *
 * This test verifies that:
 * 1. Projects open in the same session (current window) by default
 * 2. The save dialog works correctly when opening another project
 * 3. No infinite loop occurs when opening projects
 */
class OpenProjectInCurrentWindowTest extends KernelTestCase
{
    private OdeApiController $controller;
    private OdeServiceInterface $odeService;
    private EntityManagerInterface $em;

    public static function setUpBeforeClass(): void
    {
        $token = getenv('TEST_TOKEN') ?: getmypid();
        $dbDir = sys_get_temp_dir().'/exelearning_current_window_'.$token;
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

    /**
     * Test that parallel sessions are always allowed,
     * enabling users to open multiple projects simultaneously.
     */
    public function test_open_project_allows_parallel_sessions(): void
    {
        $user = TestDatabaseHelper::createUser($this->em);

        // Open first project
        $firstSession = $this->openFixtureSession($user);

        // Open second project (parallel sessions are always allowed)
        $secondSession = $this->openAnotherProject($user);

        $this->assertNotEmpty($secondSession['odeSessionId']);
        $this->assertNotSame($firstSession['odeSessionId'], $secondSession['odeSessionId']);
    }

    /**
     * Test that check before leave session correctly identifies unsaved changes.
     */
    public function test_check_before_leave_identifies_unsaved_changes(): void
    {
        $user = TestDatabaseHelper::createUser($this->em);
        $sessionData = $this->openFixtureSession($user);

        // Modify a property to simulate unsaved changes
        $propRepo = $this->em->getRepository(OdePropertiesSync::class);
        $titleProperty = $propRepo->findOneBy([
            'odeSessionId' => $sessionData['odeSessionId'],
            'key' => 'pp_title',
        ]);
        $this->assertNotNull($titleProperty, 'Fixture missing pp_title entry');
        $titleProperty->setValue('Modified title '.uniqid('', false));
        $this->em->flush();

        // Check before leave should indicate save is needed
        $responseData = $this->callCheckBeforeLeave($sessionData);

        $this->assertArrayHasKey('askSave', $responseData);
        $this->assertTrue($responseData['askSave'], 'Should ask to save when there are changes');
    }

    /**
     * Test that after confirming "don't save", a new project can be opened
     * in the same session without creating an infinite loop.
     */
    public function test_open_new_project_after_discarding_changes(): void
    {
        $user = TestDatabaseHelper::createUser($this->em);

        // Open first project
        $firstSession = $this->openFixtureSession($user);

        // Simulate user clicking "Don't save" and opening another project
        // This should work without issues
        $secondSession = $this->openAnotherProject($user);

        $this->assertNotEmpty($secondSession['odeSessionId']);
        $this->assertSame('OK', $secondSession['responseMessage'] ?? null);

        // Verify that both sessions exist (parallel sessions are always allowed)
        $currentUsersRepo = $this->em->getRepository(CurrentOdeUsers::class);
        $firstSessionUsers = $currentUsersRepo->findBy(['odeSessionId' => $firstSession['odeSessionId']]);
        $secondSessionUsers = $currentUsersRepo->findBy(['odeSessionId' => $secondSession['odeSessionId']]);

        $this->assertNotEmpty($firstSessionUsers, 'First session should still exist');
        $this->assertNotEmpty($secondSessionUsers, 'Second session should be created');
    }

    /**
     * Test that the same user can have multiple sessions open
     * (simulating multiple tabs/windows).
     */
    public function test_user_can_have_multiple_sessions(): void
    {
        $user = TestDatabaseHelper::createUser($this->em);

        $session1 = $this->openFixtureSession($user);
        $session2 = $this->openAnotherProject($user);
        $session3 = $this->openAnotherProject($user);

        $this->assertNotSame($session1['odeSessionId'], $session2['odeSessionId']);
        $this->assertNotSame($session2['odeSessionId'], $session3['odeSessionId']);
        $this->assertNotSame($session1['odeSessionId'], $session3['odeSessionId']);

        // All sessions should be valid
        $currentUsersRepo = $this->em->getRepository(CurrentOdeUsers::class);
        $count = $currentUsersRepo->count(['user' => $user->getUserIdentifier()]);
        $this->assertGreaterThanOrEqual(3, $count, 'User should have at least 3 active sessions');
    }

    /**
     * Opens a fixture ELP file and returns the session identifiers.
     *
     * @return array{odeId: string, odeVersionId: string, odeSessionId: string, responseMessage: string}
     */
    private function openFixtureSession($user): array
    {
        $elpPath = realpath(__DIR__.'/../Fixtures/tema-10-ejemplo.elp');
        $this->assertNotFalse($elpPath, 'Missing test fixture tema-10-ejemplo.elp');

        $check = $this->odeService->checkLocalOdeFile(
            basename($elpPath),
            $elpPath,
            $user,
            false,
            false,
            null
        );
        $this->assertSame('OK', $check['responseMessage'] ?? null, 'ELP validation failed');

        $result = $this->odeService->createElpStructureAndCurrentOdeUser(
            basename($elpPath),
            $user,
            $user,
            '127.0.0.1',
            false,
            $check
        );
        $this->assertSame('OK', $result['responseMessage'] ?? null, 'ELP import failed');

        return [
            'odeId' => $check['odeId'],
            'odeVersionId' => $check['odeVersionId'],
            'odeSessionId' => $check['odeSessionId'],
            'responseMessage' => $result['responseMessage'],
        ];
    }

    /**
     * Opens another project (simulating opening a different file).
     *
     * @return array{odeId: string, odeVersionId: string, odeSessionId: string, responseMessage: string}
     */
    private function openAnotherProject($user): array
    {
        // Use basic-example.elp as a different project
        $elpPath = realpath(__DIR__.'/../Fixtures/basic-example.elp');
        $this->assertNotFalse($elpPath, 'Missing test fixture basic-example.elp');

        $check = $this->odeService->checkLocalOdeFile(
            basename($elpPath),
            $elpPath,
            $user,
            false,
            false,
            null
        );
        $this->assertSame('OK', $check['responseMessage'] ?? null, 'ELP validation failed');

        $result = $this->odeService->createElpStructureAndCurrentOdeUser(
            basename($elpPath),
            $user,
            $user,
            '127.0.0.1',
            false,
            $check
        );
        $this->assertSame('OK', $result['responseMessage'] ?? null, 'ELP import failed');

        return [
            'odeId' => $check['odeId'],
            'odeVersionId' => $check['odeVersionId'],
            'odeSessionId' => $check['odeSessionId'],
            'responseMessage' => $result['responseMessage'],
        ];
    }

    /**
     * Calls the controller action to check before leaving session.
     *
     * @param array{odeId: string, odeVersionId: string, odeSessionId: string} $sessionData
     * @return array<string, mixed>
     */
    private function callCheckBeforeLeave(array $sessionData): array
    {
        $request = new Request([], [
            'odeSessionId' => $sessionData['odeSessionId'],
            'odeVersion' => $sessionData['odeVersionId'],
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
