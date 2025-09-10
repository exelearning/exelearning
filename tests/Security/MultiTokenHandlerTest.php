<?php

namespace App\Tests\Security;

use App\Entity\net\exelearning\Entity\User;
use App\Security\MultiTokenHandler;
use App\Security\OidcUserInfoTokenHandlerCustom;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Symfony\Component\Security\Core\Exception\BadCredentialsException;
use Symfony\Component\Security\Http\AccessToken\AccessTokenHandlerInterface;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;

class MultiTokenHandlerTest extends TestCase
{
    private MultiTokenHandler $tokenHandler;
    private EntityManagerInterface $entityManager;
    private AccessTokenHandlerInterface $casHandler;
    private OidcUserInfoTokenHandlerCustom $oidcHandler;
    private LoggerInterface $logger;
    private EntityRepository $userRepository;

    protected function setUp(): void
    {
        // Create a mock for the CAS handler interface
        $this->casHandler = $this->createMock(AccessTokenHandlerInterface::class);
        
        // Create a mock for the OIDC handler
        $this->oidcHandler = $this->createMock(OidcUserInfoTokenHandlerCustom::class);
        
        // Create a mock for the user repository
        $this->userRepository = $this->createMock(EntityRepository::class);
        
        // Create a mock for the entity manager
        $this->entityManager = $this->createMock(EntityManagerInterface::class);
        $this->entityManager->method('getRepository')
            ->with(User::class)
            ->willReturn($this->userRepository);
        
        // Create a mock for the logger
        $this->logger = $this->createMock(LoggerInterface::class);
        
        // Instantiate the MultiTokenHandler with mocks
        $this->tokenHandler = new MultiTokenHandler(
            $this->casHandler,
            $this->oidcHandler,
            $this->entityManager,
            true, // authCreateUsers = true
            $this->logger
        );
    }

/**
 * Test handling a CAS ticket with a new user.
 */
public function testHandleCasTicket(): void
{
    $casTicket = 'ST-1234-abcdefg';
    $identifier = 'user123';
    $email = 'user@example.com';
    
    // Create a UserBadge with attributes
    $userBadge = new UserBadge(
        $identifier,
        null,
        ['email' => $email]
    );
    
    // Configure the CAS handler mock
    $this->casHandler->expects($this->once())
        ->method('getUserBadgeFrom')
        ->with($casTicket)
        ->willReturn($userBadge);
    
    // Relaxed logging expectations - don't check specific messages
    $this->logger->expects($this->atLeastOnce())
        ->method('debug');
    
    // Configure user repository to not find a user
    $this->userRepository->method('findOneBy')
        ->willReturnCallback(function($criteria) use ($identifier, $email) {
            // Always return null for all findOneBy calls in this test
            return null;
        });
        
    // Expect persist and flush calls for user creation
    $this->entityManager->expects($this->once())
        ->method('persist')
        ->with($this->callback(function ($user) use ($identifier, $email) {
            return $user instanceof User 
                && $user->getEmail() === $email
                && $user->getExternalIdentifier() === $identifier;
        }));
        
    $this->entityManager->expects($this->once())
        ->method('flush');
        
    // Execute the method under test
    $result = $this->tokenHandler->getUserBadgeFrom($casTicket);
    $this->assertInstanceOf(UserBadge::class, $result);
    $this->assertEquals($identifier, $result->getUserIdentifier());
    
    // Invoke the UserBadge callback to load/create the user
    $userLoader = $result->getUserLoader();
    $user = $userLoader($identifier);
    $this->assertInstanceOf(User::class, $user);
    $this->assertEquals($email, $user->getEmail());
    $this->assertEquals($identifier, $user->getExternalIdentifier());
}
/**
 * Test handling an OIDC token with an existing user.
 */
public function testHandleOidcToken(): void
{
    $jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJ1c2VyQGV4YW1wbGUuY29tIn0.signature';
    $identifier = 'sub_12345';
    $email = 'user@example.com';
    
    // Create a UserBadge with attributes
    $userBadge = new UserBadge(
        $identifier,
        null,
        ['email' => $email]
    );
    
    // Configure the OIDC handler mock
    $this->oidcHandler->expects($this->once())
        ->method('getUserBadgeFrom')
        ->with($jwtToken)
        ->willReturn($userBadge);
    
    // Relaxed logging expectations - don't check specific messages
    $this->logger->expects($this->atLeastOnce())
        ->method('debug');
    
    // Create an existing user
    $existingUser = new User();
    $existingUser->setEmail($email);
    $existingUser->setRoles(['ROLE_USER']);
    // Initialize with a dummy external identifier to avoid null issues
    $existingUser->setExternalIdentifier('');
    
    // Configure user repository to find the user by email
    $this->userRepository->method('findOneBy')
        ->willReturnCallback(function($criteria) use ($identifier, $email, $existingUser) {
            if (isset($criteria['externalIdentifier']) && $criteria['externalIdentifier'] === $identifier) {
                return null;
            }
            if (isset($criteria['email']) && $criteria['email'] === $email) {
                return $existingUser;
            }
            return null;
        });
    
    // Expect user to be updated
    $this->entityManager->expects($this->once())
        ->method('flush');
        
    // Execute the method under test
    $result = $this->tokenHandler->getUserBadgeFrom($jwtToken);
    $this->assertInstanceOf(UserBadge::class, $result);
    $this->assertEquals($identifier, $result->getUserIdentifier());
    
    // Invoke the callback to get the existing user
    $userLoader = $result->getUserLoader();
    $user = $userLoader($identifier);
    $this->assertSame($existingUser, $user);
}


    /**
     * Test handling a user with a temporary email.
     */
    public function testUpdateUserWithTemporaryEmail(): void
    {
        $jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJ1c2VyQGV4YW1wbGUuY29tIn0.signature';
        $identifier = 'user123';
        $temporaryEmail = 'user123@domain.local';
        $realEmail = 'user@example.com';
        
        // Create a UserBadge with attributes
        $userBadge = new UserBadge(
            $identifier,
            null,
            ['email' => $realEmail]
        );
        
        // Configure the OIDC handler mock
        $this->oidcHandler->expects($this->once())
            ->method('getUserBadgeFrom')
            ->with($jwtToken)
            ->willReturn($userBadge);
        
        // Create an existing user with temporary email
        $existingUser = new User();
        $existingUser->setEmail($temporaryEmail);
        $existingUser->setExternalIdentifier($identifier);
        $existingUser->setRoles(['ROLE_USER']);
        
        // Configure user repository
        $this->userRepository->expects($this->atLeastOnce())
            ->method('findOneBy')
            ->willReturnCallback(function($criteria) use ($identifier, $existingUser) {
                if (isset($criteria['externalIdentifier']) && $criteria['externalIdentifier'] === $identifier) {
                    return $existingUser;
                }
                return null;
            });
            
        // Expect the user to be updated with real email
        $this->entityManager->expects($this->once())
            ->method('flush');
        
        // Expect info logging about email update
        $this->logger->expects($this->once())
            ->method('info')
            ->with($this->stringContains("Updated temporary email for user"));
            
        // Execute the method under test
        $result = $this->tokenHandler->getUserBadgeFrom($jwtToken);
        $userLoader = $result->getUserLoader();
        $user = $userLoader($identifier);
        
        // Assert email was updated
        $this->assertEquals($realEmail, $user->getEmail());
    }
    
    /**
     * Test handling an invalid token format.
     */
    public function testInvalidTokenFormat(): void
    {
        $invalidToken = 'invalid-token-format';
        
        // Expect error logging
        $this->logger->expects($this->once())
            ->method('error')
            ->with('Invalid token format: neither CAS ticket nor JWT.');
        
        $this->expectException(BadCredentialsException::class);
        $this->expectExceptionMessage('Invalid token format: neither CAS ticket nor JWT.');
        
        $this->tokenHandler->getUserBadgeFrom($invalidToken);
    }
    
    /**
     * Test that user creation is blocked when disabled.
     */
    public function testUserCreationDisabled(): void
    {
        // Create a token handler with user creation disabled
        $tokenHandler = new MultiTokenHandler(
            $this->casHandler,
            $this->oidcHandler,
            $this->entityManager,
            false, // authCreateUsers = false
            $this->logger
        );

        $casTicket = 'ST-1234-abcdefg';
        $identifier = 'user123';
        $email = 'user@example.com';

        // Create a UserBadge with attributes
        $userBadge = new UserBadge(
            $identifier,
            null,
            ['email' => $email]
        );

        $this->casHandler->expects($this->once())
            ->method('getUserBadgeFrom')
            ->with($casTicket)
            ->willReturn($userBadge);

        // Configure user repository to not find a user
        $this->userRepository->method('findOneBy')
            ->willReturn(null);

        // Expect error logging
        $this->logger->expects($this->once())
            ->method('error')
            ->with($this->stringContains("Authentication successful but user creation disabled"));

        $this->expectException(BadCredentialsException::class);
        $this->expectExceptionMessage("Authentication successful but user creation disabled.");

        $result = $tokenHandler->getUserBadgeFrom($casTicket);
        $userLoader = $result->getUserLoader();
        $userLoader($identifier); // Should throw an exception
    }

    /**
     * Test that a token without an identifier throws an exception.
     */
    public function testHandleTokenThrowsExceptionWhenNoIdentifier(): void
    {
        $casTicket = 'ST-1234-abcdefg';
        
        // Return a UserBadge with an empty identifier.
        $userBadge = $this->createMock(UserBadge::class);
        $userBadge->method('getUserIdentifier')->willReturn('');
        
        $this->casHandler->expects($this->once())
            ->method('getUserBadgeFrom')
            ->with($casTicket)
            ->willReturn($userBadge);
        
        // Expect the logger to report the missing identifier.
        $this->logger->expects($this->once())
            ->method('error')
            ->with('Identifier not found in CAS/OIDC token.');
        
        $this->expectException(BadCredentialsException::class);
        $this->expectExceptionMessage('Identifier not found in CAS/OIDC token.');
        
        $this->tokenHandler->getUserBadgeFrom($casTicket);
    }

    /**
     * Test handling an exception from the delegate handlers.
     */
    public function testHandleExceptionFromDelegateHandler(): void
    {
        $casTicket = 'ST-1234-abcdefg';
        $exceptionMessage = 'Validation failed';
        
        // Make the CAS handler throw an exception
        $this->casHandler->expects($this->once())
            ->method('getUserBadgeFrom')
            ->with($casTicket)
            ->willThrowException(new \RuntimeException($exceptionMessage));
        
        // Expect error logging
        $this->logger->expects($this->once())
            ->method('error')
            ->with($this->stringContains('Authentication error'), $this->anything());
        
        $this->expectException(BadCredentialsException::class);
        $this->expectExceptionMessage('Authentication error: ' . $exceptionMessage);
        
        $this->tokenHandler->getUserBadgeFrom($casTicket);
    }
}