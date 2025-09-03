<?php

namespace App\Tests\Api\v2;

use App\Entity\net\exelearning\Entity\User;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;

class ProjectCreateApiTest extends WebTestCase
{
    private string $email;
    private string $password;

    protected function setUp(): void
    {
        $client = static::createClient();
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();
        $hasher = $container->get('security.user_password_hasher');

        $u = new User();
        $this->email = 'create_'.uniqid().'@example.com';
        $this->password = 'CreatePwd123!';
        $u->setEmail($this->email);
        $u->setUserId('usr_'.uniqid());
        $u->setPassword($hasher->hashPassword($u, $this->password));
        $u->setIsLopdAccepted(true);
        $u->setRoles(['ROLE_USER']);
        $em->persist($u);
        $em->flush();
        static::ensureKernelShutdown();
    }

    private function login(\Symfony\Bundle\FrameworkBundle\KernelBrowser $client): void
    {
        $client->request('POST', '/login_check', [ 'email' => $this->email, 'password' => $this->password ]);
        $this->assertSame(302, $client->getResponse()->getStatusCode());
    }

    private static function fx(string $name): string
    {
        $p = __DIR__.'/../../Fixtures/'.$name;
        self::assertFileExists($p, 'Fixture not found: '.$name);
        $real = realpath($p);
        self::assertNotFalse($real);
        return $real;
    }

    public function testCreateFromMultipartOk(): void
    {
        $client = static::createClient();
        $this->login($client);

        // Copy fixture to a temp path because Symfony UploadedFile::move may remove the source
        $src = self::fx('basic-example.elp');
        $tmp = sys_get_temp_dir().DIRECTORY_SEPARATOR.'basic-example-copy-'.uniqid().'.elp';
        copy($src, $tmp);
        $file = new UploadedFile($tmp, 'basic-example.elp', 'application/octet-stream', null, true);

        $client->request('POST', '/api/v2/projects', [], ['file' => $file], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $this->assertTrue($client->getResponse()->headers->has('Location'));
        $json = json_decode($client->getResponse()->getContent(), true);
        $this->assertNotEmpty($json['id'] ?? null);
        $this->assertMatchesRegularExpression('/^[A-Z0-9]{20}_[A-Z0-9]{20}\.elp$/', $json['fileName'] ?? '');
        $this->assertArrayHasKey('properties', $json);
        $this->assertNotEmpty($json['properties']['pp_title'] ?? null);
    }

    public function testCreateFromPathOk(): void
    {
        $client = static::createClient();
        $this->login($client);

        $container = $client->getContainer();
        $filesDir = (string) $container->getParameter('filesdir');
        $targetDir = rtrim($filesDir, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.'apitests'.DIRECTORY_SEPARATOR;
        if (!is_dir($targetDir)) { @mkdir($targetDir, 0777, true); }
        $src = self::fx('old_manual_exe29_compressed.elp');
        $dst = $targetDir.'old_manual_exe29_compressed.elp';
        copy($src, $dst);

        $payload = [ 'path' => $dst ];
        $client->request('POST', '/api/v2/projects', server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], content: json_encode($payload));

        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $json = json_decode($client->getResponse()->getContent(), true);
        $this->assertMatchesRegularExpression('/^[A-Z0-9]{20}_[A-Z0-9]{20}\.elp$/', $json['fileName'] ?? '');
        $this->assertArrayHasKey('properties', $json);
    }

    public function testCreateFromValuesOk(): void
    {
        $client = static::createClient();
        $this->login($client);

        $payload = [ 'values' => [ 'title' => 'Proyecto vacío', 'properties' => [ 'pp_lang' => 'es' ] ] ];
        $client->request('POST', '/api/v2/projects', server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], content: json_encode($payload));

        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $json = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('Proyecto vacío', $json['title'] ?? null);
        $this->assertArrayHasKey('properties', $json);
        $this->assertSame('es', $json['properties']['pp_lang'] ?? null);
    }

    public function testInvalidElp422(): void
    {
        $client = static::createClient();
        $this->login($client);

        $src = self::fx('node_serialized.xml');
        $tmp = sys_get_temp_dir().DIRECTORY_SEPARATOR.'node-xml-copy-'.uniqid().'.xml';
        copy($src, $tmp);
        $file = new UploadedFile($tmp, 'node_serialized.xml', 'application/xml', null, true);

        $client->request('POST', '/api/v2/projects', [], ['file' => $file], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(422, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
    }

    public function testUnsupportedMediaType415(): void
    {
        $client = static::createClient();
        $this->login($client);
        $client->request('POST', '/api/v2/projects', server: [ 'CONTENT_TYPE' => 'text/plain' ]);
        $this->assertSame(415, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
    }

    public function testMissingPayload400(): void
    {
        $client = static::createClient();
        $this->login($client);
        $client->request('POST', '/api/v2/projects', server: [ 'CONTENT_TYPE' => 'application/json' ], content: json_encode([]));
        $this->assertSame(400, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
    }
}
