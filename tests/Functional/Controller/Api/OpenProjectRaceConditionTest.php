<?php
declare(strict_types=1);

namespace App\Tests\Functional\Controller\Api;

use App\Entity\net\exelearning\Entity\User;
use App\Service\net\exelearning\Service\Api\OdeServiceInterface;
use App\Tests\Helper\TestDatabaseHelper;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Integration test for the race condition fix when opening existing projects.
 *
 * This test verifies that:
 * 1. Opening an existing project properly initializes the structure
 * 2. Immediately after opening, structure can be queried without errors
 * 3. iDevices can be added/saved immediately without 500 errors
 * 4. No "identifier is missing" errors occur
 * 5. No "setIconName() null argument" errors occur
 *
 * Regression test for:
 * - Race condition between backend persistence and frontend API calls
 * - Missing flush()/clear() in OdeApiController after createElpStructureAndCurrentOdeUser()
 * - Nullable type mismatch in OdePagStructureSync::setIconName()
 * - Missing validation in CurrentOdeUsersApiController::updateCurrentOdeUserFlagAction()
 */
class OpenProjectRaceConditionTest extends WebTestCase
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

    /**
     * Test opening a project and immediately querying the structure.
     * Before the fix, this would sometimes fail due to race conditions.
     */
    public function testOpenProjectAndImmediatelyGetStructure(): void
    {
        $user = $this->createUser('structure');
        $fixture = $this->copyFixtureElp();

        $this->client->loginUser($user);

        // Open the project using the correct endpoint
        $this->client->request(
            'POST',
            '/api/ode-management/odes/ode/local/elp/open',
            [
                'odeFileName' => $fixture['fileName'],
                'odeFilePath' => $fixture['filePath'],
                'forceCloseOdeUserPreviousSession' => '1',
            ]
        );

        $response = $this->client->getResponse();
        $this->assertSame(200, $response->getStatusCode(), 'Project should open successfully: ' . $response->getContent());

        $data = json_decode($response->getContent(), true);
        $this->assertIsArray($data, 'Response should be valid JSON');
        $this->assertArrayHasKey('odeSessionId', $data, 'Response should contain session ID');
        $this->assertArrayHasKey('odeVersionId', $data, 'Response should contain version ID');

        $sessionId = $data['odeSessionId'];
        $versionId = $data['odeVersionId'];

        // CRITICAL: Immediately query the structure without any delay
        // Before the fix, this would sometimes fail with "identifier is missing" errors
        // because the backend hadn't finished committing the data
        $this->client->request(
            'GET',
            "/api/nav-structure-management/nav-structures/{$versionId}/{$sessionId}/nav/structure/get",
            [],
            [],
            ['HTTP_X-Requested-With' => 'XMLHttpRequest']
        );

        $structureResponse = $this->client->getResponse();
        $this->assertSame(
            200,
            $structureResponse->getStatusCode(),
            'Structure should be queryable immediately after opening: ' . $structureResponse->getContent()
        );

        $structureData = json_decode($structureResponse->getContent(), true);
        $this->assertIsArray($structureData, 'Structure response should be valid JSON');
        $this->assertArrayHasKey('structure', $structureData, 'Response should have structure key');

        $structure = $structureData['structure'];
        $this->assertNotEmpty($structure, 'Structure should not be empty');

        // Verify the structure has the expected fields
        $this->assertArrayHasKey('id', $structure[0] ?? [], 'Structure should have navigation ID');
        $this->assertArrayHasKey('pageId', $structure[0] ?? [], 'Structure should have page ID');

        // Cleanup
        $this->odeService->closeOdeSession($sessionId, 0, $user);
    }

    /**
     * Test opening a project and immediately adding an iDevice.
     * Before the fix, this would fail with:
     * - "setIconName() expects string, null given"
     * - "identifier is missing for OdeNavStructureSync"
     */
    public function testOpenProjectAndImmediatelyAddIDevice(): void
    {
        $user = $this->createUser('idevice');
        $fixture = $this->copyFixtureElp();

        $this->client->loginUser($user);

        // Open the project using the correct endpoint
        $this->client->request(
            'POST',
            '/api/ode-management/odes/ode/local/elp/open',
            [
                'odeFileName' => $fixture['fileName'],
                'odeFilePath' => $fixture['filePath'],
                'forceCloseOdeUserPreviousSession' => '1',
            ]
        );

        $this->assertSame(200, $this->client->getResponse()->getStatusCode(), 'Project should open successfully: ' . $this->client->getResponse()->getContent());

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $sessionId = $data['odeSessionId'];
        $versionId = $data['odeVersionId'];

        // Get the structure to find a page ID
        $this->client->request(
            'GET',
            "/api/nav-structure-management/nav-structures/{$versionId}/{$sessionId}/nav/structure/get",
            [],
            [],
            ['HTTP_X-Requested-With' => 'XMLHttpRequest']
        );

        $this->assertSame(200, $this->client->getResponse()->getStatusCode());
        $structureData = json_decode($this->client->getResponse()->getContent(), true);
        $structure = $structureData['structure'] ?? [];
        $this->assertNotEmpty($structure, 'Structure should have at least one page');

        $pageId = $structure[0]['pageId'];
        $navId = $structure[0]['id'];

        // CRITICAL: Immediately try to add an iDevice without any delay
        // Before the fix, this would fail with 500 errors
        $ideviceData = [
            'odePageId' => $pageId,
            'odeNavId' => $navId,
            'odeSessionId' => $sessionId,
            'odeVersionId' => $versionId,
            'ideviceName' => 'FreeText',
            'ideviceTitle' => 'Test iDevice',
            'ideviceClass' => 'FreeTextIdevice',
        ];

        $this->client->request(
            'PUT',
            '/api/idevice-management/idevices/data/save',
            [],
            [],
            [
                'HTTP_X-Requested-With' => 'XMLHttpRequest',
                'CONTENT_TYPE' => 'application/json',
            ],
            json_encode($ideviceData)
        );

        $saveResponse = $this->client->getResponse();
        $this->assertNotSame(
            500,
            $saveResponse->getStatusCode(),
            'iDevice save should not fail with 500 error immediately after opening project: ' . $saveResponse->getContent()
        );

        // Should be either 200 (success) or possibly 400 (validation error), but never 500 (server error)
        $this->assertContains(
            $saveResponse->getStatusCode(),
            [200, 201, 400],
            'Response should be successful or validation error, not server error: ' . $saveResponse->getContent()
        );

        // Cleanup
        $this->odeService->closeOdeSession($sessionId, 0, $user);
    }

    /**
     * Test updating current user flag immediately after opening a project.
     * Before the fix, this would fail with "identifier is missing for OdeNavStructureSync".
     */
    public function testOpenProjectAndImmediatelyUpdateUserFlag(): void
    {
        $user = $this->createUser('userflag');
        $fixture = $this->copyFixtureElp();

        $this->client->loginUser($user);

        // Open the project using the correct endpoint
        $this->client->request(
            'POST',
            '/api/ode-management/odes/ode/local/elp/open',
            [
                'odeFileName' => $fixture['fileName'],
                'odeFilePath' => $fixture['filePath'],
                'forceCloseOdeUserPreviousSession' => '1',
            ]
        );

        $this->assertSame(200, $this->client->getResponse()->getStatusCode(), 'Project should open successfully: ' . $this->client->getResponse()->getContent());

        $data = json_decode($this->client->getResponse()->getContent(), true);
        $sessionId = $data['odeSessionId'];
        $versionId = $data['odeVersionId'];

        // Get the structure to find a nav ID
        $this->client->request(
            'GET',
            "/api/nav-structure-management/nav-structures/{$versionId}/{$sessionId}/nav/structure/get",
            [],
            [],
            ['HTTP_X-Requested-With' => 'XMLHttpRequest']
        );

        $this->assertSame(200, $this->client->getResponse()->getStatusCode());
        $structureData = json_decode($this->client->getResponse()->getContent(), true);
        $structure = $structureData['structure'] ?? [];
        $this->assertNotEmpty($structure);

        $navId = $structure[0]['id'];

        // CRITICAL: Try to update user flag immediately
        // Before the fix, this would fail with "identifier is missing"
        $this->client->request(
            'POST',
            '/api/current-ode-users-management/current-ode-user/update/api/current/ode/user/flag',
            [
                'odeSessionId' => $sessionId,
                'odeNavStructureSyncId' => $navId,
                'flag' => 'isEditing',
                'value' => 'true',
            ],
            [],
            ['HTTP_X-Requested-With' => 'XMLHttpRequest']
        );

        $flagResponse = $this->client->getResponse();

        // Should not be a 500 error
        $this->assertNotSame(
            500,
            $flagResponse->getStatusCode(),
            'User flag update should not fail with 500 error: ' . $flagResponse->getContent()
        );

        // With the fix, if navId is empty/null, we should get a 400 error, not a 500
        // If navId is valid, we should get a 200
        $this->assertContains(
            $flagResponse->getStatusCode(),
            [200, 400],
            'Response should be success or validation error, not server error: ' . $flagResponse->getContent()
        );

        // Cleanup
        $this->odeService->closeOdeSession($sessionId, 0, $user);
    }

    /**
     * @return array{fileName: string, filePath: string}
     */
    private function copyFixtureElp(): array
    {
        $sourcePath = realpath(__DIR__ . '/../../../Fixtures/basic-example.elp');
        self::assertNotFalse($sourcePath, 'Missing fixture: basic-example.elp');

        $targetPath = sys_get_temp_dir() . '/race-test-' . uniqid('', true) . '.elp';
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
        $email = sprintf('race-condition-%s@exelearning.test', $suffix);
        $userId = sprintf('race_condition_%s', bin2hex(random_bytes(4)));

        return TestDatabaseHelper::createUser($this->entityManager, $email, $userId, '1234');
    }
}
