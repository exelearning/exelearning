<?php
declare(strict_types=1);

namespace App\Tests\Functional\Controller\Api;

use App\Entity\net\exelearning\Entity\OdeNavStructureSync;
use App\Entity\net\exelearning\Entity\User;
use App\Service\net\exelearning\Service\Api\OdeServiceInterface;
use App\Tests\Helper\TestDatabaseHelper;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

final class PageDownloadActionTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $entityManager;
    private OdeServiceInterface $odeService;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $container = static::getContainer();
        $this->entityManager = $container->get('doctrine')->getManager();
        $this->odeService = $container->get(OdeServiceInterface::class);
    }

    public function testDownloadPageReturnsZipMetadata(): void
    {
        $user = $this->createUser();
        $sessionData = $this->bootstrapSession($user);
        $pageId = $this->pickFirstPageId($sessionData['odeSessionId']);

        $this->client->loginUser($user);
        $this->client->jsonRequest(
            'POST',
            sprintf('/api/v2/projects/%s/pages/%s/download', $sessionData['odeId'], $pageId),
            ['format' => 'website']
        );

        self::assertResponseIsSuccessful();
        $payload = $this->decodeResponse();
        self::assertSame('OK', $payload['responseMessage'] ?? null);
        self::assertArrayHasKey('urlZipFile', $payload);
        self::assertNotEmpty($payload['urlZipFile']);
    }

    public function testDownloadPageForbiddenForDifferentUser(): void
    {
        $owner = $this->createUser('owner');
        $sessionData = $this->bootstrapSession($owner);
        $pageId = $this->pickFirstPageId($sessionData['odeSessionId']);

        $otherUser = $this->createUser('guest');
        $this->client->loginUser($otherUser);
        $this->client->jsonRequest(
            'POST',
            sprintf('/api/v2/projects/%s/pages/%s/download', $sessionData['odeId'], $pageId),
            ['format' => 'website']
        );

        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    public function testDownloadPageReturns404WhenPageMissing(): void
    {
        $user = $this->createUser('missing');
        $sessionData = $this->bootstrapSession($user);

        $this->client->loginUser($user);
        $this->client->jsonRequest(
            'POST',
            sprintf('/api/v2/projects/%s/pages/%s/download', $sessionData['odeId'], 'non-existent'),
            ['format' => 'website']
        );

        self::assertResponseStatusCodeSame(Response::HTTP_NOT_FOUND);
    }

    private function createUser(string $suffix = ''): User
    {
        $email = sprintf(
            'page-download-%s@exelearning.test',
            $suffix !== '' ? $suffix.'-'.bin2hex(random_bytes(4)) : bin2hex(random_bytes(6))
        );
        $userId = sprintf('page_user_%s', bin2hex(random_bytes(6)));

        return TestDatabaseHelper::createUser($this->entityManager, $email, $userId, '1234');
    }

    /**
     * @return array{odeId: string, odeSessionId: string}
     */
    private function bootstrapSession(User $user): array
    {
        $fixturePath = realpath(__DIR__.'/../../../Fixtures/basic-example.elp');
        self::assertNotFalse($fixturePath, 'Missing fixture: basic-example.elp');

        $check = $this->odeService->checkLocalOdeFile(
            basename($fixturePath),
            $fixturePath,
            $user,
            true
        );

        self::assertSame('OK', $check['responseMessage'] ?? null, 'Failed to validate ELP fixture');

        $this->odeService->createElpStructureAndCurrentOdeUser(
            basename($fixturePath),
            $user,
            $user,
            '127.0.0.1',
            true,
            $check
        );

        return [
            'odeId' => $check['odeId'],
            'odeSessionId' => $check['odeSessionId'],
        ];
    }

    private function pickFirstPageId(string $sessionId): string
    {
        $repo = $this->entityManager->getRepository(OdeNavStructureSync::class);
        $nodes = $repo->getNavStructure($sessionId);
        self::assertNotEmpty($nodes, 'No pages found in session.');

        foreach ($nodes as $node) {
            if (null !== $node->getOdeParentPageId()) {
                return (string) $node->getOdePageId();
            }
        }

        return (string) $nodes[0]->getOdePageId();
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeResponse(): array
    {
        $content = $this->client->getResponse()->getContent();
        self::assertIsString($content);

        return json_decode($content, true, 512, JSON_THROW_ON_ERROR);
    }
}
