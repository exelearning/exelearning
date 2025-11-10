<?php

namespace App\Tests\Api\v2;

use App\Entity\net\exelearning\Entity\User;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;

/**
 * Integration tests for POST /api/v2/convert/elp endpoint.
 */
class ElpConvertApiTest extends WebTestCase
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
        $this->userEmail = 'convert_user_'.uniqid().'@example.com';
        $this->userPassword = 'ConvertPwd123!';
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

    public function testConvertElpRequiresAuthentication(): void
    {
        $client = static::createClient();

        // Don't call loginClient - test unauthenticated access
        $client->request('POST', '/api/v2/convert/elp', [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        // Without login, should redirect to login page
        $this->assertSame(302, $client->getResponse()->getStatusCode());
    }

    public function testConvertElpRequiresMultipartFormData(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        $client->request('POST', '/api/v2/convert/elp', [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([]));

        $this->assertSame(415, $client->getResponse()->getStatusCode());
        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('UNSUPPORTED_MEDIA_TYPE', $response['code'] ?? null);
    }

    public function testConvertElpRequiresFileParameter(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        $client->request('POST', '/api/v2/convert/elp', [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'multipart/form-data',
        ]);

        $this->assertSame(400, $client->getResponse()->getStatusCode());
        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('MISSING_FILE', $response['code'] ?? null);
    }

    public function testConvertElpWithValidFile(): void
    {
        $this->markTestSkipped('This test requires significant time and resources');

        $client = static::createClient();
        $this->loginClient($client);

        // Use actual ELP file from fixtures
        $testElpPath = __DIR__.'/../Fixtures/basic-example.elp';
        if (!file_exists($testElpPath)) {
            $this->markTestSkipped('Test ELP file not found: '.$testElpPath);
        }

        // Upload file
        $uploadedFile = new UploadedFile(
            $testElpPath,
            'basic-example.elp',
            'application/zip',
            null,
            true
        );

        $client->request('POST', '/api/v2/convert/elp', [], ['file' => $uploadedFile], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(201, $client->getResponse()->getStatusCode());
        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('success', $response['status'] ?? null);
        $this->assertArrayHasKey('fileName', $response);
        $this->assertArrayHasKey('size', $response);
    }

}
