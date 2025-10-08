<?php

namespace App\Tests\Controller;

use App\Entity\net\exelearning\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;

class SecurityControllerTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $entityManager;
    private ?User $testUser = null;
    private string $email;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->entityManager = static::getContainer()->get(EntityManagerInterface::class);
        // Generate a unique email per test run to avoid unique constraint collisions
        $this->email = sprintf('test+%s@example.com', bin2hex(random_bytes(6)));
        $this->createTestUser();
    }

    private function createTestUser(): void
    {
        $this->testUser = new User();
        $this->testUser->setEmail($this->email);
        $this->testUser->setPassword(
            static::getContainer()->get('security.user_password_hasher')
                ->hashPassword($this->testUser, 'password123')
        );
        $this->testUser->setRoles(['ROLE_USER']);
        $this->testUser->setUserId(bin2hex(random_bytes(20)));
        $this->testUser->setIsLopdAccepted(true);
        $this->entityManager->persist($this->testUser);
        $this->entityManager->flush();
    }

    private function getTestUser(): ?User
    {
        return $this->entityManager
            ->getRepository(User::class)
            ->findOneBy(['email' => $this->email]);
    }

    private function getAuthMethods(): array
    {
        $params = static::getContainer()->get(ParameterBagInterface::class);
        $methods = $params->get('app.auth_methods');
        if (\is_string($methods)) {
            $methods = array_filter(array_map('trim', explode(',', $methods)));
        }
        return \is_array($methods) ? $methods : [];
    }

protected function tearDown(): void
{
    parent::tearDown();

    // Re-fetch the entity to ensure it is managed
    $user = $this->entityManager
        ->getRepository(User::class)
        ->findOneBy(['email' => $this->email]);

    if ($user) {
        $this->entityManager->persist($user); // Ensure that Doctrine manages it
        $this->entityManager->remove($user);
        $this->entityManager->flush();
    }

    // Clear and close the EntityManager to avoid contamination between tests
    $this->entityManager->clear();
    $this->entityManager->close();
    unset($this->entityManager);
}



    public function testLoginPageLoadsSuccessfully(): void
    {
        $loginPath = static::getContainer()->get('router')->generate('app_login', [], UrlGeneratorInterface::ABSOLUTE_PATH);
        $this->client->request('GET', $loginPath);
        $this->assertResponseIsSuccessful();
        if (\in_array('password', $this->getAuthMethods(), true)) {
            $this->assertSelectorExists('form#login-form');
        }
    }

    public function testLoginFailsWithInvalidCredentials(): void
    {
        if (!\in_array('password', $this->getAuthMethods(), true)) {
            $this->markTestSkipped('Password login is disabled.');
        }
        $this->client->followRedirects(true);
        $loginPath = static::getContainer()->get('router')->generate('app_login', [], UrlGeneratorInterface::ABSOLUTE_PATH);
        $crawler = $this->client->request('GET', $loginPath);

        $this->assertSelectorExists('form[name="login"]');

        $form = $crawler->selectButton('login-form-btn-submit')->form([
            'email'    => 'wrong@example.com',
            'password' => 'wrongpassword',
        ]);

        $this->client->submit($form);

        $this->assertResponseStatusCodeSame(Response::HTTP_OK);
        $this->assertSelectorExists('.alert-danger', 'Invalid credentials');
        $this->assertSelectorTextContains('.alert-danger', 'Invalid credentials');
    }

    public function testLoginSucceedsWithValidCredentials(): void
    {
        if (!\in_array('password', $this->getAuthMethods(), true)) {
            $this->markTestSkipped('Password login is disabled.');
        }
        $this->client->followRedirects(true);
        $loginPath = static::getContainer()->get('router')->generate('app_login', [], UrlGeneratorInterface::ABSOLUTE_PATH);
        $crawler = $this->client->request('GET', $loginPath);

        // Ensure the login form exists on the page
        $this->assertSelectorExists('form[name="login"]');

        // Fill in the login form with valid credentials
        $form = $crawler->selectButton('login-form-btn-submit')->form([
            'email'    => $this->email,
            'password' => 'password123',
        ]);

        // Submit the login form
        $this->client->submit($form);

        $this->assertResponseStatusCodeSame(Response::HTTP_OK);

        // Verify that the user is redirected to /workarea and their initial is displayed
        $this->assertSelectorExists('#head-bottom-user-logged');
        $this->assertSelectorExists('#head-bottom-user-logged img.exe-gravatar');
        
        // Verify email is in the response content
        $this->assertStringContainsString($this->email, $this->client->getResponse()->getContent());
        
        // Ensure the user session is authenticated
        $this->assertNotNull(
            static::getContainer()->get('security.token_storage')->getToken(),
            'The user should be authenticated after login.'
        );
        
        // Verify we're on the correct route after login (workarea or another expected route)
        $this->assertRouteSame('workarea');
        
        // Verify the authenticated user is the correct one
        $this->assertEquals(
            $this->email,
            static::getContainer()->get('security.token_storage')->getToken()->getUser()->getEmail()
        );
                
        // Verify we're no longer on the login page
        $this->assertSelectorNotExists('form[name="login"]');
        
    }

    public function testCasLoginRedirectsToCorrectUrl(): void
    {
        if (!\in_array('cas', $this->getAuthMethods(), true)) {
            $this->markTestSkipped('CAS authentication is disabled.');
        }
        $casLoginPath = static::getContainer()->get('router')->generate('cas_login', [], UrlGeneratorInterface::ABSOLUTE_PATH);
        $this->client->request('GET', $casLoginPath);
        $this->assertResponseRedirects();
    }

    public function testOpenIdLoginRedirectsToCorrectUrl(): void
    {
        if (!\in_array('openid', $this->getAuthMethods(), true)) {
            $this->markTestSkipped('OpenID authentication is disabled.');
        }
        $openidPath = static::getContainer()->get('router')->generate('openid_connect', [], UrlGeneratorInterface::ABSOLUTE_PATH);
        $this->client->request('GET', $openidPath);
        $this->assertResponseRedirects();
    }

    public function testOpenIdCallbackHandlesValidResponse(): void
    {
        if (!\in_array('openid', $this->getAuthMethods(), true)) {
            $this->markTestSkipped('OpenID authentication is disabled.');
        }
        // Ensure a fresh kernel so we can replace services
        static::ensureKernelShutdown();

        // Mock OpenID provider response
        $mockResponse = new MockResponse(json_encode([
            'access_token' => 'valid-access-token',
            'id_token'     => 'valid-id-token',
            'token_type'   => 'Bearer',
            'expires_in'   => 3600,
        ]));
        $mockHttpClient = new MockHttpClient($mockResponse);

        // Re-create the BrowserKit client and then override the service
        // Note: do NOT call bootKernel() explicitly when using WebTestCase
        $this->client = static::createClient();
        static::getContainer()->set(\Symfony\Contracts\HttpClient\HttpClientInterface::class, $mockHttpClient);

        // Start session manually
        $session = static::getContainer()->get('session.factory')->createSession();
        $session->set('oidc_state', 'random-state-value');
        $session->set('oidc_code_verifier', 'random-code-verifier');
        $session->save(); // Ensure session is persisted

        // Inject the session into the client by setting a cookie
        $this->client->getCookieJar()->set(
            new \Symfony\Component\BrowserKit\Cookie($session->getName(), $session->getId())
        );

        // Now simulate the OpenID callback request
        $callbackPath = static::getContainer()->get('router')->generate('openid_connect_callback', [], UrlGeneratorInterface::ABSOLUTE_PATH);
        $this->client->request('GET', $callbackPath, [
            'state' => 'random-state-value',
            'code'  => 'valid-auth-code'
        ]);

        // Ensure the response redirects correctly
        $workareaPath = static::getContainer()->get('router')->generate('workarea', [], UrlGeneratorInterface::ABSOLUTE_PATH);
        $this->assertResponseRedirects($workareaPath.'?access_token=valid-access-token');

    }

    public function testLogoutRedirectsToHomepage(): void
    {
        $user = $this->getTestUser();
        $this->client->loginUser($user);

        $logoutPath = static::getContainer()->get('router')->generate('app_logout', [], UrlGeneratorInterface::ABSOLUTE_PATH);
        $this->client->request('GET', $logoutPath);
        $logoutRedirectPath = static::getContainer()->get('router')->generate('app_logout_redirect', [], UrlGeneratorInterface::ABSOLUTE_PATH);
        $this->assertResponseRedirects($logoutRedirectPath);
        $this->client->followRedirect();
        $workareaPath = static::getContainer()->get('router')->generate('workarea', [], UrlGeneratorInterface::ABSOLUTE_PATH);
        $this->assertResponseRedirects($workareaPath);

    }
}
