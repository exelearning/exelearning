<?php

declare(strict_types=1);

namespace App\Tests\Api\v2;

use App\Entity\net\exelearning\Entity\User;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;

final class ProjectPagesControllerTest extends WebTestCase
{
    private string $email;
    private string $password;

    protected function setUp(): void
    {
        $client    = static::createClient();
        $container = $client->getContainer();
        $em        = $container->get('doctrine')->getManager();
        $hasher    = $container->get('security.user_password_hasher');

        $u = new User();
        $this->email    = 'pages_'.uniqid().'@example.com';
        $this->password = 'PagesPwd123!';
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
        // Ajusta la ruta si tu login_check es distinta
        $client->request('POST', '/login_check', [
            'email'    => $this->email,
            'password' => $this->password,
        ]);

        // login_check suele redirigir (302) al éxito
        $this->assertSame(302, $client->getResponse()->getStatusCode());
    }

    private static function fx(string $name): string
    {
        $p = __DIR__ . '/../../Fixtures/' . $name;
        self::assertFileExists($p, 'Fixture not found: '.$name);
        $real = realpath($p);
        self::assertNotFalse($real);
        return $real;
    }

    private static function putFixtureUnderFilesDir(\Symfony\Bundle\FrameworkBundle\KernelBrowser $client, string $fixtureName): string
    {
        $container = $client->getContainer();
        $filesDir  = (string) $container->getParameter('filesdir');
        $targetDir = rtrim($filesDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'apitests' . DIRECTORY_SEPARATOR;
        if (!is_dir($targetDir)) {
            @mkdir($targetDir, 0777, true);
        }
        $src = self::fx($fixtureName);
        $dst = $targetDir . $fixtureName;
        copy($src, $dst);
        return $dst;
    }

    public function test_pages_tree_contains_linux_under_instalacion(): void
    {
        $client = static::createClient();
        $this->login($client);

        // 1) Crear el proyecto desde fixture (modo path + filesdir)
        $dst = self::putFixtureUnderFilesDir($client, 'old_manual_exe29_compressed.elp');

        $client->request(
            'POST',
            '/api/v2/projects',
            server: [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_ACCEPT'  => 'application/json',
            ],
            content: json_encode(['path' => $dst], JSON_THROW_ON_ERROR)
        );

        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $project = json_decode($client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $projectId = $project['id'] ?? null;
        $this->assertNotEmpty($projectId);

        // 2) Obtener el árbol de páginas
        $client->request('GET', "/api/v2/projects/{$projectId}/pages", server: [
            'HTTP_ACCEPT' => 'application/json',
        ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $tree = json_decode($client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertIsArray($tree);

        // 3) Localizar "Instalación de eXeLearning"
        $locator = [];
        $stack = $tree;
        while ($stack) {
            $n = array_pop($stack);
            $locator[$n['title']] = $n;
            foreach ($n['children'] ?? [] as $c) {
                $stack[] = $c;
            }
        }
        $this->assertArrayHasKey('Instalación de eXeLearning', $locator, 'Missing parent page');
        $inst = $locator['Instalación de eXeLearning'];

        // 4) Verificar que "GNU/Linux" es hijo de "Instalación de eXeLearning"
        $childTitles = array_map(static fn($c) => $c['title'], $inst['children'] ?? []);
        $this->assertContains('GNU/Linux', $childTitles, '"GNU/Linux" should be under "Instalación de eXeLearning"');
    }
}
