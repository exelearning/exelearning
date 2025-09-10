<?php

namespace App\Entity\net\exelearning\Entity;

use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiProperty;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Put;
use ApiPlatform\OpenApi\Model as OpenApiModel;
use App\ApiFilter\UserRoleFilter;
use App\ApiFilter\UserSearchFilter;
use App\Constants;
use App\Controller\Api\User\BlockUserAction;
use App\Controller\Api\User\UpdateQuotaAction;
use App\Controller\Api\User\UserStatsAction;
use App\Repository\net\exelearning\Repository\UserRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: UserRepository::class)]
#[ORM\Table(name: 'users')] // Pluralize name to fix an error because PosgreSQL has `user` as reserved word
#[ApiResource(
    operations: [
        new GetCollection(
            security: 'is_granted("ROLE_USER")',
            normalizationContext: ['groups' => ['user:read']],
            openapi: new OpenApiModel\Operation(
                summary: 'List users',
                description: 'Admins see all users and can filter by email, role, or userId. Non-admins only see their own user profile; filters have no effect for non-admins.'
            )
        ),
        new Post(
            security: 'is_granted("ROLE_ADMIN")',
            denormalizationContext: ['groups' => ['user:write']]
        ),
        new Get(
            security: 'is_granted("ROLE_ADMIN") or object.getId() == user.getId() or object.getEmail() == user.getUserIdentifier()',
            securityMessage: 'Only admins or the owner can view this user.',
            normalizationContext: ['groups' => ['user:read']]
        ),
        new Put(
            security: 'is_granted("ROLE_ADMIN") or object.getId() == user.getId()',
            securityMessage: 'Only admins or the owner can update the user.',
            securityPostDenormalize: 'is_granted("ROLE_ADMIN") or (object.getId() == user.getId() and object.getRoles() == previous_object.getRoles())',
            securityPostDenormalizeMessage: 'Only admins can change roles.',
            denormalizationContext: ['groups' => ['user:write']],
            normalizationContext: ['groups' => ['user:read']]
        ),
        new Patch(
            security: 'is_granted("ROLE_ADMIN") or object.getId() == user.getId()',
            securityMessage: 'Only admins or the owner can patch the user.',
            securityPostDenormalize: 'is_granted("ROLE_ADMIN") or (object.getId() == user.getId() and object.getRoles() == previous_object.getRoles())',
            securityPostDenormalizeMessage: 'Only admins can change roles.',
            denormalizationContext: ['groups' => ['user:write']],
            normalizationContext: ['groups' => ['user:read']]
        ),
        new Delete(
            security: 'is_granted("ROLE_ADMIN")',
            securityMessage: 'Only admins can delete users.'
        ),
        // Custom: block/disable a user
        new Post(
            uriTemplate: '/users/{id}/block',
            controller: BlockUserAction::class,
            name: 'user_block',
            security: 'is_granted("ROLE_ADMIN")',
            read: true,
            deserialize: false,
            openapi: new OpenApiModel\Operation(
                summary: 'Block/disable a user',
                description: 'Sets isActive=false to disable the user.'
            )
        ),
        // Custom: update quota
        new Patch(
            uriTemplate: '/users/{id}/quota',
            controller: UpdateQuotaAction::class,
            name: 'user_update_quota',
            security: 'is_granted("ROLE_ADMIN")',
            read: true,
            deserialize: true,
            openapi: new OpenApiModel\Operation(
                summary: 'Update user quota',
                description: 'Updates quota-related parameters for the user.'
            )
        ),
        // Custom: user statistics
        new Get(
            uriTemplate: '/users/{id}/stats',
            controller: UserStatsAction::class,
            name: 'user_stats',
            security: 'is_granted("ROLE_ADMIN") or object == user',
            read: true,
            output: false,
            openapi: new OpenApiModel\Operation(
                summary: 'Get user statistics',
                description: 'Returns usage stats like used space, projects count, etc.'
            )
        ),
    ],
    normalizationContext: ['groups' => ['user:read']],
    denormalizationContext: ['groups' => ['user:write']]
)]
#[ApiFilter(SearchFilter::class, properties: [
    'email' => 'partial',
    'userId' => 'partial',
])]
#[ApiFilter(UserRoleFilter::class)]
#[ApiFilter(UserSearchFilter::class)]
class User extends BaseEntity implements UserInterface, PasswordAuthenticatedUserInterface
{
    #[Groups(['user:read'])]
    #[ApiProperty(readable: true, writable: false)]
    public function getId(): ?int
    {
        return parent::getId();
    }

    #[Groups(['user:read'])]
    #[ORM\Column(type: 'string', length: 180, unique: true, nullable: true)]
    private ?string $externalIdentifier = null; // sub (OIDC) or uid (CAS)

    #[Groups(['user:write'])]
    #[ORM\Column(type: 'string', length: 255, nullable: true, unique: true)]
    private ?string $apiToken = null;

    #[Groups(['user:read', 'user:write'])]
    #[ORM\Column(name: 'email', type: 'string', length: 180, unique: true)]
    private string $email;

    #[Groups(['user:read', 'user:write'])]
    #[ORM\Column(name: 'roles', type: 'json')]
    private array $roles = [];

    #[Groups(['user:read', 'user:write'])]
    #[ORM\Column(name: 'user_id', type: 'string', length: 40)]
    private string $userId;

    #[Groups(['user:write'])]
    #[ORM\Column(name: 'password', type: 'string')]
    private string $password;

    #[Groups(['user:read', 'user:write'])]
    #[ORM\Column(name: 'is_lopd_accepted', type: 'boolean')]
    private bool $isLopdAccepted;

    #[Groups(['user:read', 'user:write'])]
    #[ORM\Column(name: 'quota_mb', type: 'integer', nullable: true)]
    private ?int $quotaMb = null;

    /**
     * Returns the user's Gravatar URL computed from the email.
     *
     * Parameters used in the Gravatar URL:
     * - `s=96`: Sets the image size to 96x96 pixels.
     * - `d=mm`: Uses the 'mystery man' default image if no avatar is found.
     * - `r=g`: Restricts the image to the 'G' rating (safe for all audiences).
     *
     * @return void
     */
    #[Groups(['user:read'])]
    #[ApiProperty(readable: true, writable: false)]
    public function getGravatarUrl(): ?string
    {
        $email = trim((string) $this->getEmail());
        if ('' === $email) {
            return null;
        }

        $hash = md5(strtolower($email));

        return Constants::GRAVATAR_BASE_URL.$hash.'?s=96&d=mm&r=g';
    }

    public function getExternalIdentifier(): ?string
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

    public function getQuotaMb(): ?int
    {
        return $this->quotaMb;
    }

    public function setQuotaMb(?int $quotaMb): self
    {
        $this->quotaMb = $quotaMb;

        return $this;
    }
}
