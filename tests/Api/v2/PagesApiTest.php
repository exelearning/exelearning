<?php

namespace App\Tests\Api\v2;

use App\Entity\net\exelearning\Entity\User;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class PagesApiTest extends WebTestCase
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
        $this->email = 'pages_'.uniqid().'@example.com';
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
        $client->request('POST', '/login_check', [ 'email' => $this->email, 'password' => $this->password ]);
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


    public function testPagesCrudWithHierarchy(): void
    {
        $client = static::createClient();
        $this->login($client);

        // Create project from smallest fixture for speed
        $dst = self::putFixtureUnderFilesDir($client, 'basic-example.elp');
        $client->request('POST', '/api/v2/projects', [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['path' => $dst]));
        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $created = json_decode($client->getResponse()->getContent(), true);
        $projectId = $created['id'];

        // Create root page (no parentId)
        $client->request('POST', '/api/v2/projects/'.$projectId.'/pages', [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['title' => 'Root']));
        $this->assertContains($client->getResponse()->getStatusCode(), [200,201], $client->getResponse()->getContent());
        $root = json_decode($client->getResponse()->getContent(), true);
        $rootId = $root['id'];

        // List root pages
        $client->request('GET', '/api/v2/projects/'.$projectId.'/pages', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $roots = json_decode($client->getResponse()->getContent(), true);
        $this->assertNotEmpty($roots);
        $rootIds = array_map(fn($r) => $r['id'], $roots);
        $this->assertContains($rootId, $rootIds);

        // Create child page
        $client->request('POST', '/api/v2/projects/'.$projectId.'/pages', [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['title' => 'Child', 'parentId' => $rootId]));
        $this->assertContains($client->getResponse()->getStatusCode(), [200,201], $client->getResponse()->getContent());
        $child = json_decode($client->getResponse()->getContent(), true);
        $childId = $child['id'];

        // Get page
        $client->request('GET', '/api/v2/projects/'.$projectId.'/pages/'.$childId, server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $page = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('Child', $page['title']);
        $this->assertSame($rootId, $page['parentId']);

        // Update page title via PATCH
        $client->request('PATCH', '/api/v2/projects/'.$projectId.'/pages/'.$childId, [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['title' => 'Child Updated']));
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $updated = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('Child Updated', $updated['title']);

        // List children under root
        $client->request('GET', '/api/v2/projects/'.$projectId.'/pages/'.$rootId.'/children', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $children = json_decode($client->getResponse()->getContent(), true);
        $this->assertNotEmpty($children);
        $ids = array_map(fn($r) => $r['id'], $children);
        $this->assertContains($childId, $ids);

        // Create a second child to test reorder and move
        $client->request('POST', '/api/v2/projects/'.$projectId.'/pages', [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['title' => 'Child2', 'parentId' => $rootId]));
        $this->assertContains($client->getResponse()->getStatusCode(), [200,201], $client->getResponse()->getContent());
        $child2 = json_decode($client->getResponse()->getContent(), true);
        $child2Id = $child2['id'];

        // Reorder children under root: put Child2 first
        $client->request('PATCH', '/api/v2/projects/'.$projectId.'/pages/'.$rootId.'/children', [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['order' => [$child2Id, $childId]]));
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $client->request('GET', '/api/v2/projects/'.$projectId.'/pages/'.$rootId.'/children', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $childrenReordered = json_decode($client->getResponse()->getContent(), true);
        $this->assertGreaterThanOrEqual(2, count($childrenReordered));
        $this->assertSame($child2Id, $childrenReordered[0]['id']);

        // Create another root and move Child2 under it at position 1
        $client->request('POST', '/api/v2/projects/'.$projectId.'/pages', [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['title' => 'AnotherRoot']));
        $this->assertContains($client->getResponse()->getStatusCode(), [200,201], $client->getResponse()->getContent());
        $anotherRoot = json_decode($client->getResponse()->getContent(), true);
        $anotherRootId = $anotherRoot['id'];

        $client->request('PATCH', '/api/v2/projects/'.$projectId.'/pages/'.$child2Id.'/move', [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['parentId' => $anotherRootId, 'position' => 1]));
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $moved = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame($anotherRootId, $moved['parentId']);

        // Verify it no longer appears under the old root
        $client->request('GET', '/api/v2/projects/'.$projectId.'/pages/'.$rootId.'/children', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $childrenAfterMove = json_decode($client->getResponse()->getContent(), true);
        $idsAfterMove = array_map(fn($r) => $r['id'], $childrenAfterMove);
        $this->assertNotContains($child2Id, $idsAfterMove);

        // And now appears under the new root
        $client->request('GET', '/api/v2/projects/'.$projectId.'/pages/'.$anotherRootId.'/children', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $childrenInNewRoot = json_decode($client->getResponse()->getContent(), true);
        $idsInNewRoot = array_map(fn($r) => $r['id'], $childrenInNewRoot);
        $this->assertContains($child2Id, $idsInNewRoot);

        // Root listing should not include child nodes
        $client->request('GET', '/api/v2/projects/'.$projectId.'/pages', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $roots = json_decode($client->getResponse()->getContent(), true);
        $rootIds = array_map(fn($r) => $r['id'], $roots);
        $this->assertNotContains($childId, $rootIds);

        // Delete child
        $client->request('DELETE', '/api/v2/projects/'.$projectId.'/pages/'.$childId, server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(204, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());

        // Invalid parent error (bad parentId)
        $client->request('POST', '/api/v2/projects/'.$projectId.'/pages', [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['title' => 'Orphan', 'parentId' => 'non-existent']));
        $this->assertSame(400, $client->getResponse()->getStatusCode());
        $err = json_decode($client->getResponse()->getContent(), true);
        $this->assertStringContainsString('Parent node not found', $err['detail'] ?? json_encode($err));
    }
}
