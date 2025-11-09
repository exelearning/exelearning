<?php

namespace App\Service\Elp;

use App\Entity\net\exelearning\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Manages ephemeral users for API conversion/export operations.
 *
 * Ephemeral users are temporary users created for the duration of a conversion
 * or export operation and then removed to avoid polluting the database.
 */
class EphemeralUserManager
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    /**
     * Create an ephemeral user for API operations.
     *
     * @return User The created ephemeral user
     */
    public function createEphemeralUser(): User
    {
        $user = new User();
        $email = sprintf('api-tmp+%s@local', bin2hex(random_bytes(6)));
        $userId = bin2hex(random_bytes(20));
        $password = bin2hex(random_bytes(12));

        $user->setEmail($email);
        $user->setUserId($userId);
        $user->setPassword($password);
        $user->setIsLopdAccepted(true);

        $this->entityManager->persist($user);
        $this->entityManager->flush();

        return $user;
    }

    /**
     * Remove an ephemeral user.
     *
     * @param User $user The ephemeral user to remove
     */
    public function removeEphemeralUser(User $user): void
    {
        try {
            $managed = $this->entityManager->contains($user) ? $user : $this->entityManager->merge($user);
            $this->entityManager->remove($managed);
            $this->entityManager->flush();
        } catch (\Throwable $e) {
            // Ignore if already removed or DB cleanup fails
        }
    }
}
