<?php

namespace App\Tests\Api\v2;

use App\Entity\net\exelearning\Entity\User;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class BlocksApiTest extends WebTestCase
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
        $this->email    = 'blocks_'.uniqid().'@example.com';
        $this->password = 'BlocksPwd123!';
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
        $client->request('POST', '/login_check', [
            'email'    => $this->email,
            'password' => $this->password,
        ]);
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

    public function testBlocksAndIDevicesCrud(): void
    {
        $client = static::createClient();
        $this->login($client);

        // Create project from a small fixture
        $dst = self::putFixtureUnderFilesDir($client, 'basic-example.elp');
        $client->request('POST', '/api/v2/projects', server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT'  => 'application/json',
        ], content: json_encode(['path' => $dst], JSON_THROW_ON_ERROR));
        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $project = json_decode($client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $projectId = $project['id'] ?? null;
        $this->assertNotEmpty($projectId);

        // Pick the first pageId from pages listing
        $client->request('GET', "/api/v2/projects/{$projectId}/pages", server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $pages = json_decode($client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertIsArray($pages);
        $this->assertNotEmpty($pages);
        $pageId = $pages[0]['id'];

        // 1) List blocks on page (always includes idevices/html/props)
        $client->request('GET', "/api/v2/projects/{$projectId}/pages/{$pageId}/blocks", server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $blocksView = json_decode($client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertArrayHasKey('blocks', $blocksView);

        // 2) Create a new block with initial iDevice
        $client->request('POST', "/api/v2/projects/{$projectId}/pages/{$pageId}/blocks", server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT'  => 'application/json',
        ], content: json_encode([
            'initialIdevice' => [
                'type' => 'text',
                'html' => '<p>A</p>',
                'props' => ['a' => 1],
                'order' => 100,
            ],
        ], JSON_THROW_ON_ERROR));
        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $createdBlock = json_decode($client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertArrayHasKey('blockId', $createdBlock);
        $blockId = $createdBlock['blockId'];
        $this->assertNotEmpty($blockId);
        $this->assertArrayHasKey('idevicesCount', $createdBlock);
        $this->assertGreaterThanOrEqual(1, (int) $createdBlock['idevicesCount']);

        // 3) Add another iDevice to the block
        $client->request('POST', "/api/v2/projects/{$projectId}/pages/{$pageId}/blocks/{$blockId}/idevices", server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT'  => 'application/json',
        ], content: json_encode([
            'type' => 'text',
            'html' => '<p>B</p>',
            'props' => ['b' => 2],
            'order' => 200,
        ], JSON_THROW_ON_ERROR));
        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $idevice2 = json_decode($client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $idevice2Id = $idevice2['ideviceId'];

        // List iDevices (always includes html/props)
        $client->request('GET', "/api/v2/projects/{$projectId}/pages/{$pageId}/blocks/{$blockId}/idevices", server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $list = json_decode($client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertArrayHasKey('idevices', $list);
        $this->assertGreaterThanOrEqual(1, count($list['idevices']));

        // 4) Patch iDevice to move it to top and change html
        $client->request('PATCH', "/api/v2/projects/{$projectId}/pages/{$pageId}/blocks/{$blockId}/idevices/{$idevice2Id}", server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT'  => 'application/json',
        ], content: json_encode([
            'html' => '<p>B2</p>',
            'order' => 1,
        ], JSON_THROW_ON_ERROR));
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());

        // Confirm new order and content
        $client->request('GET', "/api/v2/projects/{$projectId}/pages/{$pageId}/blocks/{$blockId}/idevices", server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $list2 = json_decode($client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame($idevice2Id, $list2['idevices'][0]['ideviceId']);
        $this->assertSame('<p>B2</p>', $list2['idevices'][0]['html']);

        // 5) Soft delete iDevice
        $client->request('DELETE', "/api/v2/projects/{$projectId}/pages/{$pageId}/blocks/{$blockId}/idevices/{$idevice2Id}", server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(204, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());

        $client->request('GET', "/api/v2/projects/{$projectId}/pages/{$pageId}/blocks/{$blockId}/idevices", server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $list3 = json_decode($client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        foreach (($list3['idevices'] ?? []) as $it) {
            $this->assertNotSame($idevice2Id, $it['ideviceId']);
        }

        // 6) Reorder iDevices explicitly (ensure endpoint is reachable)
        // Add another iDevice first
        $client->request('POST', "/api/v2/projects/{$projectId}/pages/{$pageId}/blocks/{$blockId}/idevices", server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT'  => 'application/json',
        ], content: json_encode([
            'type' => 'text',
            'html' => '<p>C</p>',
            'order' => 500,
        ], JSON_THROW_ON_ERROR));
        $idevice3 = json_decode($client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $idevice3Id = $idevice3['ideviceId'];

        $client->request('POST', "/api/v2/projects/{$projectId}/pages/{$pageId}/blocks/{$blockId}/idevices:reorder", server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT'  => 'application/json',
        ], content: json_encode(['order' => [$idevice3Id], 'step' => 10], JSON_THROW_ON_ERROR));
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());

        // 7) Create second block and reorder blocks
        $client->request('POST', "/api/v2/projects/{$projectId}/pages/{$pageId}/blocks", server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT'  => 'application/json',
        ], content: json_encode([
            'initialIdevice' => [ 'type' => 'text', 'html' => '<p>D</p>' ],
        ], JSON_THROW_ON_ERROR));
        $blockB = json_decode($client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $blockBId = $blockB['blockId'];

        // List blocks and move our two new blocks to the top in reverse order
        $client->request('GET', "/api/v2/projects/{$projectId}/pages/{$pageId}/blocks", server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $lb = json_decode($client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $ids = array_map(static fn($b) => $b['blockId'], $lb['blocks']);

        // Reorder request only specifies the preferred order for these two; others keep relative order after them
        $preferred = [$blockBId, $blockId];
        $client->request('POST', "/api/v2/projects/{$projectId}/pages/{$pageId}/blocks:reorder", server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT'  => 'application/json',
        ], content: json_encode(['order' => $preferred, 'step' => 100], JSON_THROW_ON_ERROR));
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());

        $client->request('GET', "/api/v2/projects/{$projectId}/pages/{$pageId}/blocks", server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $lb2 = json_decode($client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $ids2 = array_map(static fn($b) => $b['blockId'], $lb2['blocks']);
        // Expect our two blocks at the top, in the specified order
        $this->assertSame($preferred[0], $ids2[0]);
        $this->assertSame($preferred[1], $ids2[1]);

        // 8) Not found block
        $client->request('GET', "/api/v2/projects/{$projectId}/pages/{$pageId}/blocks/NOPE", server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(404, $client->getResponse()->getStatusCode());

        // 9) Delete block (soft)
        $client->request('DELETE', "/api/v2/projects/{$projectId}/pages/{$pageId}/blocks/{$blockBId}", server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(204, $client->getResponse()->getStatusCode());
        $client->request('GET', "/api/v2/projects/{$projectId}/pages/{$pageId}/blocks", server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $lb3 = json_decode($client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $ids3 = array_map(static fn($b) => $b['blockId'], $lb3['blocks']);
        $this->assertNotContains($blockBId, $ids3);
    }
}
