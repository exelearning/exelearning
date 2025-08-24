<?php

namespace App\Entity\net\exelearning\Entity;

use App\Repository\net\exelearning\Repository\UserRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;

#[ORM\Entity(repositoryClass: UserRepository::class)]
#[ORM\Table(name: 'users')] // Pluralize name to fix an error because PosgreSQL Have `user` as reserved word
class User extends BaseEntity implements UserInterface, PasswordAuthenticatedUserInterface
{
    #[ORM\Column(type: 'string', length: 180, unique: true, nullable: true)]
    private ?string $externalIdentifier = null; // sub (OIDC) or uid (CAS)

    #[ORM\Column(type: 'string', length: 255, nullable: true, unique: true)]
    private ?string $apiToken = null;

    #[ORM\Column(name: 'email', type: 'string', length: 180, unique: true)]
    private string $email;

    #[ORM\Column(name: 'roles', type: 'json')]
    private array $roles = [];

    #[ORM\Column(name: 'user_id', type: 'string', length: 40)]
    private string $userId;

    #[ORM\Column(name: 'password', type: 'string')]
    private string $password;

    #[ORM\Column(name: 'is_lopd_accepted', type: 'boolean')]
    private bool $isLopdAccepted;

    public function getExternalIdentifier(): string
    {
        return $this->externalIdentifier;
    }

    public function setExternalIdentifier(string $externalIdentifier): self
    {
        $this->externalIdentifier = $externalIdentifier;

        return $this;
    }

    public function getApiToken(): ?string
    {
        return $this->apiToken;
    }

    public function setApiToken(?string $apiToken): self
    {
        $this->apiToken = $apiToken;

        return $this;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): self
    {
        $this->userId = $userId;

        return $this;
    }

    public function getIsLopdAccepted(): ?bool
    {
        return $this->isLopdAccepted;
    }

    public function setIsLopdAccepted(bool $isLopdAccepted): self
    {
        $this->isLopdAccepted = $isLopdAccepted;

        return $this;
    }

    public function getEmail(): ?string
    {
        return $this->email;
    }

    public function setEmail(string $email): self
    {
        $this->email = $email;

        return $this;
    }

    public function getUserIdentifier(): string
    {
        return $this->email;
    }

    public function getRoles(): array
    {
        $roles = $this->roles;
        $roles[] = 'ROLE_USER';

        return array_unique($roles);
    }

    public function setRoles(array $roles): self
    {
        $this->roles = $roles;

        return $this;
    }

    public function getPassword(): string
    {
        return $this->password;
    }

    public function setPassword(string $password): self
    {
        $this->password = $password;

        return $this;
    }

    public function getSalt(): ?string
    {
        return null;
    }

    #[\Deprecated('Not needed as no sensitive temporary data is stored.')]
    public function eraseCredentials(): void
    {
        // Clear temporary sensitive data here, if any
    }

    /**
     * A visual identifier that represents this user.
     *
     * @see UserInterface
     */
    public function getUsername(): string
    {
        return $this->getUserIdentifier();
    }
}
