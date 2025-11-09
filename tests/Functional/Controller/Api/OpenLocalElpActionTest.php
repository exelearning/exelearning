<?php
declare(strict_types=1);

namespace App\Tests\Functional\Controller\Api;

use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\User;
use App\Service\net\exelearning\Service\Api\OdeServiceInterface;
use App\Tests\Helper\TestDatabaseHelper;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class OpenLocalElpActionTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $entityManager;
    private OdeServiceInterface $odeService;
    /**
     * @var array<int, string>
     */
    private array $temporaryFiles = [];

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();

        $container = static::getContainer();
        $this->entityManager = $container->get('doctrine')->getManager();
        $this->odeService = $container->get(OdeServiceInterface::class);
    }

    protected function tearDown(): void
    {
        foreach ($this->temporaryFiles as $path) {
            if (is_file($path)) {
                @unlink($path);
            }
        }
        $this->temporaryFiles = [];

        parent::tearDown();
    }

    public function testOpenLocalElpActionReturnsMeaningfulErrorWhenSessionActive(): void
    {
        $user = $this->createUser('no-force');
        $fixture = $this->copyFixtureElp();

        $initialCheck = $this->odeService->checkLocalOdeFile(
            $fixture['fileName'],
            $fixture['filePath'],
            $user,
            true
        );
        self::assertSame('OK', $initialCheck['responseMessage'] ?? null);
        $previousSessionId = $initialCheck['odeSessionId'] ?? null;
        self::assertIsString($previousSessionId);

        $this->odeService->createElpStructureAndCurrentOdeUser(
            $fixture['fileName'],
            $user,
            $user,
            '127.0.0.1',
            true,
            $initialCheck
        );

        $this->client->loginUser($user);

        $this->client->request(
            'POST',
            '/api/ode-management/odes/ode/local/elp/open',
            [
                'odeFileName' => $fixture['fileName'],
                'odeFilePath' => $fixture['filePath'],
                'forceCloseOdeUserPreviousSession' => '0',
            ]
        );

        self::assertResponseIsSuccessful();

        $payload = json_decode(
            $this->client->getResponse()->getContent(),
            true,
            512,
            JSON_THROW_ON_ERROR
        );

        self::assertSame(
            'error: user already has an open session',
            $payload['responseMessage'] ?? null
        );

        $this->odeService->closeOdeSession($previousSessionId, 0, $user);
    }

    public function testOpenLocalElpActionClosesPreviousSessionWhenForcedViaJson(): void
    {
        $user = $this->createUser('force-json');
        $fixture = $this->copyFixtureElp();

        $initialCheck = $this->odeService->checkLocalOdeFile(
            $fixture['fileName'],
            $fixture['filePath'],
            $user,
            true
        );
        self::assertSame('OK', $initialCheck['responseMessage'] ?? null);
        $previousSessionId = $initialCheck['odeSessionId'] ?? null;
        self::assertNotNull($previousSessionId, 'Expected fixture bootstrap to provide a session id');

        $this->odeService->createElpStructureAndCurrentOdeUser(
            $fixture['fileName'],
            $user,
            $user,
            '127.0.0.1',
            true,
            $initialCheck
        );

        $this->client->loginUser($user);

        $payload = [
            'odeFileName' => $fixture['fileName'],
            'odeFilePath' => $fixture['filePath'],
            'forceCloseOdeUserPreviousSession' => true,
        ];

        $this->client->request(
            'POST',
            '/api/ode-management/odes/ode/local/elp/open',
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_ACCEPT' => 'application/json',
            ],
            json_encode($payload, JSON_THROW_ON_ERROR)
        );

        self::assertResponseIsSuccessful();

        $responsePayload = json_decode(
            $this->client->getResponse()->getContent(),
            true,
            512,
            JSON_THROW_ON_ERROR
        );

        self::assertSame('OK', $responsePayload['responseMessage'] ?? null);
        self::assertArrayHasKey('odeSessionId', $responsePayload);
        self::assertIsString($responsePayload['odeSessionId']);
        self::assertNotSame($previousSessionId, $responsePayload['odeSessionId']);

        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $staleSession = $currentOdeUsersRepository->findOneBy(['odeSessionId' => $previousSessionId]);
        self::assertNull($staleSession, 'Previous session should be closed when forcing the open action');

        $this->odeService->closeOdeSession($responsePayload['odeSessionId'], 0, $user);
    }

    /**
     * Regression test: Opening the same file multiple times with force close
     * should NOT leave orphaned components from previous sessions.
     *
     * This test prevents the bug where components from old sessions remained
     * in the database, causing duplicate exports.
     */
    public function testMultipleOpensWithForceCloseDoNotLeaveOrphanedComponents(): void
    {
        $user = $this->createUser('multiple-opens');
        $fixture = $this->copyFixtureElp();

        $this->client->loginUser($user);

        $sessionIds = [];

        // Open the same file 3 times with force close
        for ($i = 0; $i < 3; $i++) {
            $this->client->request(
                'POST',
                '/api/ode-management/odes/ode/local/elp/open',
                [
                    'odeFileName' => $fixture['fileName'],
                    'odeFilePath' => $fixture['filePath'],
                    'forceCloseOdeUserPreviousSession' => $i > 0 ? '1' : '0',
                ]
            );

            self::assertResponseIsSuccessful();

            $response = json_decode(
                $this->client->getResponse()->getContent(),
                true,
                512,
                JSON_THROW_ON_ERROR
            );

            self::assertSame('OK', $response['responseMessage'] ?? null);
            self::assertArrayHasKey('odeSessionId', $response);

            $sessionIds[] = $response['odeSessionId'];
        }

        // Verify we got 3 different sessions
        self::assertCount(3, array_unique($sessionIds));

        $currentSessionId = end($sessionIds);

        // CRITICAL: Only the current session should have active components
        $componentsRepo = $this->entityManager->getRepository(OdeComponentsSync::class);

        // Count components for current session
        $currentComponents = $componentsRepo->findBy(['odeSessionId' => $currentSessionId]);
        self::assertGreaterThan(0, count($currentComponents), 'Current session must have components');

        // Verify previous sessions have NO components (they should be cleaned up)
        foreach ($sessionIds as $oldSessionId) {
            if ($oldSessionId === $currentSessionId) {
                continue;
            }

            $oldComponents = $componentsRepo->findBy(['odeSessionId' => $oldSessionId]);
            self::assertCount(
                0,
                $oldComponents,
                sprintf(
                    'Previous session %s should have NO components after force close, but found %d. '.
                    'This indicates the bug has regressed.',
                    $oldSessionId,
                    count($oldComponents)
                )
            );
        }

        // Cleanup
        $this->odeService->closeOdeSession($currentSessionId, 0, $user);
    }

    /**
     * Test that POST requests with form data (not JSON) work correctly
     * and don't trigger hydrateRequestBody issues
     */
    public function testOpenLocalElpWithFormDataDoesNotHydrateBody(): void
    {
        $user = $this->createUser('form-data');
        $fixture = $this->copyFixtureElp();

        $this->client->loginUser($user);

        // Send as regular POST form data (application/x-www-form-urlencoded)
        $this->client->request(
            'POST',
            '/api/ode-management/odes/ode/local/elp/open',
            [
                'odeFileName' => $fixture['fileName'],
                'odeFilePath' => $fixture['filePath'],
                'forceCloseOdeUserPreviousSession' => '1',
            ]
        );

        self::assertResponseIsSuccessful();

        $response = json_decode(
            $this->client->getResponse()->getContent(),
            true,
            512,
            JSON_THROW_ON_ERROR
        );

        self::assertSame('OK', $response['responseMessage'] ?? null);
        self::assertArrayHasKey('odeSessionId', $response);

        // Cleanup
        $this->odeService->closeOdeSession($response['odeSessionId'], 0, $user);
    }

    /**
     * @return array{fileName: string, filePath: string}
     */
    private function copyFixtureElp(): array
    {
        $sourcePath = realpath(__DIR__.'/../../../Fixtures/basic-example.elp');
        self::assertNotFalse($sourcePath, 'Missing fixture: basic-example.elp');

        $targetPath = sys_get_temp_dir().'/basic-example-'.uniqid('', true).'.elp';
        $copied = copy($sourcePath, $targetPath);
        self::assertTrue($copied, 'Failed to copy fixture to temporary path');

        $this->temporaryFiles[] = $targetPath;

        return [
            'fileName' => basename($sourcePath),
            'filePath' => $targetPath,
        ];
    }

    private function createUser(string $suffix): User
    {
        $email = sprintf('open-local-elp-%s@exelearning.test', $suffix);
        $userId = sprintf('open_local_elp_%s', bin2hex(random_bytes(4)));

        return TestDatabaseHelper::createUser($this->entityManager, $email, $userId, '1234');
    }
}
