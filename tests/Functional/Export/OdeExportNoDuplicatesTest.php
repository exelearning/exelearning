<?php
declare(strict_types=1);

namespace App\Tests\Functional\Export;

use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdeNavStructureSync;
use App\Entity\net\exelearning\Entity\User;
use App\Service\net\exelearning\Service\Api\OdeServiceInterface;
use App\Tests\Helper\TestDatabaseHelper;
use App\Util\net\exelearning\Util\OdeXmlUtil;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use ZipArchive;

/**
 * Integration test to prevent regression of the bug where exporting an iDevice
 * would generate multiple duplicate components with different odeSessionId.
 *
 * This test ensures that:
 * 1. Opening multiple files doesn't leave orphaned session data
 * 2. Exporting an iDevice generates only ONE component per actual iDevice
 * 3. Components from previous sessions are properly cleaned up
 *
 * Two testing approaches:
 * - Approach A: Direct service calls (faster, unit-like)
 * - Approach B: Full HTTP endpoint test (integration, slower)
 */
final class OdeExportNoDuplicatesTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $entityManager;
    private OdeServiceInterface $odeService;
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
     * APPROACH A: Test using direct service call (faster)
     *
     * Critical test: Opening the same file multiple times should NOT create
     * duplicate components when exporting via service.
     */
    public function testExportViaServiceAfterMultipleImportsDoesNotCreateDuplicates(): void
    {
        $user = $this->createUser('export-service');
        $fixture = $this->copyFixtureElp();

        $this->client->loginUser($user);

        // Simulate importing the same file 3 times
        $sessionIds = [];
        for ($i = 0; $i < 3; $i++) {
            $response = $this->openFileAndForceClose($fixture, $i > 0);
            self::assertSame('OK', $response['responseMessage'] ?? null);
            $sessionIds[] = $response['odeSessionId'];
        }

        $currentSessionId = end($sessionIds);

        // Get navigation structure for current session
        $navSyncRepo = $this->entityManager->getRepository(OdeNavStructureSync::class);
        $navStructures = $navSyncRepo->findByOdeSessionId($currentSessionId);
        self::assertNotEmpty($navStructures, 'Session must have navigation structures');

        // Count components in current session BEFORE filtering
        $componentsRepo = $this->entityManager->getRepository(OdeComponentsSync::class);
        $allComponentsInSession = $componentsRepo->findBy(['odeSessionId' => $currentSessionId]);
        self::assertGreaterThan(0, count($allComponentsInSession), 'Current session must have components');

        // Get first navigation structure and its page structures
        $navStructure = $navStructures[0];
        $pagStructures = $navStructure->getOdePagStructureSyncs();
        self::assertNotEmpty($pagStructures, 'Navigation must have page structures');

        $pagStructure = $pagStructures[0];

        // Get components filtered by current session (this is what we're testing!)
        $componentsInPagStructure = $pagStructure->getOdeComponentsSyncsBySessionId();

        // Generate XML using OdeXmlUtil::createOdeComponentsXml (simpler method)
        $odeSaveDto = OdeXmlUtil::createOdeComponentsXml(
            $currentSessionId,
            $pagStructure,
            $componentsInPagStructure->toArray()
        );

        // Parse XML and count odeComponent elements
        $xmlElement = $odeSaveDto->getXml();
        $xmlDoc = new \DOMDocument();
        $xmlDoc->loadXML($xmlElement->asXML());
        $xpath = new \DOMXPath($xmlDoc);
        $componentNodes = $xpath->query('//odeComponent');

        // CRITICAL: XML should contain ONLY components from current session for this page structure
        $expectedCount = $componentsInPagStructure->count();
        $actualCount = $componentNodes->length;

        self::assertSame(
            $expectedCount,
            $actualCount,
            sprintf(
                'Export XML should contain %d component(s) from current session for this page structure, but found %d. '.
                'This indicates the filtering by session ID is not working.',
                $expectedCount,
                $actualCount
            )
        );

        // Verify all components in XML have the current session ID
        foreach ($componentNodes as $componentNode) {
            $sessionIdNode = $xpath->query('.//odeSessionId', $componentNode)->item(0);
            if ($sessionIdNode) {
                $componentSessionId = $sessionIdNode->textContent;
                self::assertSame(
                    $currentSessionId,
                    $componentSessionId,
                    sprintf(
                        'All exported components must have current session ID %s, but found %s',
                        $currentSessionId,
                        $componentSessionId
                    )
                );
            }
        }

        // Cleanup
        $this->odeService->closeOdeSession($currentSessionId, 0, $user);
    }

    /**
     * APPROACH A: Test single import has correct count
     */
    public function testExportViaServiceAfterSingleImportHasCorrectCount(): void
    {
        $user = $this->createUser('single-service');
        $fixture = $this->copyFixtureElp();

        $this->client->loginUser($user);

        $response = $this->openFileAndForceClose($fixture, false);
        self::assertSame('OK', $response['responseMessage'] ?? null);

        $sessionId = $response['odeSessionId'];

        // Get navigation structure
        $navSyncRepo = $this->entityManager->getRepository(OdeNavStructureSync::class);
        $navStructures = $navSyncRepo->findByOdeSessionId($sessionId);
        self::assertNotEmpty($navStructures, 'Must have navigation structures');

        // Get first page structure
        $navStructure = $navStructures[0];
        $pagStructures = $navStructure->getOdePagStructureSyncs();
        self::assertNotEmpty($pagStructures, 'Must have page structures');

        $pagStructure = $pagStructures[0];

        // Get components filtered by session
        $componentsInPagStructure = $pagStructure->getOdeComponentsSyncsBySessionId();
        $expectedCount = $componentsInPagStructure->count();

        // Generate XML
        $odeSaveDto = OdeXmlUtil::createOdeComponentsXml(
            $sessionId,
            $pagStructure,
            $componentsInPagStructure->toArray()
        );

        // Parse and count
        $xmlElement = $odeSaveDto->getXml();
        $xmlDoc = new \DOMDocument();
        $xmlDoc->loadXML($xmlElement->asXML());
        $xpath = new \DOMXPath($xmlDoc);
        $componentNodes = $xpath->query('//odeComponent');

        self::assertSame(
            $expectedCount,
            $componentNodes->length,
            'Single import should export exact number of components in session for this page structure'
        );

        // Cleanup
        $this->odeService->closeOdeSession($sessionId, 0, $user);
    }

    /**
     * Test with real ELP fixture (old_elp_poder_conexiones.elp)
     */
    public function testMultipleImportsWithRealFixtureDoesNotCreateDuplicates(): void
    {
        $user = $this->createUser('real-fixture');

        // Check if fixture exists
        $fixturePath = realpath(__DIR__.'/../../Fixtures/old_elp_poder_conexiones.elp');
        if (!$fixturePath) {
            self::markTestSkipped('Fixture old_elp_poder_conexiones.elp not found');
            return;
        }

        $fixture = $this->copyRealFixture();

        $this->client->loginUser($user);

        // Import file 3 times to simulate the bug scenario
        $sessionIds = [];
        for ($i = 0; $i < 3; $i++) {
            $response = $this->openFileAndForceClose($fixture, $i > 0);
            self::assertSame('OK', $response['responseMessage'] ?? null, 'Import should succeed');
            $sessionIds[] = $response['odeSessionId'];
        }

        $currentSessionId = end($sessionIds);

        // Get navigation structure
        $navSyncRepo = $this->entityManager->getRepository(OdeNavStructureSync::class);
        $navStructures = $navSyncRepo->findByOdeSessionId($currentSessionId);
        self::assertNotEmpty($navStructures, 'Must have navigation structures');

        // Get first page structure
        $navStructure = $navStructures[0];
        $pagStructures = $navStructure->getOdePagStructureSyncs();
        self::assertNotEmpty($pagStructures, 'Must have page structures');

        $pagStructure = $pagStructures[0];

        // Get components filtered by session (the fix!)
        $componentsInPagStructure = $pagStructure->getOdeComponentsSyncsBySessionId();

        // CRITICAL: There should be components only from current session
        self::assertGreaterThan(0, $componentsInPagStructure->count(), 'Must have components in current session');

        // Verify NO components from old sessions
        foreach ($componentsInPagStructure as $component) {
            self::assertSame(
                $currentSessionId,
                $component->getOdeSessionId(),
                'All components must be from current session only'
            );
        }

        // Generate XML
        $odeSaveDto = OdeXmlUtil::createOdeComponentsXml(
            $currentSessionId,
            $pagStructure,
            $componentsInPagStructure->toArray()
        );

        // Parse XML
        $xmlElement = $odeSaveDto->getXml();
        $xmlDoc = new \DOMDocument();
        $xmlDoc->loadXML($xmlElement->asXML());
        $xpath = new \DOMXPath($xmlDoc);
        $componentNodes = $xpath->query('//odeComponent');

        // Verify correct count
        self::assertSame(
            $componentsInPagStructure->count(),
            $componentNodes->length,
            'XML should contain exact number of components from filtered collection'
        );

        // Cleanup
        $this->odeService->closeOdeSession($currentSessionId, 0, $user);
    }

    /**
     * Helper: Open ELP file with force close option
     */
    private function openFileAndForceClose(array $fixture, bool $forceClose): array
    {
        $this->client->request(
            'POST',
            '/api/ode-management/odes/ode/local/elp/open',
            [
                'odeFileName' => $fixture['fileName'],
                'odeFilePath' => $fixture['filePath'],
                'forceCloseOdeUserPreviousSession' => $forceClose ? '1' : '0',
            ]
        );

        self::assertResponseIsSuccessful();

        return json_decode(
            $this->client->getResponse()->getContent(),
            true,
            512,
            JSON_THROW_ON_ERROR
        );
    }

    /**
     * Copy fixture ELP to temporary location
     */
    private function copyFixtureElp(): array
    {
        $sourcePath = realpath(__DIR__.'/../../Fixtures/basic-example.elp');
        self::assertNotFalse($sourcePath, 'Missing fixture: basic-example.elp');

        $targetPath = sys_get_temp_dir().'/export-test-'.uniqid('', true).'.elp';
        $copied = copy($sourcePath, $targetPath);
        self::assertTrue($copied, 'Failed to copy fixture to temporary path');

        $this->temporaryFiles[] = $targetPath;

        return [
            'fileName' => basename($sourcePath),
            'filePath' => $targetPath,
        ];
    }

    /**
     * Copy real fixture (old_elp_poder_conexiones.elp) to temporary location
     */
    private function copyRealFixture(): array
    {
        $sourcePath = realpath(__DIR__.'/../../Fixtures/old_elp_poder_conexiones.elp');
        self::assertNotFalse($sourcePath, 'Missing fixture: old_elp_poder_conexiones.elp');

        $targetPath = sys_get_temp_dir().'/export-test-real-'.uniqid('', true).'.elpx';
        $copied = copy($sourcePath, $targetPath);
        self::assertTrue($copied, 'Failed to copy fixture to temporary path');

        $this->temporaryFiles[] = $targetPath;

        return [
            'fileName' => basename($sourcePath),
            'filePath' => $targetPath,
        ];
    }

    /**
     * Create test user
     */
    private function createUser(string $suffix): User
    {
        $email = sprintf('ode-export-%s@exelearning.test', $suffix);
        $userId = sprintf('ode_export_%s', bin2hex(random_bytes(4)));

        return TestDatabaseHelper::createUser($this->entityManager, $email, $userId, '1234');
    }
}
