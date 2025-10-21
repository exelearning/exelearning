<?php
declare(strict_types=1);

namespace App\Tests\Functional\Export;

use App\Entity\net\exelearning\Entity\User;
use App\Service\net\exelearning\Service\Api\OdeServiceInterface;
use App\Tests\Helper\TestDatabaseHelper;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

final class SinglePagePreviewTest extends WebTestCase
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

    public function testSinglePagePreviewReturnsUrlForAuthorizedUser(): void
    {
        $this->markTestIncomplete('Should be revisited');

        $user = $this->createUser();
        $sessionData = $this->bootstrapSession($user);

        $this->client->loginUser($user);

        $this->client->request(
            'GET',
            sprintf('/project/%s/export/single-page-preview', $sessionData['odeId']),
            ['sessionId' => $sessionData['odeSessionId']]
        );

        self::assertResponseIsSuccessful();

        $payload = json_decode(
            $this->client->getResponse()->getContent(),
            true,
            512,
            JSON_THROW_ON_ERROR
        );

        self::assertIsArray($payload);
        self::assertArrayHasKey('url', $payload);
        self::assertNotEmpty($payload['url']);
        self::assertStringContainsString('print=1', $payload['url']);
    }

    public function testSinglePagePreviewIsForbiddenForDifferentUser(): void
    {
        $this->markTestIncomplete('Should be revisited');
        

        $owner = $this->createUser('owner');
        $sessionData = $this->bootstrapSession($owner);

        $otherUser = $this->createUser('guest');
        $this->client->loginUser($otherUser);

        $this->client->request(
            'GET',
            sprintf('/project/%s/export/single-page-preview', $sessionData['odeId']),
            ['sessionId' => $sessionData['odeSessionId']]
        );

        self::assertResponseStatusCodeSame(Response::HTTP_FORBIDDEN);
    }

    /**
     * @param string $suffix
     */
    private function createUser(string $suffix = ''): User
    {
        $email = sprintf(
            'print-preview-%s@exelearning.test',
            $suffix !== '' ? $suffix.'-'.bin2hex(random_bytes(4)) : bin2hex(random_bytes(6))
        );
        $userId = sprintf('print_user_%s', bin2hex(random_bytes(6)));

        return TestDatabaseHelper::createUser($this->entityManager, $email, $userId, '1234');
    }

    /**
     * @return array{odeId: string, odeSessionId: string}
     */
    private function bootstrapSession(User $user): array
    {
        $fixturePath = realpath(__DIR__.'/../../Fixtures/basic-example.elp');
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
}
