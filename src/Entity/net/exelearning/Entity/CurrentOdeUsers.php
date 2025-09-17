<?php

namespace App\Entity\net\exelearning\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\OpenApi\Model\Operation;
use ApiPlatform\OpenApi\Model\Parameter;
use App\Controller\Api\CurrentOdeUsers\GetUserByComponentAction;
use App\Repository\net\exelearning\Repository\CurrentOdeUsersRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: CurrentOdeUsersRepository::class)]
#[ORM\Table(name: 'current_ode_users')]
#[ApiResource(
    operations: [
        new Get(
            uriTemplate: '/current_ode_users/by_component/{currentComponentId}',
            controller: GetUserByComponentAction::class,
            name: 'get_user_by_component',
            security: 'is_granted("ROLE_ADMIN") or is_granted("ROLE_USER")',
            read: false,
            uriVariables: [],
            openapi: new Operation(
                summary: 'Get user by current component ID',
                description: 'Retrieves a user based on the current component ID',
                parameters: [
                    new Parameter(
                        name: 'currentComponentId',
                        in: 'path',
                        description: 'The current component ID to search for',
                        required: true,
                        schema: ['type' => 'string']
                    ),
                ]
            )
        ),
    ]
)]
#[ORM\Index(name: 'index2', columns: ['ode_id'])]
#[ORM\Index(name: 'index3', columns: ['ode_version_id'])]
#[ORM\Index(name: 'index4', columns: ['ode_session_id'])]
#[ORM\Index(name: 'index5', columns: ['user'])]
#[ORM\Index(name: 'index6', columns: ['ode_session_id', 'user'])]

class CurrentOdeUsers extends BaseEntity
{
    #[ORM\Column(name: 'ode_id', type: 'string', length: 20, nullable: false, options: ['fixed' => true])]
    protected string $odeId;

    #[ORM\Column(name: 'ode_version_id', type: 'string', length: 20, nullable: false, options: ['fixed' => true])]
    protected string $odeVersionId;

    #[ORM\Column(name: 'ode_session_id', type: 'string', length: 20, nullable: false, options: ['fixed' => true])]
    protected string $odeSessionId;

    #[ORM\Column(name: 'user', type: 'string', length: 128, nullable: false)]
    protected string $user;
    #[Groups(['current_ode_users:read'])]

    #[ORM\Column(name: 'last_action', type: 'datetime', nullable: false)]
    protected \DateTime $lastAction;

    #[ORM\Column(name: 'current_page_id', type: 'string', length: 64, nullable: true)]
    protected ?string $currentPageId = null;

    #[ORM\Column(name: 'current_block_id', type: 'string', length: 64, nullable: true)]
    protected ?string $currentBlockId = null;

    #[ORM\Column(name: 'current_component_id', type: 'string', length: 64, nullable: true)]
    protected ?string $currentComponentId = null;

    #[ORM\Column(name: 'ode_page_id_update', type: 'string', length: 64, nullable: true)]
    protected ?string $odePageIdUpdate = null;

    #[ORM\Column(name: 'ode_block_id_update', type: 'string', length: 64, nullable: true)]
    protected ?string $odeBlockIdUpdate = null;

    #[ORM\Column(name: 'ode_component_id_update', type: 'string', length: 64, nullable: true)]
    protected ?string $odeComponentIdUpdate = null;

    #[ORM\Column(name: 'destination_page_id_update', type: 'string', length: 64, nullable: true)]
    protected ?string $destinationPageIdUpdate = null;

    #[ORM\Column(name: 'action_type_update', type: 'string', length: 64, nullable: true)]
    protected ?string $actionTypeUpdate = null;

    #[ORM\Column(name: 'last_sync', type: 'datetime', nullable: false)]
    protected \DateTime $lastSync;

    #[ORM\Column(name: 'sync_save_flag', type: 'boolean', nullable: false)]
    protected bool $syncSaveFlag;

    #[ORM\Column(name: 'sync_nav_structure_flag', type: 'boolean', nullable: false)]
    protected bool $syncNavStructureFlag;

    #[ORM\Column(name: 'sync_pag_structure_flag', type: 'boolean', nullable: false)]
    protected bool $syncPagStructureFlag;

    #[ORM\Column(name: 'sync_components_flag', type: 'boolean', nullable: false)]
    protected bool $syncComponentsFlag;

    #[ORM\Column(name: 'sync_update_flag', type: 'boolean', nullable: false)]
    protected bool $syncUpdateFlag;

    #[ORM\Column(name: 'node_ip', type: 'string', length: 50, nullable: false)]
    protected string $nodeIp;

    public function getOdeId(): ?string
    {
        return $this->odeId;
    }

    public function setOdeId(string $odeId): self
    {
        $this->odeId = $odeId;

        return $this;
    }

    public function getOdeVersionId(): ?string
    {
        return $this->odeVersionId;
    }

    public function setOdeVersionId(string $odeVersionId): self
    {
        $this->odeVersionId = $odeVersionId;

        return $this;
    }

    public function getOdeSessionId(): ?string
    {
        return $this->odeSessionId;
    }

    public function setOdeSessionId(string $odeSessionId): self
    {
        $this->odeSessionId = $odeSessionId;

        return $this;
    }

    public function getUser(): ?string
    {
        return $this->user;
    }

    public function setUser(string $user): self
    {
        $this->user = $user;

        return $this;
    }

    public function getLastAction(): ?\DateTimeInterface
    {
        return $this->lastAction;
    }

    public function setLastAction(\DateTimeInterface $lastAction): self
    {
        $this->lastAction = $lastAction;

        return $this;
    }

    public function getCurrentPageId(): ?string
    {
        return $this->currentPageId;
    }

    public function setCurrentPageId(?string $currentPageId): self
    {
        $this->currentPageId = $currentPageId;

        return $this;
    }

    public function getCurrentBlockId(): ?string
    {
        return $this->currentBlockId;
    }

    public function setCurrentBlockId(?string $currentBlockId): self
    {
        $this->currentBlockId = $currentBlockId;

        return $this;
    }

    public function getCurrentComponentId(): ?string
    {
        return $this->currentComponentId;
    }

    public function setCurrentComponentId(?string $currentComponentId): self
    {
        $this->currentComponentId = $currentComponentId;

        return $this;
    }

    public function getOdePageIdUpdate(): ?string
    {
        return $this->odePageIdUpdate;
    }

    public function setOdePageIdUpdate(?string $odePageIdUpdate): self
    {
        $this->odePageIdUpdate = $odePageIdUpdate;

        return $this;
    }

    public function getOdeBlockIdUpdate(): ?string
    {
        return $this->odeBlockIdUpdate;
    }

    public function setOdeBlockIdUpdate(?string $odeBlockIdUpdate): self
    {
        $this->odeBlockIdUpdate = $odeBlockIdUpdate;

        return $this;
    }

    public function getOdeComponentIdUpdate(): ?string
    {
        return $this->odeComponentIdUpdate;
    }

    public function setOdeComponentIdUpdate(?string $odeComponentIdUpdate): self
    {
        $this->odeComponentIdUpdate = $odeComponentIdUpdate;

        return $this;
    }

    public function getDestinationPageIdUpdate(): ?string
    {
        return $this->destinationPageIdUpdate;
    }

    public function setDestinationPageIdUpdate(?string $destinationPageIdUpdate): self
    {
        $this->destinationPageIdUpdate = $destinationPageIdUpdate;

        return $this;
    }

    public function getActionTypeUpdate(): ?string
    {
        return $this->actionTypeUpdate;
    }

    public function setActionTypeUpdate(?string $actionTypeUpdate): self
    {
        $this->actionTypeUpdate = $actionTypeUpdate;

        return $this;
    }

    public function getLastSync(): ?\DateTimeInterface
    {
        return $this->lastSync;
    }

    public function setLastSync(\DateTimeInterface $lastSync): self
    {
        $this->lastSync = $lastSync;

        return $this;
    }

    public function getSyncSaveFlag(): ?bool
    {
        return $this->syncSaveFlag;
    }

    public function setSyncSaveFlag(bool $syncSaveFlag): self
    {
        $this->syncSaveFlag = $syncSaveFlag;

        return $this;
    }

    public function getSyncNavStructureFlag(): ?bool
    {
        return $this->syncNavStructureFlag;
    }

    public function setSyncNavStructureFlag(bool $syncNavStructureFlag): self
    {
        $this->syncNavStructureFlag = $syncNavStructureFlag;

        return $this;
    }

    public function getSyncPagStructureFlag(): ?bool
    {
        return $this->syncPagStructureFlag;
    }

    public function setSyncPagStructureFlag(bool $syncPagStructureFlag): self
    {
        $this->syncPagStructureFlag = $syncPagStructureFlag;

        return $this;
    }

    public function getSyncComponentsFlag(): ?bool
    {
        return $this->syncComponentsFlag;
    }

    public function setSyncComponentsFlag(bool $syncComponentsFlag): self
    {
        $this->syncComponentsFlag = $syncComponentsFlag;

        return $this;
    }

    public function getSyncUpdateFlag(): ?bool
    {
        return $this->syncUpdateFlag;
    }

    public function setSyncUpdateFlag(bool $syncUpdateFlag): self
    {
        $this->syncUpdateFlag = $syncUpdateFlag;

        return $this;
    }

    public function getNodeIp(): ?string
    {
        return $this->nodeIp;
    }

    public function setNodeIp(string $nodeIp): self
    {
        $this->nodeIp = $nodeIp;

        return $this;
    }
}
