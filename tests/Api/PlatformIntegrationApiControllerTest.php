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

        $container = static::getContainer();

        // Ensure test user exists with ID 1
        $userRepository = $container->get(UserRepository::class);
        $entityManager = $container->get('doctrine.orm.entity_manager');
        if (!$userRepository->find(1)) {
            $user = new User();
            $user->setUserId("1");
            $user->setEmail('tests@example.com');
            $user->setPassword('random-pass');
            $user->setIsLopdAccepted(true);

            $meta = $entityManager->getClassMetadata(User::class);
            $meta->setIdGeneratorType(\Doctrine\ORM\Mapping\ClassMetadata::GENERATOR_TYPE_NONE);

            $entityManager->persist($user);
            $entityManager->flush();
        }

        // Retrieve user by ID (to simulate your current logic)
        $user = $entityManager->getRepository(User::class)->find(1);

        // Authenticate as the test user (session cookie is set)
        $client->loginUser($user);

        // Create a JWT token with required and optional claims
        $jwt = JWT::encode(
            [
                'user_id' => $user->getId(),
                'exp' => time() + 3600,
                'returnurl' => 'http://localhost/dummy',
                'pkgtype' => 'scorm', // or 'webzip'
                'cmid' => 0,
            ],
            $_ENV['APP_SECRET'],
            Settings::JWT_SECRET_HASH
        );

        // Send POST request without `odeSessionId`, expecting error response
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
