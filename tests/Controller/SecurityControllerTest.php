<?php

namespace App\Tests\Controller;

use App\Entity\net\exelearning\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

class SecurityControllerTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $entityManager;
    private ?User $testUser = null;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->client = static::createClient();
        $this->entityManager = static::getContainer()->get(EntityManagerInterface::class);
        $this->createTestUser();
    }

    private function createTestUser(): void
    {
        $userRepository = $this->entityManager->getRepository(User::class);
        $this->testUser = $userRepository->findOneBy(['email' => 'test@example.com']);

        if (!$this->testUser) {
            $this->testUser = new User();
            $this->testUser->setEmail('test@example.com');
            $this->testUser->setPassword(
                static::getContainer()->get('security.user_password_hasher')
                    ->hashPassword($this->testUser, 'password123')
            );
            $this->testUser->setRoles(['ROLE_USER']);
            $this->testUser->setUserId(uniqid());
            $this->testUser->setIsLopdAccepted(true);
            $this->entityManager->persist($this->testUser);
            $this->entityManager->flush();
        }
    }

    private function getTestUser(): ?User
    {
        return $this->entityManager
            ->getRepository(User::class)
            ->findOneBy(['email' => 'test@example.com']);
    }

protected function tearDown(): void
{
    parent::tearDown();

    // Re-obtenemos la entidad para asegurarnos de que está gestionada
    $user = $this->entityManager
        ->getRepository(User::class)
        ->findOneBy(['email' => 'test@example.com']);

    if ($user) {
        $this->entityManager->persist($user); // Asegura que Doctrine la gestione
        $this->entityManager->remove($user);
        $this->entityManager->flush();
    }

    // Limpiar y cerrar el EntityManager para evitar contaminación entre pruebas
    $this->entityManager->clear();
    $this->entityManager->close();
    unset($this->entityManager);
}



    public function testLoginPageLoadsSuccessfully(): void
    {
        $this->client->request('GET', '/login');
        $this->assertResponseIsSuccessful();
        $this->assertSelectorExists('form#login-form');
    }

    public function testLoginFailsWithInvalidCredentials(): void
    {
        $this->client->followRedirects(true);
        $crawler = $this->client->request('GET', '/login');

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
        $this->client->followRedirects(true);
        $crawler = $this->client->request('GET', '/login');

        // Ensure the login form exists on the page
        $this->assertSelectorExists('form[name="login"]');

        // Fill in the login form with valid credentials
        $form = $crawler->selectButton('login-form-btn-submit')->form([
            'email'    => 'test@example.com',
            'password' => 'password123',
        ]);

        // Submit the login form
        $this->client->submit($form);

        $this->assertResponseStatusCodeSame(Response::HTTP_OK);

        // Verify that the user is redirected to /workarea and their initial is displayed
        $this->assertSelectorExists('#head-bottom-user-logged');
        $this->assertSelectorExists('#head-bottom-user-logged img.exe-gravatar');
        
        // Verify email is in the response content
        $this->assertStringContainsString('test@example.com', $this->client->getResponse()->getContent());
        
        // Ensure the user session is authenticated
        $this->assertNotNull(
            static::getContainer()->get('security.token_storage')->getToken(),
            'The user should be authenticated after login.'
        );
        
        // Verify we're on the correct route after login (workarea or another expected route)
        $this->assertRouteSame('workarea');
        
        // Verify the authenticated user is the correct one
        $this->assertEquals(
            'test@example.com',
            static::getContainer()->get('security.token_storage')->getToken()->getUser()->getEmail()
        );
                
        // Verify we're no longer on the login page
        $this->assertSelectorNotExists('form[name="login"]');
        
    }

    public function testCasLoginRedirectsToCorrectUrl(): void
    {
        $this->client->request('GET', '/login/cas');
        $this->assertResponseRedirects();
    }

    public function testOpenIdLoginRedirectsToCorrectUrl(): void
    {
        $this->client->request('GET', '/login/openid');
        $this->assertResponseRedirects();
    }

    public function testOpenIdCallbackHandlesValidResponse(): void
    {
        // Mock OpenID provider response
        $mockResponse = new MockResponse(json_encode([
            'access_token' => 'valid-access-token',
            'id_token'     => 'valid-id-token',
            'token_type'   => 'Bearer',
            'expires_in'   => 3600,
        ]));
        $mockHttpClient = new MockHttpClient($mockResponse);

        static::getContainer()->set('http_client', $mockHttpClient);

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
        $this->client->request('GET', '/login/openid/callback', [
            'state' => 'random-state-value',
            'code'  => 'valid-auth-code'
        ]);

        // Ensure the response redirects correctly
        $this->assertResponseRedirects('/workarea?access_token=valid-access-token');

    }

    public function testLogoutRedirectsToHomepage(): void
    {
        $user = $this->getTestUser();
        $this->client->loginUser($user);

        $this->client->request('GET', '/logout');

        $this->assertResponseRedirects('/logout/redirect');
        $this->client->followRedirect();
        $this->assertResponseRedirects('/workarea');

    }
}
