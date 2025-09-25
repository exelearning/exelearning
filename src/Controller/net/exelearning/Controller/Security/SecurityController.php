<?php

namespace App\Controller\net\exelearning\Controller\Security;

use App\Entity\net\exelearning\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\Session\SessionInterface;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\UsernamePasswordToken;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Core\Exception\AuthenticationServiceException;
use Symfony\Component\Security\Core\Exception\BadCredentialsException;
use Symfony\Component\Security\Core\Exception\InvalidCsrfTokenException;
use Symfony\Component\Security\Http\Authentication\AuthenticationUtils;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class SecurityController extends AbstractController
{
    private ParameterBagInterface $params;
    private EntityManagerInterface $entityManager;
    private HttpClientInterface $httpClient;
    private TokenStorageInterface $tokenStorage;
    private LoggerInterface $logger;
    private array $authMethods;

    public function __construct(
        ParameterBagInterface $params,
        EntityManagerInterface $entityManager,
        HttpClientInterface $httpClient,
        TokenStorageInterface $tokenStorage,
        LoggerInterface $logger,
    ) {
        $this->params = $params;
        $this->entityManager = $entityManager;
        $this->httpClient = $httpClient;
        $this->tokenStorage = $tokenStorage;
        $this->logger = $logger;
        $this->authMethods = $params->get('app.auth_methods') ?? [];
    }

    #[Route('/login', name: 'app_login')]
    public function login(SessionInterface $session, AuthenticationUtils $authenticationUtils): Response
    {
        // Check if offline mode is enabled
        if (!$this->params->get('app.online_mode')) {
            // Load the default user
            $user = $this->getDefaultUser();

            // Programmatically log in the user
            $this->loginUser($user);

            // Redirect to workarea
            return $this->redirectToRoute('workarea');
        }

        // If online mode, proceed with normal login form
        // get the login error if there is one
        $error = $authenticationUtils->getLastAuthenticationError();
        // last username entered by the user
        $lastUsername = $authenticationUtils->getLastUsername();

        // Copy the target path (set by the firewall) into a custom session key
        // because the firewall will clear the original key after authentication
        if ($targetPath = $session->get('_security.main.target_path')) {
            $session->set('form_login_target_path', $targetPath);
        }

        return $this->render('security/login.html.twig', [
            'last_username' => $lastUsername,
            'error' => $error,
        ]);
    }

    /**
     * Route used by Symfony internally to check login.
     */
    #[Route('/login_check', name: 'app_login_check')]
    public function loginCheck(SessionInterface $session): Response
    {
        // Restore the previously saved target path (if any) and redirect to it
        $targetPath = $session->get('form_login_target_path');
        if ($targetPath) {
            // Delete the target_path to no loop it
            $session->remove('form_login_target_path');

            return $this->redirect($targetPath);
        }

        // Fallback redirect
        return $this->redirectToRoute('workarea');
    }

    #[Route('/login/cas', name: 'cas_login')]
    public function casLogin(Request $request, SessionInterface $session): Response
    {
        if (!in_array('cas', $this->authMethods)) {
            throw $this->createNotFoundException('CAS authentication is not enabled.');
        }

        $casUrl = rtrim($this->params->get('cas_url'), '/');
        $casLoginPath = ltrim($this->params->get('cas_login_path'), '/');

        if (empty($casUrl) || empty($casLoginPath)) {
            $this->logger->error('CAS authentication is misconfigured: cas_url or cas_login_path is missing.');
            throw new \RuntimeException('CAS authentication is not properly configured. Please check your application parameters.');
        }

        try {
            // Set the authentication method in session
            $session->set('auth_method_used', 'cas');

            // Try to retrieve the target path saved by the firewall (e.g. a protected page)
            $redirectUrl = $session->get('_security.main.target_path');

            // Fallback: redirect to the default post-login area if no target path exists
            if (!$redirectUrl) {
                $redirectUrl = $this->generateUrl('workarea', [], UrlGeneratorInterface::ABSOLUTE_URL);
            }

            // Build the CAS login URL with the correct return service
            $loginUrl = sprintf('%s/%s?service=%s', $casUrl, $casLoginPath, urlencode($redirectUrl));

            return $this->redirect($loginUrl);
        } catch (\Throwable $e) {
            $this->logger->error('CAS authentication failed: '.$e->getMessage());

            return $this->render('security/error.html.twig', [
                'error' => 'CAS authentication failed. Please try again later.',
            ], new Response('', Response::HTTP_INTERNAL_SERVER_ERROR));
        }
    }

    #[Route('/login/openid', name: 'openid_connect')]
    public function openidLogin(SessionInterface $session, UrlGeneratorInterface $urlGenerator): Response
    {
        if (!in_array('openid', $this->authMethods)) {
            throw $this->createNotFoundException('OpenID authentication is not enabled.');
        }

        try {
            $session->set('auth_method_used', 'oidc');

            $state = bin2hex(random_bytes(16));
            $nonce = bin2hex(random_bytes(16));
            $codeVerifier = bin2hex(random_bytes(32));
            $codeChallenge = rtrim(strtr(base64_encode(hash('sha256', $codeVerifier, true)), '+/', '-_'), '=');

            $session->set('oidc_code_verifier', $codeVerifier);
            $session->set('oidc_state', $state);
            $session->set('oidc_nonce', $nonce);

            $query = http_build_query([
                'client_id' => $this->params->get('oidc_client_id'),
                'redirect_uri' => $urlGenerator->generate('openid_connect_callback', [], UrlGeneratorInterface::ABSOLUTE_URL),
                'response_type' => 'code',
                'scope' => $this->params->get('oidc_scope'),
                'state' => $state,
                'nonce' => $nonce,
                'code_challenge' => $codeChallenge,
                'code_challenge_method' => 'S256',
                'prompt' => 'consent',
            ]);

            return $this->redirect($this->params->get('oidc_authorization_endpoint').'?'.$query);
        } catch (\Throwable $e) {
            $this->logger->error('OpenID authentication failed: '.$e->getMessage());

            return $this->render('security/error.html.twig', [
                'error' => 'OpenID authentication failed. Please try again later.',
            ], new Response('', Response::HTTP_INTERNAL_SERVER_ERROR));
        }
    }

    #[Route('/login/openid/callback', name: 'openid_connect_callback')]
    public function openidCallback(Request $request, SessionInterface $session): Response
    {
        if ($request->query->has('error')) {
            $error = $request->query->get('error');
            $errorDescription = $request->query->get('error_description', 'Login canceled by user');
            $this->logger->error("OpenID login failed: $error - $errorDescription");

            switch ($error) {
                case 'invalid_request':
                case 'invalid_grant':
                    $exception = new BadCredentialsException($errorDescription);
                    $statusCode = Response::HTTP_UNAUTHORIZED;
                    break;
                case 'access_denied':
                    $exception = new AuthenticationException("Access denied: $errorDescription");
                    $statusCode = Response::HTTP_FORBIDDEN;
                    break;
                default:
                    $exception = new AuthenticationException("Unknown authentication error: $errorDescription");
                    $statusCode = Response::HTTP_BAD_REQUEST;
            }

            return $this->render('security/error.html.twig', [
                'error' => $exception->getMessage(),
            ], new Response('', $statusCode));
        }

        // Validate state parameter
        if ($request->query->get('state') !== $session->get('oidc_state')) {
            $errorMessage = 'State mismatch: received='.$request->query->get('state').', expected='.$session->get('oidc_state');
            $this->logger->error($errorMessage);

            return $this->render('security/error.html.twig', [
                'error' => (new InvalidCsrfTokenException($errorMessage))->getMessage(),
            ], new Response('', Response::HTTP_BAD_REQUEST));
        }

        // Retrieve tokens using PKCE
        try {
            $response = $this->httpClient->request('POST', $this->params->get('oidc_token_endpoint'), [
                'body' => [
                    'grant_type' => 'authorization_code',
                    'client_id' => $this->params->get('oidc_client_id'),
                    'client_secret' => $this->params->get('oidc_client_secret'),
                    'redirect_uri' => $this->generateUrl('openid_connect_callback', [], UrlGeneratorInterface::ABSOLUTE_URL),
                    'code' => $request->query->get('code'),
                    'code_verifier' => $session->get('oidc_code_verifier'),
                ],
            ]);

            $tokenData = $response->toArray();
            $accessToken = $tokenData['access_token'] ?? null;
            $idToken = $tokenData['id_token'] ?? null;

            if ($idToken) {
                $session->set('oidc_id_token', $idToken);
            }
            if ($accessToken) {
                $session->set('oidc_access_token', $accessToken);
            }

            // Prefer access_token for AccessTokenAuthenticator; fallback to id_token
            // AccessTokenAuthenticator + OIDC userinfo requires a bearer access token.
            $tokenForAuthenticator = $accessToken ?? $idToken;
            if (!$tokenForAuthenticator) {
                throw new AuthenticationException('No token found in token response');
            }

            $targetPath = $session->get('_security.main.target_path');
            if ($targetPath) {
                $session->remove('_security.main.target_path');
                $sep = str_contains($targetPath, '?') ? '&' : '?';

                return $this->redirect($targetPath.$sep.'access_token='.urlencode($tokenForAuthenticator));
            }

            return $this->redirectToRoute('workarea', ['access_token' => $tokenForAuthenticator]);
        } catch (\Throwable $e) {
            $this->logger->error('OpenID token exchange failed: '.$e->getMessage());

            return $this->render('security/error.html.twig', [
                'error' => (new AuthenticationServiceException($e->getMessage()))->getMessage(),
            ], new Response('', Response::HTTP_INTERNAL_SERVER_ERROR));
        }
    }

    #[Route('/logout', name: 'app_logout')]
    public function logout(): void
    {
        throw new \LogicException('This method can be blank - it will be intercepted by the logout key on your firewall.');
    }

    /**
     * Final endpoint where the firewall redirects after logout.
     */
    #[Route('/logout/redirect', name: 'app_logout_redirect')]
    public function logoutRedirect(SessionInterface $session, TokenStorageInterface $tokenStorage): Response
    {
        // Retrieve the authentication method before invalidating the session
        $authMethodUsed = $session->get('auth_method_used');
        $this->logger->debug("Authentication method used: $authMethodUsed");

        // Capture tokens needed for provider logout before invalidating the session
        $idToken = $session->get('oidc_id_token');
        $accessToken = $session->get('oidc_access_token');

        // Clear token and invalidate session
        $tokenStorage->setToken(null);
        $session->invalidate();

        // Redirect depending authentication method used
        return match ($authMethodUsed) {
            'cas' => $this->handleCasLogout(),
            'oidc' => $this->handleOidcLogout($session, $idToken, $accessToken),
            default => $this->redirectToRoute('workarea'),
        };
    }

    private function handleCasLogout(): Response
    {
        $casUrl = rtrim((string) $this->params->get('cas_url', ''), '/');
        $casLogoutPath = ltrim((string) $this->params->get('cas_logout_path', ''), '/');

        if (!$casUrl || !$casLogoutPath) {
            $this->logger->warning('CAS logout attempted but CAS parameters are missing.');

            return $this->redirectToRoute('workarea');
        }

        $redirectUrl = $this->generateUrl('workarea', [], UrlGeneratorInterface::ABSOLUTE_URL);

        return $this->redirect("$casUrl/$casLogoutPath?service=".urlencode($redirectUrl));
    }

    private function handleOidcLogout(SessionInterface $session, ?string $idToken = null, ?string $accessToken = null): Response
    {
        $oidcIssuer = (string) $this->params->get('oidc_issuer');
        $idToken = $idToken ?? $session->get('oidc_id_token');
        $redirectUri = $this->generateUrl('workarea', [], UrlGeneratorInterface::ABSOLUTE_URL);

        if (!$oidcIssuer) {
            $this->logger->warning('OIDC logout attempted but OIDC issuer is missing.');

            return $this->redirect($redirectUri);
        }

        // Try OIDC discovery to find the end_session_endpoint
        try {
            $discoveryUrl = rtrim($oidcIssuer, '/').'/.well-known/openid-configuration';
            $conf = $this->httpClient->request('GET', $discoveryUrl)->toArray(false);
            $endSession = $conf['end_session_endpoint'] ?? null;

            if ($endSession) {
                $params = array_filter([
                    'post_logout_redirect_uri' => $redirectUri,
                    // Duende accepts id_token_hint; Keycloak usually accepts client_id and redirect
                    'id_token_hint' => $idToken,
                    'client_id' => $this->params->get('oidc_client_id'),
                ]);

                return $this->redirect($endSession.'?'.http_build_query($params));
            }
        } catch (\Throwable $e) {
            $this->logger->debug('OIDC discovery failed on logout: '.$e->getMessage());
        }

        // Provider-specific fallback for Google: revoke the access token and redirect locally
        if (str_contains($oidcIssuer, 'accounts.google.com')) {
            $accessToken = $accessToken ?? $session->get('oidc_access_token');
            if ($accessToken) {
                try {
                    $this->httpClient->request('POST', 'https://oauth2.googleapis.com/revoke', [
                        'body' => ['token' => $accessToken],
                        'headers' => ['Content-Type' => 'application/x-www-form-urlencoded'],
                    ]);
                } catch (\Throwable $e) {
                    $this->logger->debug('Google token revoke failed: '.$e->getMessage());
                }
            }

            return $this->redirect($redirectUri);
        }

        // Fallback: local logout only
        return $this->redirect($redirectUri);
    }

    /**
     * Load the default user in offline mode.
     */
    private function getDefaultUser()
    {
        $userRepo = $this->entityManager->getRepository(User::class);

        return $userRepo->find(1) ?? throw new \RuntimeException('Default user not found.');
    }

    /**
     * Programmatically log in the user in offline mode.
     */
    private function loginUser(User $user)
    {
        $firewallName = $this->params->get('security.firewall_name', 'main'); // The firewall name you're using
        $token = new UsernamePasswordToken($user, $firewallName, $user->getRoles());
        $this->tokenStorage->setToken($token);
    }

    #[Route('/login/guest', name: 'guest_login')]
    public function guestLogin(SessionInterface $session): Response
    {
        if (!in_array('guest', $this->authMethods)) {
            throw $this->createNotFoundException('Guest authentication is not enabled.');
        }

        try {
            $guestId = bin2hex(random_bytes(4)); // e.g. 1a2b3c4d
            $email = 'guest_'.$guestId.'@guest.local';

            // Check if a user with the generated email already exists
            $userRepo = $this->entityManager->getRepository(User::class);
            $existingUser = $userRepo->findOneBy(['email' => $email]);

            if ($existingUser) {
                throw new \RuntimeException('Guest email conflict. Try again.');
            }

            // Create new guest user entity
            $user = new User();
            $user->setEmail($email);
            $user->setUserId('guest_'.$guestId); // Set a unique userId
            $user->setRoles(['ROLE_GUEST']);
            $user->setPassword(''); // No password required for guest
            $user->setIsLopdAccepted(true); // Consider LOPD accepted by default

            // Persist the user if user creation is enabled
            if (filter_var($this->params->get('auth_create_users', false), FILTER_VALIDATE_BOOLEAN)) {
                $this->entityManager->persist($user);
                $this->entityManager->flush();
            }

            // Store auth method used and log in the user
            $session->set('auth_method_used', 'guest');
            $this->loginUser($user);

            // If there is a targetPath, redirect to it
            $targetPath = $session->get('_security.main.target_path');
            if ($targetPath) {
                // Delete the target_path to no loop it
                $session->remove('_security.main.target_path');

                return $this->redirect($targetPath);
            }

            return $this->redirectToRoute('workarea');
        } catch (\Throwable $e) {
            $this->logger->error('Guest login failed: '.$e->getMessage());

            return $this->render('security/error.html.twig', [
                'error' => 'Guest login failed. Please try again later.',
            ], new Response('', Response::HTTP_INTERNAL_SERVER_ERROR));
        }
    }
}
