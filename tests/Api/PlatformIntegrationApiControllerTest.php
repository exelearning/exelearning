<?php
declare(strict_types=1);

namespace App\Tests\Api;

use App\Entity\net\exelearning\Entity\User;
use App\Repository\net\exelearning\Repository\UserRepository;
use App\Settings;
use Firebase\JWT\JWT;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;

/**
 * @covers \App\Controller\net\exelearning\Controller\Api\PlatformIntegrationApiController
 */
final class PlatformIntegrationApiControllerTest extends WebTestCase
{
    public function testNewOdeRedirectsToWorkarea(): void
    {
        $client = self::createClient();
        $jwt = 'dummy-jwt';

        $client->request('GET', '/new_ode', ['jwt_token' => $jwt]);

        self::assertResponseStatusCodeSame(Response::HTTP_FOUND);
        self::assertResponseRedirects('/workarea?newOde=new&jwt_token=' . $jwt);
    }

    public function testEditOdeRedirectsWithOdeId(): void
    {
        $client = self::createClient();
        $jwt = 'tok';
        $odeId = 42;

        $client->request('GET', '/edit_ode', [
            'ode_id' => $odeId,
            'jwt_token' => $jwt,
        ]);

        self::assertResponseStatusCodeSame(Response::HTTP_FOUND);
        self::assertResponseRedirects('/workarea?odeId=' . $odeId . '&jwt_token=' . $jwt);
    }

    

    public function testSetPlatformNewOdeWithoutSessionIdReturnsError(): void
    {
        $client = self::createClient();
        $entityManager = static::getContainer()->get('doctrine.orm.entity_manager');

        // Create an ephemeral user with unique values to avoid collisions
        $user = new User();
        $user->setUserId(bin2hex(random_bytes(8)));
        $user->setEmail(sprintf('test+%s@example.com', bin2hex(random_bytes(6))));
        $user->setPassword('random-pass');
        $user->setIsLopdAccepted(true);

        $entityManager->persist($user);
        $entityManager->flush();

        // Authenticate as the ephemeral user
        $client->loginUser($user);

        // Generate a valid JWT token for the authenticated user
        $jwt = JWT::encode(
            [
                'user_id'   => $user->getId(),
                'exp'       => time() + 3600,
                'returnurl' => 'http://localhost/dummy',
                'pkgtype'   => 'scorm',
                'cmid'      => 0,
            ],
            $_ENV['APP_SECRET'],
            Settings::JWT_SECRET_HASH
        );

        // Send POST request without odeSessionId, expecting error response
        $client->request(
            'POST',
            '/api/platform/integration/set_platform_new_ode',
            [
                'jwt_token' => $jwt,
            ]
        );

        self::assertResponseStatusCodeSame(Response::HTTP_OK);

        $payload = json_decode($client->getResponse()->getContent(), true);
        self::assertSame(['responseMessage' => 'error: invalid data'], $payload);
    }

}
