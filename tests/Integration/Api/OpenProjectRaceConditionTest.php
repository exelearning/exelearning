<?php

namespace App\Tests\Integration\Api;

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
    private static function fx(string $name): string
    {
        $p = __DIR__ . '/../../Fixtures/' . $name;
        self::assertFileExists($p, 'Fixture not found: ' . $name);
        $real = realpath($p);
        self::assertNotFalse($real);
        return $real;
    }

    /**
     * Test opening a project and immediately querying the structure.
     * Before the fix, this would sometimes fail due to race conditions.
     */
    public function testOpenProjectAndImmediatelyGetStructure(): void
    {
        $client = static::createClient();

        // Upload and open a basic .elp file
        $fixturePath = self::fx('basic-example.elp');
        $uploadedFile = new \Symfony\Component\HttpFoundation\File\UploadedFile(
            $fixturePath,
            'test-project.elp',
            'application/zip',
            null,
            true
        );

        $client->request(
            'POST',
            '/api/ode-management/ode/open/ode/local/elp',
            [],
            ['odeLocalElp' => $uploadedFile],
            ['HTTP_X-Requested-With' => 'XMLHttpRequest']
        );

        $response = $client->getResponse();
        $this->assertSame(200, $response->getStatusCode(), 'Project should open successfully');

        $data = json_decode($response->getContent(), true);
        $this->assertIsArray($data, 'Response should be valid JSON');
        $this->assertArrayHasKey('odeSessionId', $data, 'Response should contain session ID');
        $this->assertArrayHasKey('odeVersionId', $data, 'Response should contain version ID');

        $sessionId = $data['odeSessionId'];
        $versionId = $data['odeVersionId'];

        // CRITICAL: Immediately query the structure without any delay
        // Before the fix, this would sometimes fail with "identifier is missing" errors
        // because the backend hadn't finished committing the data
        $client->request(
            'GET',
            "/api/nav-structures-management/nav-structure/{$versionId}/{$sessionId}/get",
            [],
            [],
            ['HTTP_X-Requested-With' => 'XMLHttpRequest']
        );

        $structureResponse = $client->getResponse();
        $this->assertSame(
            200,
            $structureResponse->getStatusCode(),
            'Structure should be queryable immediately after opening: ' . $structureResponse->getContent()
        );

        $structure = json_decode($structureResponse->getContent(), true);
        $this->assertIsArray($structure, 'Structure response should be valid JSON');
        $this->assertNotEmpty($structure, 'Structure should not be empty');

        // Verify the structure has the expected fields
        $this->assertArrayHasKey('odeNavId', $structure[0] ?? [], 'Structure should have navigation ID');
        $this->assertArrayHasKey('odePageId', $structure[0] ?? [], 'Structure should have page ID');
    }

    /**
     * Test opening a project and immediately adding an iDevice.
     * Before the fix, this would fail with:
     * - "setIconName() expects string, null given"
     * - "identifier is missing for OdeNavStructureSync"
     */
    public function testOpenProjectAndImmediatelyAddIDevice(): void
    {
        $client = static::createClient();

        // Upload and open a basic .elp file
        $fixturePath = self::fx('basic-example.elp');
        $uploadedFile = new \Symfony\Component\HttpFoundation\File\UploadedFile(
            $fixturePath,
            'test-project.elp',
            'application/zip',
            null,
            true
        );

        $client->request(
            'POST',
            '/api/ode-management/ode/open/ode/local/elp',
            [],
            ['odeLocalElp' => $uploadedFile],
            ['HTTP_X-Requested-With' => 'XMLHttpRequest']
        );

        $this->assertSame(200, $client->getResponse()->getStatusCode(), 'Project should open successfully');

        $data = json_decode($client->getResponse()->getContent(), true);
        $sessionId = $data['odeSessionId'];
        $versionId = $data['odeVersionId'];

        // Get the structure to find a page ID
        $client->request(
            'GET',
            "/api/nav-structures-management/nav-structure/{$versionId}/{$sessionId}/get",
            [],
            [],
            ['HTTP_X-Requested-With' => 'XMLHttpRequest']
        );

        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $structure = json_decode($client->getResponse()->getContent(), true);
        $this->assertNotEmpty($structure, 'Structure should have at least one page');

        $pageId = $structure[0]['odePageId'];
        $navId = $structure[0]['odeNavId'];

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

        $client->request(
            'POST',
            '/api/idevice-management/idevices/data/save',
            [],
            [],
            [
                'HTTP_X-Requested-With' => 'XMLHttpRequest',
                'CONTENT_TYPE' => 'application/json',
            ],
            json_encode($ideviceData)
        );

        $saveResponse = $client->getResponse();
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
    }

    /**
     * Test updating current user flag immediately after opening a project.
     * Before the fix, this would fail with "identifier is missing for OdeNavStructureSync".
     */
    public function testOpenProjectAndImmediatelyUpdateUserFlag(): void
    {
        $client = static::createClient();

        // Upload and open a basic .elp file
        $fixturePath = self::fx('basic-example.elp');
        $uploadedFile = new \Symfony\Component\HttpFoundation\File\UploadedFile(
            $fixturePath,
            'test-project.elp',
            'application/zip',
            null,
            true
        );

        $client->request(
            'POST',
            '/api/ode-management/ode/open/ode/local/elp',
            [],
            ['odeLocalElp' => $uploadedFile],
            ['HTTP_X-Requested-With' => 'XMLHttpRequest']
        );

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $data = json_decode($client->getResponse()->getContent(), true);
        $sessionId = $data['odeSessionId'];
        $versionId = $data['odeVersionId'];

        // Get the structure to find a nav ID
        $client->request(
            'GET',
            "/api/nav-structures-management/nav-structure/{$versionId}/{$sessionId}/get",
            [],
            [],
            ['HTTP_X-Requested-With' => 'XMLHttpRequest']
        );

        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $structure = json_decode($client->getResponse()->getContent(), true);
        $this->assertNotEmpty($structure);

        $navId = $structure[0]['odeNavId'];

        // CRITICAL: Try to update user flag immediately
        // Before the fix, this would fail with "identifier is missing"
        $client->request(
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

        $flagResponse = $client->getResponse();

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
    }
}
