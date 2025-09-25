<?php

namespace App\Security;

use App\Entity\net\exelearning\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\PasswordHasher\Hasher\PasswordHasherFactoryInterface;
use Symfony\Component\Security\Core\Exception\BadCredentialsException;
use Symfony\Component\Security\Http\AccessToken\AccessTokenHandlerInterface;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;

/**
 * MultiTokenHandler manages authentication across multiple providers (CAS, OIDC).
 *
 * This handler:
 * 1. Identifies the type of token (CAS ticket or JWT)
 * 2. Delegates to the appropriate handler
 * 3. Manages user creation or synchronization
 * 4. Preserves existing password-based accounts when found
 */
class MultiTokenHandler implements AccessTokenHandlerInterface
{
    private AccessTokenHandlerInterface $casHandler;
    private AccessTokenHandlerInterface $oidcUserInfoHandler;
    private ?JwtTokenHandler $jwtHandler;
    private EntityManagerInterface $em;
    private bool $authCreateUsers;
    private ?PasswordHasherFactoryInterface $passwordHasherFactory;
    private ?LoggerInterface $logger;

    public function __construct(
        AccessTokenHandlerInterface $casHandler,
        AccessTokenHandlerInterface $oidcUserInfoHandler,
        EntityManagerInterface $em,
        bool $authCreateUsers,
        ?LoggerInterface $logger = null,
        ?JwtTokenHandler $jwtHandler = null,
        ?PasswordHasherFactoryInterface $passwordHasherFactory = null,
    ) {
        $this->casHandler = $casHandler;
        $this->oidcUserInfoHandler = $oidcUserInfoHandler;
        $this->em = $em;
        $this->authCreateUsers = $authCreateUsers;
        $this->logger = $logger;
        $this->jwtHandler = $jwtHandler;
        $this->passwordHasherFactory = $passwordHasherFactory;
    }

    /**
     * Retrieve user badge from access token.
     *
     * Determines the token type and retrieves the user identifier (external identifier).
     *
     * @param string $accessToken the access token
     *
     * @return UserBadge the user badge
     *
     * @throws BadCredentialsException if token format is invalid or identifier is missing
     */
    public function getUserBadgeFrom(string $accessToken): UserBadge
    {
        try {
            // Determine which handler to use based on token format
            if ($this->isCasTicket($accessToken)) {
                $this->logger?->debug('Processing CAS ticket');
                $subBadge = $this->casHandler->getUserBadgeFrom($accessToken);
            } elseif ($this->isJwtToken($accessToken)) {
                $this->logger?->debug('Processing JWT token');
                if ($this->jwtHandler) {
                    try {
                        // Try local JWT first
                        $subBadge = $this->jwtHandler->getUserBadgeFrom($accessToken);
                    } catch (BadCredentialsException $e) {
                        // Fallback to OIDC userinfo flow
                        $this->logger?->debug('Local JWT failed; falling back to OIDC userinfo');
                        $subBadge = $this->oidcUserInfoHandler->getUserBadgeFrom($accessToken);
                    }
                } else {
                    // No local JWT handler configured; use OIDC
                    $subBadge = $this->oidcUserInfoHandler->getUserBadgeFrom($accessToken);
                }
            } else {
                // Try OIDC userinfo for non-JWT bearer tokens (e.g., Google 'ya29...')
                try {
                    $this->logger?->debug('Trying OIDC userinfo as bearer access token');
                    $subBadge = $this->oidcUserInfoHandler->getUserBadgeFrom($accessToken);
                } catch (BadCredentialsException $e) {
                    $this->logger?->warning('OIDC userinfo failed: '.$e->getMessage(), ['exception' => $e]);
                    // Optional API Key flow
                    if ($this->passwordHasherFactory) {
                        $this->logger?->debug('Trying API key token verification');
                        $repo = $this->em->getRepository(User::class);
                        $qb = $repo->createQueryBuilder('u')->where('u.apiToken IS NOT NULL');
                        foreach ($qb->getQuery()->toIterable() as $candidate) {
                            $hasher = $this->passwordHasherFactory->getPasswordHasher($candidate);
                            if ($candidate->getApiToken() && $hasher->verify($candidate->getApiToken(), $accessToken)) {
                                $this->logger?->debug('API key matched user');

                                return new UserBadge(
                                    $candidate->getEmail(),
                                    function (string $identifier) use ($candidate) {
                                        return $candidate;
                                    },
                                    ['api_key' => true]
                                );
                            }
                        }
                    }
                    $message = 'OIDC userinfo failed: '.$e->getMessage();
                    $this->logger?->error($message);
                    throw new BadCredentialsException($message, previous: $e);
                }
            }

            $identifier = $subBadge->getUserIdentifier();

            if (empty($identifier)) {
                $message = 'Identifier not found in CAS/OIDC token.';
                $this->logger?->error($message);
                throw new BadCredentialsException($message);
            }

            return new UserBadge(
                $identifier,
                function (string $identifier) use ($subBadge) {
                    return $this->getUserFromBadge($identifier, $subBadge);
                }
            );
        } catch (BadCredentialsException $e) {
            // Re-throw BadCredentialsException
            throw $e;
        } catch (\Exception $e) {
            // Log and convert other exceptions to BadCredentialsException
            $message = 'Authentication error: '.$e->getMessage();
            $this->logger?->error($message, ['exception' => $e]);
            throw new BadCredentialsException($message, 0, $e);
        }
    }

    /**
     * Process user data from badge and return a User entity.
     * This either retrieves an existing user or creates a new one.
     *
     * @param string    $identifier The user identifier
     * @param UserBadge $subBadge   The badge with user attributes
     *
     * @return User The user entity
     */
    private function getUserFromBadge(string $identifier, UserBadge $subBadge): User
    {
        // Retrieve attributes (claims) from the token
        $claims = $subBadge->getAttributes() ?? [];

        // Debug logging
        $this->logger?->debug('Retrieved attributes from token:', is_array($claims) ? $claims : []);

        // Extract email and other important attributes
        $emailFromClaims = $claims['email'] ?? null;

        // Try to find the user by various identifiers
        $user = $this->findExistingUser($identifier, $emailFromClaims);

        if ($user) {
            $this->updateExistingUser($user, $identifier, $emailFromClaims);

            return $user;
        }

        // If user creation is disabled, throw an exception
        if (!$this->authCreateUsers) {
            $message = "Authentication successful but user creation disabled. User '$identifier' not found.";
            $this->logger?->error($message);
            throw new BadCredentialsException($message);
        }

        // Create a new user
        $user = $this->createNewUser($identifier, $emailFromClaims);
        $this->em->persist($user);
        $this->em->flush();

        return $user;
    }

    /**
     * Find an existing user by external identifier or email.
     *
     * @param string      $identifier The external identifier
     * @param string|null $email      The email from claims
     *
     * @return User|null The found user or null
     */
    private function findExistingUser(string $identifier, ?string $email): ?User
    {
        // Try to find by external identifier
        $user = $this->em->getRepository(User::class)->findOneBy(['externalIdentifier' => $identifier]);
        if ($user) {
            $this->logger?->debug("Found user by external identifier: $identifier");

            return $user;
        }

        // Try to find by email from claims
        if ($email) {
            $user = $this->em->getRepository(User::class)->findOneBy(['email' => $email]);
            if ($user) {
                $this->logger?->debug("Found user by email from claims: $email");

                return $user;
            }
        }

        // Try to find by identifier as email
        if (filter_var($identifier, FILTER_VALIDATE_EMAIL)) {
            $user = $this->em->getRepository(User::class)->findOneBy(['email' => $identifier]);
            if ($user) {
                $this->logger?->debug("Found user by identifier as email: $identifier");

                return $user;
            }
        }

        return null;
    }

    /**
     * Update an existing user with information from token claims.
     * Preserves password for existing password-based accounts.
     *
     * @param User        $user       The user to update
     * @param string      $identifier The external identifier
     * @param string|null $email      Email from claims
     */
    private function updateExistingUser(User $user, string $identifier, ?string $email): void
    {
        $updated = false;

        // Assign the external identifier if the user does not have one
        if (!$user->getExternalIdentifier()) {
            $user->setExternalIdentifier($identifier);
            $this->logger->info("Assigned external identifier '{$identifier}' to user '{$user->getEmail()}'.");
            $updated = true;
        }

        // Update the email if it was set to a temporary domain (domain.local) and a valid email is available
        if ($email && str_ends_with($user->getEmail() ?? '', '@domain.local')) {
            $user->setEmail($email);
            $this->logger->info("Updated temporary email for user '{$identifier}' to: {$email}");
            $updated = true;
        }

        // Persist changes to the database if anything was updated
        if ($updated) {
            $this->em->flush();
        }
    }

    /**
     * Create a new user with data from authentication token.
     *
     * @param string      $externalIdentifier The external identifier
     * @param string|null $email              Email from token
     *
     * @return User The newly created user
     */
    private function createNewUser(
        string $externalIdentifier,
        ?string $email = null,
    ): User {
        $user = new User();
        $user->setExternalIdentifier($externalIdentifier);

        // If no email is provided, check if the identifier is already an email
        if (!$email) {
            $email = filter_var($externalIdentifier, FILTER_VALIDATE_EMAIL)
                ? $externalIdentifier // Use the identifier if it's a valid email
                : "{$externalIdentifier}@domain.local"; // Otherwise, append domain
        }

        $user->setEmail($email);
        $user->setUserId(uniqid('usr_', true));
        $user->setRoles(['ROLE_USER']);

        // Generate secure random password
        $user->setPassword(bin2hex(random_bytes(16)));

        $user->setIsLopdAccepted(true);

        $this->logger?->info("New user created: {$externalIdentifier} with email: {$email}");

        return $user;
    }

    /**
     * Check if token is a CAS ticket.
     *
     * @param string $token The token to check
     *
     * @return bool True if it's a CAS ticket
     */
    private function isCasTicket(string $token): bool
    {
        return str_starts_with($token, 'ST-') || str_starts_with($token, 'PT-');
    }

    /**
     * Check if token is a JWT token.
     *
     * @param string $token The token to check
     *
     * @return bool True if it's a JWT token
     */
    private function isJwtToken(string $token): bool
    {
        return 2 === substr_count($token, '.');
    }
}
