<?php

namespace App\Tests\Api\v2;

use App\Entity\net\exelearning\Entity\User;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;

class ProjectMultiDocumentTest extends WebTestCase
{
    private string $email;
    private string $password;

    protected function setUp(): void
    {
        $client = static::createClient();
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();
        $hasher = $container->get('security.user_password_hasher');

        $user = new User();
        $this->email = 'multi_doc_' . uniqid() . '@example.com';
        $this->password = 'MultiDocPwd123!';
        $user->setEmail($this->email);
        $user->setUserId('usr_' . uniqid());
        $user->setPassword($hasher->hashPassword($user, $this->password));
        $user->setIsLopdAccepted(true);
        $user->setRoles(['ROLE_USER']);

        $em->persist($user);
        $em->flush();

        static::ensureKernelShutdown();
    }

    private function login(\Symfony\Bundle\FrameworkBundle\KernelBrowser $client): void
    {
        $client->request('POST', '/login_check', [
            'email' => $this->email,
            'password' => $this->password,
        ]);

        $this->assertSame(302, $client->getResponse()->getStatusCode());
    }

    private function requestCurrentProject(
        \Symfony\Bundle\FrameworkBundle\KernelBrowser $client,
        array $query
    ): array {
        $qs = http_build_query($query);
        $client->request(
            'GET',
            '/api/v2/me/current-project' . ($qs ? '?' . $qs : ''),
            server: ['HTTP_ACCEPT' => 'application/json']
        );

        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());

        return json_decode($client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
    }

    private function createProject(\Symfony\Bundle\FrameworkBundle\KernelBrowser $client, string $title): array
    {
        $fixture = self::fixturePath('basic-example.elp');
        $tmp = sys_get_temp_dir().DIRECTORY_SEPARATOR.'multi-doc-'.$title.'-'.uniqid().'.elp';
        copy($fixture, $tmp);

        $file = new UploadedFile($tmp, basename($tmp), 'application/octet-stream', null, true);

        $client->request(
            'POST',
            '/api/v2/projects',
            [],
            ['file' => $file],
            [
                'HTTP_ACCEPT' => 'application/json',
            ]
        );

        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());

        $payload = json_decode($client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertNotEmpty($payload['id'] ?? null);

        return $payload;
    }

    private function openProjectSession(
        \Symfony\Bundle\FrameworkBundle\KernelBrowser $client,
        string $projectId
    ): array {
        $seed = strtoupper(bin2hex(random_bytes(10)));

        $router = $client->getContainer()->get('router');
        $path = $router->generate('api_odes_ode_elp_open');

        $client->request(
            'POST',
            $path,
            [
                'projectId' => $projectId,
                'odeSessionId' => $seed,
                'allowParallelSessions' => '1',
            ],
            server: ['HTTP_ACCEPT' => 'application/json']
        );

        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());

        $data = json_decode($client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame('OK', $data['responseMessage'] ?? null);

        return $data;
    }

    private static function fixturePath(string $name): string
    {
        $path = __DIR__.'/../../Fixtures/'.$name;
        self::assertFileExists($path, 'Fixture not found: '.$name);
        $real = realpath($path);
        self::assertNotFalse($real);

        return $real;
    }

    public function testForceNewSessionCreatesUniqueDocuments(): void
    {
        $client = static::createClient();
        $this->login($client);

        $first = $this->requestCurrentProject($client, ['forceNewSession' => 1]);
        $second = $this->requestCurrentProject($client, ['forceNewSession' => 1]);

        $firstOde = $first['currentOdeUsers']['odeId'] ?? null;
        $secondOde = $second['currentOdeUsers']['odeId'] ?? null;
        $firstSession = $first['currentOdeUsers']['odeSessionId'] ?? null;
        $secondSession = $second['currentOdeUsers']['odeSessionId'] ?? null;

        $this->assertNotEmpty($firstOde);
        $this->assertNotEmpty($secondOde);
        $this->assertNotEmpty($firstSession);
        $this->assertNotEmpty($secondSession);
        $this->assertNotSame($firstOde, $secondOde, 'Each forced session should create a distinct project');
        $this->assertNotSame($firstSession, $secondSession, 'Each forced session should have a unique session id');
    }

    public function testExplicitSessionReuse(): void
    {
        $client = static::createClient();
        $this->login($client);

        $first = $this->requestCurrentProject($client, ['forceNewSession' => 1]);
        $sessionId = $first['currentOdeUsers']['odeSessionId'] ?? '';
        $projectId = $first['currentOdeUsers']['odeId'] ?? '';

        $this->assertNotEmpty($sessionId);
        $this->assertNotEmpty($projectId);

        $reloaded = $this->requestCurrentProject($client, ['odeSessionId' => $sessionId]);
        $this->assertSame($sessionId, $reloaded['currentOdeUsers']['odeSessionId'] ?? null);
        $this->assertSame($projectId, $reloaded['currentOdeUsers']['odeId'] ?? null);
    }

    public function testParallelSessionsShareProjectButHaveIndependentSessions(): void
    {
        $client = static::createClient();
        $this->login($client);

        $project = $this->createProject($client, 'Parallel Sessions');
        $projectId = $project['id'];
        $this->assertNotEmpty($projectId);

        $sessionA = $this->openProjectSession($client, $projectId);
        $sessionB = $this->openProjectSession($client, $projectId);

        $this->assertSame($projectId, $sessionA['odeId'] ?? null);
        $this->assertSame($projectId, $sessionB['odeId'] ?? null);
        $this->assertNotSame(
            $sessionA['odeSessionId'] ?? null,
            $sessionB['odeSessionId'] ?? null,
            'Parallel sessions must have distinct identifiers'
        );

        $confirmedA = $this->requestCurrentProject(
            $client,
            ['odeSessionId' => $sessionA['odeSessionId']]
        );
        $confirmedB = $this->requestCurrentProject(
            $client,
            ['odeSessionId' => $sessionB['odeSessionId']]
        );

        $this->assertSame($projectId, $confirmedA['currentOdeUsers']['odeId'] ?? null);
        $this->assertSame($projectId, $confirmedB['currentOdeUsers']['odeId'] ?? null);
    }
}
