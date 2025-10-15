<?php

namespace App\Tests\Unit\Security;

use App\Security\GuestLoginAccessValidator;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;
use Symfony\Component\HttpKernel\KernelInterface;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;

class GuestLoginAccessValidatorTest extends TestCase
{
    public function testIssueNoncePersistsInSession(): void
    {
        $validator = $this->createValidator();
        $session = $this->createSession();

        $nonce = $validator->issueNonce($session);

        $stored = $session->get('_guest_login_nonces', []);

        self::assertArrayHasKey($nonce, $stored);
        self::assertGreaterThan(time(), $stored[$nonce]);
    }

    public function testAllowsRequestsComingFromLoginWithValidNonce(): void
    {
        $validator = $this->createValidator();
        $session = $this->createSession();
        $nonce = $validator->issueNonce($session);

        $request = Request::create('/login/guest', 'POST', ['guest_login_nonce' => $nonce]);
        $request->headers->set('referer', 'http://localhost/login?foo=bar');
        $request->setSession($session);

        self::assertTrue($validator->isAccessAllowed($request));
        self::assertArrayNotHasKey($nonce, $session->get('_guest_login_nonces', []));
    }

    public function testBlocksRequestsFromUnknownOrigins(): void
    {
        $validator = $this->createValidator();
        $session = $this->createSession();
        $nonce = $validator->issueNonce($session);

        $request = Request::create('/login/guest', 'POST', ['guest_login_nonce' => $nonce]);
        $request->headers->set('referer', 'http://malicious.example/');
        $request->setSession($session);

        self::assertFalse($validator->isAccessAllowed($request));
    }

    public function testBlocksRequestsMissingNonce(): void
    {
        $validator = $this->createValidator();
        $session = $this->createSession();

        $request = Request::create('/login/guest', 'POST');
        $request->headers->set('referer', 'http://localhost/login');
        $request->setSession($session);

        self::assertFalse($validator->isAccessAllowed($request));
    }

    public function testBlocksRequestsWithExpiredNonce(): void
    {
        $validator = $this->createValidator();
        $session = $this->createSession();
        $session->set('_guest_login_nonces', ['expired' => time() - 10]);

        $request = Request::create('/login/guest', 'POST', ['guest_login_nonce' => 'expired']);
        $request->headers->set('referer', 'http://localhost/login');
        $request->setSession($session);

        self::assertFalse($validator->isAccessAllowed($request));
        self::assertSame([], $session->get('_guest_login_nonces', []));
    }

    public function testBlocksSuspiciousFetchSiteHeader(): void
    {
        $validator = $this->createValidator();
        $session = $this->createSession();
        $nonce = $validator->issueNonce($session);

        $request = Request::create('/login/guest', 'POST', ['guest_login_nonce' => $nonce]);
        $request->headers->set('referer', 'http://localhost/login');
        $request->headers->set('Sec-Fetch-Site', 'cross-site');
        $request->setSession($session);

        self::assertFalse($validator->isAccessAllowed($request));
    }

    public function testAllowsConsoleExecutions(): void
    {
        $validator = $this->createValidator();

        self::assertTrue($validator->isAccessAllowed());
    }

    public function testAllowsTestEnvironment(): void
    {
        $validator = $this->createValidator('test');
        $session = $this->createSession();
        $request = Request::create('/login/guest', 'POST');
        $request->setSession($session);

        self::assertTrue($validator->isAccessAllowed($request));
    }

    private function createValidator(string $environment = 'prod'): GuestLoginAccessValidator
    {
        $requestStack = new RequestStack();

        $urlGenerator = $this->createMock(UrlGeneratorInterface::class);
        $urlGenerator->method('generate')->willReturnCallback(static function (string $name, array $parameters, int $referenceType) {
            if ('app_login' !== $name) {
                return '';
            }

            return UrlGeneratorInterface::ABSOLUTE_PATH === $referenceType
                ? '/login'
                : 'http://localhost/login';
        });

        $kernel = $this->createMock(KernelInterface::class);
        $kernel->method('getEnvironment')->willReturn($environment);

        return new GuestLoginAccessValidator($requestStack, $urlGenerator, $kernel, 60);
    }

    private function createSession(): Session
    {
        $session = new Session(new MockArraySessionStorage());
        $session->start();

        return $session;
    }
}

