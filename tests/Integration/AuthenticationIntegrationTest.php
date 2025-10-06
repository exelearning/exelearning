<?php

namespace App\Tests\Integration;

use App\Entity\net\exelearning\Entity\User;
use App\Security\MultiTokenHandler;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\BrowserKit\Cookie;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\Session\SessionInterface;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Http\AccessToken\Cas\Cas2Handler;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use Symfony\Contracts\HttpClient\ResponseInterface;

class AuthenticationIntegrationTest extends WebTestCase
{
    private ContainerInterface $container;
    private KernelBrowser $client;
    private HttpClientInterface $httpClientMock;
    private HttpClientInterface $originalHttpClient;
    
    protected function setUp(): void
    {
        $this->client = static::createClient();
        // Use the test container to access private services
        $this->container = static::getContainer();
        
        // Create a mock for the HTTP client
        $this->httpClientMock = $this->createMock(HttpClientInterface::class);
        // Store the original HTTP client
        $this->originalHttpClient = $this->container->get('http_client');
    }
    
    public function testAuthMethodParametersAreLoaded(): void
    {
        $parameterBag = $this->container->get('parameter_bag');
        
        // Test that auth_methods are loaded correctly
        $authMethods = $parameterBag->get('app.auth_methods');
        $this->assertIsArray($authMethods);
        
        // Test that online_mode is loaded correctly
        $onlineMode = $parameterBag->get('app.online_mode');
        $this->assertIsBool($onlineMode);
        
        // Test required CAS parameters when CAS is enabled
        if (in_array('cas', $authMethods)) {
            $this->assertNotNull($parameterBag->get('cas_url'));
            $this->assertNotNull($parameterBag->get('cas_login_path'));
            $this->assertNotNull($parameterBag->get('cas_logout_path'));
            $this->assertNotNull($parameterBag->get('cas_validate_path'));
        }
        
        // Test required OpenID parameters when OpenID is enabled
        if (in_array('openid', $authMethods)) {
            $this->assertNotNull($parameterBag->get('oidc_issuer'));
            $this->assertNotNull($parameterBag->get('oidc_client_id'));
            $this->assertNotNull($parameterBag->get('oidc_client_secret'));
            $this->assertNotNull($parameterBag->get('oidc_scope'));
        }
    }
    
    public function testLoginPageLoadsCorrectlyInOnlineMode(): void
    {
        // Set online mode to true for this test
        // $this->setParameter('app.online_mode', true);
        
        $crawler = $this->client->request('GET', '/login');
        
        // Check that the response is successful
        $this->assertResponseIsSuccessful();
        
        // Verify that the form loads correctly (searched by ID)
        $this->assertSelectorExists('form#login-form');
        $this->assertSelectorExists('input[name="email"]');
        $this->assertSelectorExists('input[name="password"]');
        
        // Verify links for other authentication methods
        $authMethods = $this->container->getParameter('app.auth_methods');
        
        if (in_array('cas', $authMethods)) {
            $this->assertSelectorExists('a[href*="/login/cas"]');
        }
        
        if (in_array('openid', $authMethods)) {
            $this->assertSelectorExists('a[href*="/login/openid"]');
        }
    }
    
    
    public function testCasLoginRedirection(): void
    {
        // Set online mode to true and enable CAS
        // $this->setParameter('app.online_mode', true);
        // $this->setParameter('app.auth_methods', ['cas']);

        // Simulate CAS parameters
        // $this->setParameter('cas_url', 'https://casserverpac4j.herokuapp.com');
        // $this->setParameter('cas_login_path', '/login');

        $this->client->request('GET', '/login/cas');

        // Should redirect to the CAS server
        $this->assertResponseRedirects();
        $redirectUrl = $this->client->getResponse()->headers->get('Location');
        // $this->assertStringContainsString('https://casserverpac4j.herokuapp.com/login', $redirectUrl);
        // $this->assertStringContainsString('service=', $redirectUrl);

        // Use the helper method to get the session
        // $session = $this->getSession();
        // $this->assertEquals('cas', $session->get('auth_method_used'));
    }
    
    public function testLogout(): void
    {
        // Start a request to have a Request with session
        $this->client->request('GET', '/');
        // Set online mode to true for this test
        // $this->setParameter('app.online_mode', true);

        // Create and log in a test user
        $user = $this->createTestUser();
        // $this->loginUser($user);

        // Request logout
        $this->client->request('GET', '/logout');

        // Should redirect to the logout redirection route
        $this->assertResponseRedirects();

        // Check that the token storage is empty
        // $tokenStorage = $this->container->get(TokenStorageInterface::class);
        // $this->assertNull($tokenStorage->getToken());
    }
    
    /* Helper Methods */
    
    private function createTestUser(string $email = 'test@example.com', string $password = 'password'): User
    {
        $em = $this->container->get(EntityManagerInterface::class);
        $userRepository = $em->getRepository(User::class);
        
        // If the user exists, remove it to ensure fresh credentials
        if ($existingUser = $userRepository->findOneBy(['email' => $email])) {
            $em->remove($existingUser);
            $em->flush();
        }
        
        // Create a new user
        $user = new User();
        $user->setEmail($email);
        $user->setUserId(uniqid());
        
        if ($this->container->has('security.user_password_hasher')) {
            $passwordHasher = $this->container->get('security.user_password_hasher');
            $hashedPassword = $passwordHasher->hashPassword($user, $password);
            $user->setPassword($hashedPassword);
        } else {
            $user->setPassword($password);
        }
        
        $user->setIsLopdAccepted(true);
        $user->setRoles(['ROLE_USER']);
        
        $em->persist($user);
        $em->flush();
        
        return $user;
    }
}
