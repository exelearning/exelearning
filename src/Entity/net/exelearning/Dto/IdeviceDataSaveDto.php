<?php

namespace App\Entity\net\exelearning\Dto;

use Symfony\Component\Serializer\Annotation\SerializedName;

/**
 * IdeviceDataSaveDto.
 */
class IdeviceDataSaveDto extends BaseDto
{
    /**
     * @var string
     */
    protected $responseMessage;

    /**
     * @var string
     */
    protected $odeComponentsSyncId;

    /**
     * @var OdeComponentsSyncDto
     */
    protected $odeComponentsSync;

    /**
     * @var bool
     */
    #[SerializedName('newOdeComponentsSync')]
    protected $isNewOdeComponentsSync;

    /**
     * @var string
     */
    protected $iDeviceDirCreated;

    /**
     * @var OdeComponentsSyncDto[]
     */
    protected $odeComponentsSyncs;

    /**
     * @var string
     */
    protected $odePagStructureSyncId;

    /**
     * @var OdePagStructureSyncDto
     */
    protected $odePagStructureSync;

    /**
     * @var bool
     */
    #[SerializedName('newOdePagStructureSync')]
    protected $isNewOdePagStructureSync;

    /**
     * @var OdePagStructureSyncDto[]
     */
    protected $odePagStructureSyncs;

    /**
     * @var string
     */
    protected $odeNavStructureSyncId;

    /**
     * @var OdeNavStructureSyncDto
     */
    protected $odeNavStructureSync;

    /**
     * @var bool
     */
    #[SerializedName('newOdeNavStructureSync')]
    protected $isNewOdeNavStructureSync;

    public function __construct()
    {
        $this->odeComponentsSyncs = [];
        $this->odePagStructureSyncs = [];
    }

    /**
     * @return string
     */
    public function getResponseMessage()
    {
        return $this->responseMessage;
    }

    /**
     * @param string $responseMessage
     */
    public function setResponseMessage($responseMessage)
    {
        $this->responseMessage = $responseMessage;
    }

    /**
     * @return string
     */
    public function getOdeComponentsSyncId()
    {
        return $this->odeComponentsSyncId;
    }

    /**
     * @param string $odeComponentsSyncId
     */
    public function setOdeComponentsSyncId($odeComponentsSyncId)
    {
        $this->odeComponentsSyncId = $odeComponentsSyncId;
    }

    /**
     * @return OdeComponentsSyncDto
     */
    public function getOdeComponentsSync()
    {
        return $this->odeComponentsSync;
    }

    /**
     * @param OdeComponentsSyncDto $odeComponentsSync
     */
    public function setOdeComponentsSync($odeComponentsSync)
    {
        $this->odeComponentsSync = $odeComponentsSync;
    }

    /**
     * @return bool
     */
    public function isNewOdeComponentsSync()
    {
        return $this->isNewOdeComponentsSync;
    }

    /**
     * @param bool $isNewOdeComponentsSync
     */
    public function setIsNewOdeComponentsSync($isNewOdeComponentsSync)
    {
        $this->isNewOdeComponentsSync = $isNewOdeComponentsSync;
    }

    /**
     * @return string
     */
    public function getIDeviceDirCreated()
    {
        return $this->iDeviceDirCreated;
    }

    /**
     * @param string $iDeviceDirCreated
     */
    public function setIDeviceDirCreated($iDeviceDirCreated)
    {
        $this->iDeviceDirCreated = $iDeviceDirCreated;
    }

    /**
     * @return multitype:\App\Entity\net\exelearning\Dto\OdeComponentsSyncDto
     */
    public function getOdeComponentsSyncs()
    {
        return $this->odeComponentsSyncs;
    }

    /**
     * @param multitype:\App\Entity\net\exelearning\Dto\OdeComponentsSyncDto $odeComponentsSyncs
     */
    public function setOdeComponentsSyncs($odeComponentsSyncs)
    {
        $this->odeComponentsSyncs = $odeComponentsSyncs;
    }

    /**
     * @param OdeComponentsSyncDto $odeComponentsSync
     */
    public function addOdeComponentsSyncs($odeComponentsSync)
    {
        $this->odeComponentsSyncs[] = $odeComponentsSync;
    }

    /**
     * @return string
     */
    public function getOdePagStructureSyncId()
    {
        return $this->odePagStructureSyncId;
    }

    /**
     * @param string $odePagStructureSyncId
     */
    public function setOdePagStructureSyncId($odePagStructureSyncId)
    {
        $this->odePagStructureSyncId = $odePagStructureSyncId;
    }

    /**
     * @return OdePagStructureSyncDto
     */
    public function getOdePagStructureSync()
    {
        return $this->odePagStructureSync;
    }

    /**
     * @param OdePagStructureSyncDto $odePagStructureSync
     */
    public function setOdePagStructureSync($odePagStructureSync)
    {
        $this->odePagStructureSync = $odePagStructureSync;
    }

    /**
     * @return bool
     */
    public function isNewOdePagStructureSync()
    {
        return $this->isNewOdePagStructureSync;
    }

    /**
     * @param bool $isNewOdePagStructureSync
     */
    public function setIsNewOdePagStructureSync($isNewOdePagStructureSync)
    {
        $this->isNewOdePagStructureSync = $isNewOdePagStructureSync;
    }

    /**
     * @return multitype:\App\Entity\net\exelearning\Dto\OdePagStructureDto
     */
    public function getOdePagStructureSyncs()
    {
        return $this->odePagStructureSyncs;
    }

    /**
     * @param multitype:\App\Entity\net\exelearning\Dto\OdePagStructureDto $odePagStructureSyncs
     */
    public function setOdePagStructureSyncs($odePagStructureSyncs)
    {
        $this->odePagStructureSyncs = $odePagStructureSyncs;
    }

    /**
     * @param OdePagStructureSyncDto $odePagStructureSync
     */
    public function addOdePagStructureSyncs($odePagStructureSync)
    {
        $this->odePagStructureSyncs[] = $odePagStructureSync;
    }

    /**
     * @return string
     */
    public function getOdeNavStructureSyncId()
    {
        return $this->odeNavStructureSyncId;
    }

    /**
     * @param string $odeNavStructureSyncId
     */
    public function setOdeNavStructureSyncId($odeNavStructureSyncId)
    {
        $this->odeNavStructureSyncId = $odeNavStructureSyncId;
    }

    public function getOdeNavStructureSync()
    {
        return $this->odeNavStructureSync;
    }

    public function setOdeNavStructureSync($odeNavStructureSync)
    {
        $this->odeNavStructureSync = $odeNavStructureSync;
    }

    /**
     * @return bool
     */
    public function isNewOdeNavStructureSync()
    {
        return $this->isNewOdeNavStructureSync;
    }

    /**
     * @param bool $isNewOdeNavStructureSync
     */
    public function setIsNewOdeNavStructureSync($isNewOdeNavStructureSync)
    {
        $this->isNewOdeNavStructureSync = $isNewOdeNavStructureSync;
    }
}
