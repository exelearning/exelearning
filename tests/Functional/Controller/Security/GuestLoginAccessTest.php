<?php

namespace App\Tests\Functional\Controller\Security;

use App\Controller\net\exelearning\Controller\Security\SecurityController;
use App\Entity\net\exelearning\Entity\User;
use App\Security\GuestLoginAccessValidator;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\Container;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class GuestLoginAccessTest extends TestCase
{
    public function testGuestLoginReturnsRedirectWhenAccessAllowed(): void
    {
        $session = new Session(new MockArraySessionStorage());
        $controller = $this->createController(true);

        $request = Request::create('/login/guest', 'POST');

        $response = $controller->guestLogin($request, $session);

        self::assertSame(Response::HTTP_FOUND, $response->getStatusCode());
        self::assertSame('/workarea', $response->headers->get('Location'));
        self::assertSame('guest', $session->get('auth_method_used'));
    }

    public function testGuestLoginReturnsForbiddenWhenAccessDenied(): void
    {
        $session = new Session(new MockArraySessionStorage());
        $controller = $this->createController(false);

        $request = Request::create('/login/guest', 'POST');

        $response = $controller->guestLogin($request, $session);

        self::assertSame(Response::HTTP_FORBIDDEN, $response->getStatusCode());
        self::assertSame(
            ['error' => 'Unauthorized guest login source'],
            json_decode($response->getContent(), true, 512, JSON_THROW_ON_ERROR),
        );
    }

    private function createController(bool $accessAllowed): SecurityController
    {
        $parameterBag = $this->createMock(ParameterBagInterface::class);
        $parameterBag->method('get')->willReturnCallback(static function (string $name, $default = null) {
            return match ($name) {
                'app.auth_methods' => ['guest'],
                'auth_create_users' => false,
                'security.firewall_name' => 'main',
                default => $default,
            };
        });

        $repository = $this->createMock(EntityRepository::class);
        $repository->method('findOneBy')->willReturn(null);
        $repository->method('getClassName')->willReturn(User::class);

        $entityManager = $this->createMock(EntityManagerInterface::class);
        $entityManager->method('getRepository')->willReturn($repository);

        $httpClient = $this->createMock(HttpClientInterface::class);

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        if ($accessAllowed) {
            $tokenStorage->expects($this->once())->method('setToken');
        } else {
            $tokenStorage->expects($this->never())->method('setToken');
        }

        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects($this->never())->method('error');

        $accessValidator = $this->createMock(GuestLoginAccessValidator::class);
        $accessValidator->method('isAccessAllowed')->willReturn($accessAllowed);

        $controller = new SecurityController(
            $parameterBag,
            $entityManager,
            $httpClient,
            $tokenStorage,
            $logger,
            $accessValidator,
        );

        $router = $this->createMock(UrlGeneratorInterface::class);
        $router->method('generate')->willReturn('/workarea');

        $container = new Container();
        $container->set('router', $router);
        $controller->setContainer($container);

        return $controller;
    }
}
