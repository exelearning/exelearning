<?php

namespace App\Entity\net\exelearning\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Put;
use App\Controller\Api\UserPreferences\DeleteUserPreferenceAction;
use App\Controller\Api\UserPreferences\GetUserPreferenceAction;
use App\Controller\Api\UserPreferences\ListUserPreferencesAction;
use App\Controller\Api\UserPreferences\UpsertUserPreferenceAction;
use App\Repository\net\exelearning\Repository\UserPreferencesRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Table(name: 'user_preferences')]
#[ORM\Index(name: 'fk_user_preferences_1_idx', columns: ['user_id'])]
#[ORM\Entity(repositoryClass: UserPreferencesRepository::class)]
#[ApiResource(
    operations: [
        new GetCollection(
            uriTemplate: '/users/{userId}/preferences',
            controller: ListUserPreferencesAction::class,
            read: false
        ),
        new Get(
            uriTemplate: '/users/{userId}/preferences/{key}',
            controller: GetUserPreferenceAction::class,
            read: false
        ),
        new Put(
            uriTemplate: '/users/{userId}/preferences/{key}',
            controller: UpsertUserPreferenceAction::class,
            read: false
        ),
        new Delete(
            uriTemplate: '/users/{userId}/preferences/{key}',
            controller: DeleteUserPreferenceAction::class,
            read: false
        ),
    ],
    normalizationContext: ['groups' => ['user_prefs:read']],
    denormalizationContext: ['groups' => ['user_prefs:write']]
)]
class UserPreferences extends BaseEntity
{
    #[Groups(['user_prefs:read', 'user_prefs:write'])]
    #[ORM\Column(name: 'user_id', type: 'string', length: 255, nullable: false)]
    protected string $userId;

    #[Groups(['user_prefs:read', 'user_prefs:write'])]
    #[ORM\Column(name: 'user_preferences_key', type: 'string', length: 255, nullable: false)]
    protected string $key;

    #[Groups(['user_prefs:read', 'user_prefs:write'])]
    #[ORM\Column(name: 'user_preferences_value', type: 'text', nullable: false)]
    protected string $value;

    #[Groups(['user_prefs:read', 'user_prefs:write'])]
    #[ORM\Column(name: 'description', type: 'text', nullable: true)]
    protected ?string $description = null;

    public function getUserId(): ?string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): self
    {
        $this->userId = $userId;

        return $this;
    }

    public function getKey(): ?string
    {
        return $this->key;
    }

    public function setKey(string $key): self
    {
        $this->key = $key;

        return $this;
    }

    public function getValue(): ?string
    {
        return $this->value;
    }

    public function setValue(string $value): self
    {
        $this->value = $value;

        return $this;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): self
    {
        $this->description = $description;

        return $this;
    }

    /**
     * Loads key and value from properties constants config.
     *
     * @return self
     */
    public function loadFromPropertiesConfig(
        string $userId,
        string $userPreferencesConfigKey,
        array $userPreferencesConfigValues,
    ) {
        $this->setUserId($userId);
        $this->setKey($userPreferencesConfigKey);

        $value = isset($userPreferencesConfigValues['value']) ? $userPreferencesConfigValues['value'] : '';
        $this->setValue($value);

        return $this;
    }
}
