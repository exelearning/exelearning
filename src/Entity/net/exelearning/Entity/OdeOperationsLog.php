<?php

namespace App\Entity\net\exelearning\Entity;

use App\Repository\net\exelearning\Repository\OdeOperationsLogRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Table(name: 'ode_operations_log')]
#[ORM\Entity(repositoryClass: OdeOperationsLogRepository::class)]
class OdeOperationsLog extends BaseEntity
{
    #[ORM\Column(name: 'ode_id', type: 'string', length: 20, nullable: false, options: ['fixed' => true])]
    protected string $odeId;

    #[ORM\Column(name: 'ode_version_id', type: 'string', length: 20, nullable: false, options: ['fixed' => true])]
    protected string $odeVersionId;

    #[ORM\Column(name: 'ode_session_id', type: 'string', length: 20, nullable: false, options: ['fixed' => true])]
    protected string $odeSessionId;

    #[ORM\Column(name: 'operation', type: 'string', length: 16, nullable: false)]
    protected string $operation;

    #[ORM\Column(name: 'id_source', type: 'string', length: 20, nullable: false, options: ['fixed' => true])]
    protected string $idSource;

    #[ORM\Column(name: 'id_destination', type: 'string', length: 20, nullable: true, options: ['fixed' => true])]
    protected ?string $idDestination = null;

    // FIX #695: Column renamed from 'user' to 'username' for PostgreSQL compatibility
    #[ORM\Column(name: 'username', type: 'string', length: 128, nullable: false)]
    protected string $user;

    #[ORM\Column(name: 'additional_data', type: 'string', length: 4096, nullable: true)]
    protected ?string $additionalData = null;

    #[ORM\Column(name: 'done_flag', type: 'integer', nullable: false)]
    protected int $doneFlag;

    #[ORM\Column(name: 'done_datetime', type: 'datetime', nullable: true)]
    protected ?\DateTime $doneDatetime = null;

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

    public function getOperation(): ?string
    {
        return $this->operation;
    }

    public function setOperation(string $operation): self
    {
        $this->operation = $operation;

        return $this;
    }

    public function getIdSource(): ?string
    {
        return $this->idSource;
    }

    public function setIdSource(string $idSource): self
    {
        $this->idSource = $idSource;

        return $this;
    }

    public function getIdDestination(): ?string
    {
        return $this->idDestination;
    }

    public function setIdDestination(?string $idDestination): self
    {
        $this->idDestination = $idDestination;

        return $this;
    }

    public function getUser(): ?string
    {
        return $this->user;
    }

    public function setUser(?string $user): self
    {
        $this->user = $user;

        return $this;
    }

    public function getAdditionalData(): ?string
    {
        return $this->additionalData;
    }

    public function setAdditionalData(?string $additionalData): self
    {
        $this->additionalData = $additionalData;

        return $this;
    }

    public function getDoneFlag(): ?int
    {
        return $this->doneFlag;
    }

    public function setDoneFlag(int $doneFlag): self
    {
        $this->doneFlag = $doneFlag;

        return $this;
    }

    public function getDoneDatetime(): ?\DateTimeInterface
    {
        return $this->doneDatetime;
    }

    public function setDoneDatetime(?\DateTimeInterface $doneDatetime): self
    {
        $this->doneDatetime = $doneDatetime;

        return $this;
    }
}
