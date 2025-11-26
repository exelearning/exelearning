<?php

namespace App\Entity\net\exelearning\Entity;

use App\Repository\net\exelearning\Repository\OdeFilesRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Table(name: 'ode_files')]
#[ORM\Entity(repositoryClass: OdeFilesRepository::class)]
class OdeFiles extends BaseEntity
{
    // Replacement values
    public const ODE_FILES_FILES_DIR = '{{files_dir}}';

    #[ORM\GeneratedValue(strategy: 'AUTO')]
    #[ORM\Column(name: 'ode_id', type: 'string', length: 20, nullable: false, options: ['fixed' => true])]
    protected $odeId;

    #[ORM\Column(name: 'ode_version_id', type: 'string', length: 20, nullable: false, options: ['fixed' => true])]
    protected string $odeVersionId;

    #[ORM\Column(name: 'ode_idevice_id', type: 'string', length: 20, nullable: true, options: ['fixed' => true])]
    protected ?string $odeIdeviceId = null;

    #[ORM\Column(name: 'ode_platform_id', type: 'string', length: 64, nullable: true, options: ['fixed' => true])]
    protected ?string $odePlatformId = null;

    #[ORM\Column(name: 'title', type: 'string', length: 255, nullable: false)]
    protected string $title;

    #[ORM\Column(name: 'version_name', type: 'string', length: 255, nullable: true)]
    protected ?string $versionName = null;

    #[ORM\Column(name: 'file_name', type: 'string', length: 255, nullable: false)]
    protected string $fileName;

    #[ORM\Column(name: 'file_type', type: 'string', length: 32, nullable: false)]
    protected string $fileType;

    #[ORM\Column(name: 'disk_filename', type: 'string', length: 255, nullable: false)]
    protected string $diskFilename;

    #[ORM\Column(name: 'size', type: 'bigint', nullable: false, options: ['unsigned' => true])]
    protected int $size;

    // FIX #695: Column renamed from 'user' to 'username' for PostgreSQL compatibility
    #[ORM\Column(name: 'username', type: 'string', length: 128, nullable: false)]
    protected string $user;

    #[ORM\Column(name: 'is_manual_save', type: 'boolean', nullable: false, options: ['default' => true])]
    protected bool $isManualSave;

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

    public function getOdeIdeviceId(): ?string
    {
        return $this->odeIdeviceId;
    }

    public function setOdeIdeviceId(?string $odeIdeviceId): self
    {
        $this->odeIdeviceId = $odeIdeviceId;

        return $this;
    }

    public function getOdePlatformId(): ?string
    {
        return $this->odePlatformId;
    }

    public function setOdePlatformId(?string $odePlatformId): self
    {
        $this->odePlatformId = $odePlatformId;

        return $this;
    }

    public function getTitle(): ?string
    {
        return $this->title;
    }

    public function setTitle(string $title): self
    {
        $this->title = $title;

        return $this;
    }

    public function getVersionName(): ?string
    {
        return $this->versionName;
    }

    public function setVersionName(?string $versionName): self
    {
        $this->versionName = $versionName;

        return $this;
    }

    public function getFileName(): ?string
    {
        return $this->fileName;
    }

    public function setFileName(string $fileName): self
    {
        $this->fileName = $fileName;

        return $this;
    }

    public function getFileType(): ?string
    {
        return $this->fileType;
    }

    public function setFileType(string $fileType): self
    {
        $this->fileType = $fileType;

        return $this;
    }

    public function getDiskFilename(): ?string
    {
        return $this->diskFilename;
    }

    public function setDiskFilename(string $diskFilename): self
    {
        $this->diskFilename = $diskFilename;

        return $this;
    }

    public function getSize(): ?string
    {
        return $this->size;
    }

    public function setSize(string $size): self
    {
        $this->size = $size;

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

    public function getIsManualSave(): ?bool
    {
        return $this->isManualSave;
    }

    public function setIsManualSave(bool $isManualSave): self
    {
        $this->isManualSave = $isManualSave;

        return $this;
    }

    public function getDiskFilenameWithFilesDir($filesDir): ?string
    {
        return str_replace(self::ODE_FILES_FILES_DIR.DIRECTORY_SEPARATOR, $filesDir, $this->getDiskFilename());
    }
}
