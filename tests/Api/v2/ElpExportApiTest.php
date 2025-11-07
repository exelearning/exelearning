<?php

namespace App\Tests\Api\v2;

use App\Entity\net\exelearning\Entity\User;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;

/**
 * Integration tests for POST /api/v2/export/* endpoints.
 */
class ElpExportApiTest extends WebTestCase
{
    private string $userEmail;
    private string $userPassword;

    protected function setUp(): void
    {
        $client = static::createClient();
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();
        $hasher = $container->get('security.user_password_hasher');

        // Create regular user
        $user = new User();
        $this->userEmail = 'export_user_'.uniqid().'@example.com';
        $this->userPassword = 'ExportPwd123!';
        $user->setEmail($this->userEmail);
        $user->setUserId('usr_'.uniqid());
        $user->setPassword($hasher->hashPassword($user, $this->userPassword));
        $user->setIsLopdAccepted(true);
        $user->setRoles(['ROLE_USER']);
        $em->persist($user);
        $em->flush();

        static::ensureKernelShutdown();
    }

    private function loginClient(\Symfony\Bundle\FrameworkBundle\KernelBrowser $client): void
    {
        $client->request('POST', '/login_check', [
            'email' => $this->userEmail,
            'password' => $this->userPassword,
        ]);
        $this->assertSame(302, $client->getResponse()->getStatusCode());
    }

    public function testExportElpRequiresAuthentication(): void
    {
        $client = static::createClient();

        // Don't call loginClient - test unauthenticated access
        $client->request('POST', '/api/v2/export/html5', [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        // Without login, should redirect to login page
        $this->assertSame(302, $client->getResponse()->getStatusCode());
    }

    #[DataProvider('exportFormatProvider')]
    public function testExportEndpointsExist(string $format): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        // Make a request without file to check endpoint exists
        $client->request('POST', sprintf('/api/v2/export/%s', $format), [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'multipart/form-data',
        ]);

        // Should fail with missing file, not 404
        $this->assertSame(400, $client->getResponse()->getStatusCode());
        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('MISSING_FILE', $response['code'] ?? null);
    }

    public static function exportFormatProvider(): array
    {
        return [
            'elp' => ['elp'],
            'html5' => ['html5'],
            'html5-sp' => ['html5-sp'],
            'scorm12' => ['scorm12'],
            'scorm2004' => ['scorm2004'],
            'ims' => ['ims'],
            'epub3' => ['epub3'],
        ];
    }

    public function testExportWithBaseUrl(): void
    {
        $this->markTestSkipped('This test requires significant time and resources');

        $client = static::createClient();
        $this->loginClient($client);

        // Use actual ELP file from fixtures
        $testElpPath = __DIR__.'/../Fixtures/basic-example.elp';
        if (!file_exists($testElpPath)) {
            $this->markTestSkipped('Test ELP file not found: '.$testElpPath);
        }

        $uploadedFile = new UploadedFile(
            $testElpPath,
            'basic-example.elp',
            'application/zip',
            null,
            true
        );

        $client->request('POST', '/api/v2/export/html5', [
            'baseUrl' => 'https://cdn.example.com/content',
        ], ['file' => $uploadedFile], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(201, $client->getResponse()->getStatusCode());
        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('success', $response['status'] ?? null);
        $this->assertSame('html5', $response['format'] ?? null);
        $this->assertArrayHasKey('files', $response);
    }

    public function testExportWithoutDownloadReturnsJson(): void
    {
        $this->markTestSkipped('This test requires significant time and resources');

        $client = static::createClient();
        $this->loginClient($client);

        // Use actual ELP file from fixtures
        $testElpPath = __DIR__.'/../Fixtures/basic-example.elp';
        if (!file_exists($testElpPath)) {
            $this->markTestSkipped('Test ELP file not found: '.$testElpPath);
        }

        $uploadedFile = new UploadedFile(
            $testElpPath,
            'basic-example.elp',
            'application/zip',
            null,
            true
        );

        // Export without download parameter
        $client->request('POST', '/api/v2/export/html5', [], ['file' => $uploadedFile], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(201, $client->getResponse()->getStatusCode());
        $this->assertStringContainsString('application/json', $client->getResponse()->headers->get('Content-Type'));

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('success', $response['status'] ?? null);
        $this->assertSame('html5', $response['format'] ?? null);
        $this->assertArrayHasKey('files', $response);
        $this->assertArrayHasKey('filesCount', $response);
        $this->assertArrayHasKey('exportPath', $response);
    }

    public function testExportHtml5WithDownloadReturnsZip(): void
    {
        $this->markTestSkipped('This test requires significant time and resources; enable locally with fixtures');

        $client = static::createClient();
        $this->loginClient($client);

        // Use actual ELP file from fixtures
        $testElpPath = __DIR__.'/../Fixtures/basic-example.elp';
        if (!file_exists($testElpPath)) {
            $this->markTestSkipped('Test ELP file not found: '.$testElpPath);
        }

        $uploadedFile = new UploadedFile(
            $testElpPath,
            'basic-example.elp',
            'application/zip',
            null,
            true
        );

        // Export with download=1 parameter
        $client->request(
            'POST',
            '/api/v2/export/html5?download=1',
            [],
            ['file' => $uploadedFile],
            ['HTTP_ACCEPT' => 'application/json']
        );

        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $this->assertStringContainsString('application/zip', $client->getResponse()->headers->get('Content-Type'));
        $this->assertStringContainsString('attachment', $client->getResponse()->headers->get('Content-Disposition'));
        $this->assertStringContainsString('export_html5_', $client->getResponse()->headers->get('Content-Disposition'));
        $this->assertStringContainsString('.zip', $client->getResponse()->headers->get('Content-Disposition'));

        // Verify response body is not empty and is binary data
        $content = $client->getResponse()->getContent();
        $this->assertNotEmpty($content);
        $this->assertGreaterThan(0, strlen($content));
    }

    public function testExportElpWithDownloadReturnsElpArchive(): void
    {
        $this->markTestSkipped('This test requires significant time and resources; enable locally with fixtures');

        $client = static::createClient();
        $this->loginClient($client);

        // Use actual ELP file from fixtures
        $testElpPath = __DIR__.'/../Fixtures/basic-example.elp';
        if (!file_exists($testElpPath)) {
            $this->markTestSkipped('Test ELP file not found: '.$testElpPath);
        }

        $uploadedFile = new UploadedFile(
            $testElpPath,
            'basic-example.elp',
            'application/zip',
            null,
            true
        );

        // Export to ELP format with download=1
        $client->request(
            'POST',
            '/api/v2/export/elp?download=1',
            [],
            ['file' => $uploadedFile],
            ['HTTP_ACCEPT' => 'application/json']
        );

        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $this->assertStringContainsString('application/zip', $client->getResponse()->headers->get('Content-Type'));
        $this->assertStringContainsString('attachment', $client->getResponse()->headers->get('Content-Disposition'));
        $this->assertStringContainsString('export_elp_', $client->getResponse()->headers->get('Content-Disposition'));

        // Verify response body is binary data
        $content = $client->getResponse()->getContent();
        $this->assertNotEmpty($content);
        $this->assertGreaterThan(0, strlen($content));
    }

    public function testExportScorm12WithDownloadReturnsZip(): void
    {
        $this->markTestSkipped('This test requires significant time and resources; enable locally with fixtures');

        $client = static::createClient();
        $this->loginClient($client);

        // Use actual ELP file from fixtures
        $testElpPath = __DIR__.'/../Fixtures/basic-example.elp';
        if (!file_exists($testElpPath)) {
            $this->markTestSkipped('Test ELP file not found: '.$testElpPath);
        }

        $uploadedFile = new UploadedFile(
            $testElpPath,
            'basic-example.elp',
            'application/zip',
            null,
            true
        );

        // Export to SCORM 1.2 format with download=1
        $client->request(
            'POST',
            '/api/v2/export/scorm12?download=1',
            [],
            ['file' => $uploadedFile],
            ['HTTP_ACCEPT' => 'application/json']
        );

        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $this->assertStringContainsString('application/zip', $client->getResponse()->headers->get('Content-Type'));
        $this->assertStringContainsString('attachment', $client->getResponse()->headers->get('Content-Disposition'));
        $this->assertStringContainsString('export_scorm12_', $client->getResponse()->headers->get('Content-Disposition'));

        // Verify response body is binary data (ZIP should contain SCORM package)
        $content = $client->getResponse()->getContent();
        $this->assertNotEmpty($content);
        $this->assertGreaterThan(0, strlen($content));
    }
}
