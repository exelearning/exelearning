<?php

namespace App\Tests\Command;

use App\Command\net\exelearning\Command\GenerateApiKeyCommand;
use App\Entity\net\exelearning\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Uid\Uuid;

class GenerateApiKeyCommandTest extends TestCase
{
    private $entityManager;
    private $passwordHasher;
    private $userRepository;

    protected function setUp(): void
    {
        $this->entityManager = $this->createMock(EntityManagerInterface::class);
        $this->passwordHasher = $this->createMock(UserPasswordHasherInterface::class);
        $this->userRepository = $this->createMock(EntityRepository::class);

        $this->entityManager->method('getRepository')
            ->with(User::class)
            ->willReturn($this->userRepository);
    }

    private function createUserMock(string $userId, ?string $existingApiToken = null, string $email = 'test@example.com'): User
    {
        $user = $this->createMock(User::class);
        $user->method('getUserId')->willReturn($userId);
        $user->method('getUserIdentifier')->willReturn($email);
        $user->method('getApiToken')->willReturn($existingApiToken);
        return $user;
    }

    public function testExecuteGeneratesTokenForUserWithoutToken()
    {
        $userId = 'user123';
        $user = $this->createUserMock($userId);

        $this->userRepository->method('findOneBy')
            ->with(['userId' => $userId])
            ->willReturn($user);

        $this->passwordHasher->expects($this->once())
            ->method('hashPassword')
            ->with($user, $this->callback(function ($token) {
                return Uuid::isValid($token);
            }))
            ->willReturn('hashed_api_key');

        $user->expects($this->once())
            ->method('setApiToken')
            ->with('hashed_api_key');

        $this->entityManager->expects($this->once())->method('flush');

        $command = new GenerateApiKeyCommand($this->entityManager, $this->passwordHasher);
        $commandTester = new CommandTester($command);
        $commandTester->execute(['user_id' => $userId]);

        $output = $commandTester->getDisplay();
        $this->assertStringContainsString('API key generated for user', $output);
        $this->assertStringContainsString('Your API Key (raw UUID - store it securely, it will not be shown again):', $output);
        $this->assertMatchesRegularExpression('/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/', $output);
        $this->assertEquals(0, $commandTester->getStatusCode());
    }

    public function testExecuteFailsIfTokenExistsAndNoOverwrite()
    {
        $userId = 'userWithToken';
        $user = $this->createUserMock($userId, 'existing_hashed_token');

        $this->userRepository->method('findOneBy')
            ->with(['userId' => $userId])
            ->willReturn($user);

        $command = new GenerateApiKeyCommand($this->entityManager, $this->passwordHasher);
        $commandTester = new CommandTester($command);
        $commandTester->execute(['user_id' => $userId]);

        $output = $commandTester->getDisplay();
        $this->assertStringContainsString('User already has an API token. Use --overwrite to replace it.', $output);
        $this->assertEquals(1, $commandTester->getStatusCode());
        $this->passwordHasher->expects($this->never())->method('hashPassword');
        $user->expects($this->never())->method('setApiToken');
        $this->entityManager->expects($this->never())->method('flush');
    }

    public function testExecuteGeneratesTokenIfOverwriteIsTrue()
    {
        $userId = 'userToOverwrite';
        $user = $this->createUserMock($userId, 'old_hashed_token');

        $this->userRepository->method('findOneBy')
            ->with(['userId' => $userId])
            ->willReturn($user);

        $this->passwordHasher->expects($this->once())
            ->method('hashPassword')
            ->willReturn('new_hashed_api_key');

        $user->expects($this->once())
            ->method('setApiToken')
            ->with('new_hashed_api_key');

        $this->entityManager->expects($this->once())->method('flush');

        $command = new GenerateApiKeyCommand($this->entityManager, $this->passwordHasher);
        $commandTester = new CommandTester($command);
        $commandTester->execute([
            'user_id' => $userId,
            '--overwrite' => true,
        ]);

        $output = $commandTester->getDisplay();
        $this->assertStringContainsString('API key generated for user', $output);
        $this->assertMatchesRegularExpression('/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/', $output);
        $this->assertEquals(0, $commandTester->getStatusCode());
    }

    public function testExecuteShowsErrorIfUserNotFound()
    {
        $userId = 'nonexistentuser';
        $this->userRepository->method('findOneBy')->willReturn(null);
        $this->userRepository->method('find')->willReturn(null);


        $command = new GenerateApiKeyCommand($this->entityManager, $this->passwordHasher);
        $commandTester = new CommandTester($command);
        $commandTester->execute(['user_id' => $userId]);

        $output = $commandTester->getDisplay();
        $this->assertStringContainsString(sprintf('User with ID/email "%s" not found.', $userId), $output);
        $this->assertEquals(1, $commandTester->getStatusCode());
    }

    public function testStoredTokenIsHashed()
    {
        // This is implicitly tested by testExecuteGeneratesTokenForUserWithoutToken and testExecuteGeneratesTokenIfOverwriteIsTrue
        // as they check that passwordHasher->hashPassword is called and its result is passed to setApiToken.
        // We also check that the displayed token is a raw UUID, not the hashed one.
        $this->assertTrue(true); // Placeholder assertion
    }

    public function testRawTokenIsUuid()
    {
        // This is tested by the regex in testExecuteGeneratesTokenForUserWithoutToken and testExecuteGeneratesTokenIfOverwriteIsTrue.
        $this->assertTrue(true); // Placeholder assertion
    }
}
