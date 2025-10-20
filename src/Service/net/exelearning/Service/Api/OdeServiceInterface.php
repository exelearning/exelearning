<?php

namespace App\Service\net\exelearning\Service\Api;

use App\Entity\net\exelearning\Entity\User;

interface OdeServiceInterface
{
    /**
     * Moves elp file to perm and insert to ode_files.
     *
     * @param array $odeResultParameters
     * @param User  $user
     * @param bool  $isManualSave
     */
    public function moveElpFileToPerm(
        $odeResultParameters,
        $user,
        $isManualSave,
    );

    /**
     * Generate id for version, ode and session, then rename path with the new session.
     *
     * @param string $odeSessionId
     * @param User   $user
     *
     * @return boolean/array
     */
    public function renameSessionDir(
        $odeSessionId,
        $user,
    );

    /**
     * Saves OdeComponents in dist dir.
     *
     * @param string $odeSessionId
     * @param User   $user
     * @param string $odeIdeviceId
     * @param string $odeBlockId
     *
     * @return array
     */
    public function saveOdeComponent(
        $odeSessionId,
        $user,
        $odeIdeviceId,
        $odeBlockId,
    );

    /**
     * Saves the Ode in dist dir.
     *
     * @param string $odeSessionId
     * @param User   $user
     * @param bool   $isManualSave
     * @param object $odeProperties
     * @param bool   $isSaveAs
     * @param bool   $isDownload
     * @param object $userPreferencesDtos
     *
     * @return array
     */
    public function saveOde(
        $odeSessionId,
        $user,
        $isManualSave,
        $odeProperties,
        $userPreferencesDtos,
        $isSaveAs = false,
        $isDownload = false,
    );

    /**
     * Closes the ode session.
     *
     * @param string $odeSessionId
     * @param int    $autosavedSessionOdeFilesToMaintain
     * @param User   $user
     *
     * @return array
     */
    public function closeOdeSession(
        $odeSessionId,
        $autosavedSessionOdeFilesToMaintain,
        $user,
    );

    /**
     * Removes autosaves by the user.
     *
     * @param string $odeSessionId
     * @param int    $autosavedSessionOdeFilesToMaintain
     * @param User   $user
     *
     * @return array
     */
    public function cleanAutosavesByUser(
        $odeSessionId,
        $autosavedSessionOdeFilesToMaintain,
        $user,
    );

    /**
     * Set ode platform id to the elp file on perm.
     *
     * @param string $elpFileName
     * @param string $odePlatformId
     */
    public function setOdePlatformId(
        $elpFileName,
        $odePlatformId,
    );

    /**
     * Check necessary content on the xml.
     *
     * @param string $odeSessionId
     * @param string $elpFileName
     * @param User   $user
     * @param bool   $forceCloseOdeUserPreviousSession
     */
    public function checkContentXmlAndCurrentUser(
        $odeSessionId,
        $elpFileName,
        $user,
        $forceCloseOdeUserPreviousSession,
    );

    /**
     * Check necessary content on the local xml.
     *
     * @param string $elpFileName
     * @param string $elpFilePath
     * @param User   $user
     * @param bool   $forceCloseOdeUserPreviousSession
     * @param bool   $isImportIdevices
     *
     * @return array
     */
    public function checkLocalOdeFile(
        $elpFileName,
        $elpFilePath,
        $user,
        $forceCloseOdeUserPreviousSession,
        $isImportIdevices = false,
        $odeNavStructureSync = null,
    );

    /**
     * Check necessary content on the local xml.
     *
     * @param string $elpFileName
     * @param string $elpFilePath
     * @param User   $user
     * @param bool   $forceCloseOdeUserPreviousSession
     *
     * @return array
     */
    public function checkMultipleLocalOdeFile(
        $elpFileName,
        $elpFilePath,
        $user,
        $forceCloseOdeUserPreviousSession,
        $isImportIdevices = false,
        $odeNavStructureSync = null,
    );

    /**
     * Check necessary content on the local properties xml.
     *
     * @param string $elpFileName
     * @param string $elpFilePath
     * @param User   $user
     * @param bool   $forceCloseOdeUserPreviousSession
     *
     * @return array
     */
    public function checkLocalXmlProperties(
        $elpFileName,
        $elpFilePath,
        $user,
        $forceCloseOdeUserPreviousSession,
        $isImportIdevices = false,
        $odeNavStructureSync = null,
    );

    /**
     * Check if scorm content is editable.
     *
     * @param string $zipFileName
     * @param string $zipFilePath
     * @param User   $user
     *
     * @return array
     */
    public function checkEditableZipFile(
        $zipFileName,
        $zipFilePath,
        $user,
    );

    /**
     * Opens an elp from OdeFiles.
     *
     * @param string        $elpFileName
     * @param UserInterface $user
     * @param User          $dbUser
     * @param string        $clientIp
     * @param bool          $forceCloseOdeUserPreviousSession
     * @param array         $odeValues
     *
     * @return array
     */
    public function createElpStructureAndCurrentOdeUser(
        $elpFileName,
        $user,
        $dbUser,
        $clientIp,
        $forceCloseOdeUserPreviousSession,
        $odeValues,
    );

    /**
     * Apply structure of elp.
     *
     * @param UserInterface $user
     * @param array         $odeValues
     *
     * @return array
     */
    public function createElpStructure(
        $user,
        $odeValues,
        $isImportIdevices,
        $odeNavStructureSync = null,
        $isImportProperties = false,
    );

    /**
     * Removes elp from files and database.
     *
     * @param object $odeFileSync
     *
     * @return array
     */
    public function removeElpFromServer($odeFileSync);

    /**
     * Get last value of Version name on database.
     *
     * @param string $odeId
     *
     * @return string
     */
    public function getLastVersionNameOdeFiles($odeId);

    /**
     * Get ode config properties array.
     *
     * @param string $odeSessionId
     *
     * @return array
     */
    public function getConfigOdeProperties($odeSessionId);

    /**
     * Get ode properties array.
     *
     * @param string    $odeSessionId
     * @param User|bool $user
     *
     * @return array
     */
    public function getOdePropertiesFromDatabase(
        $odeSessionId,
        $user = false,
    );

    /**
     * Save cataloguing properties.
     *
     * @param EntityManagerInterface $entityManager
     * @param Request                $request
     * @param string                 $odeSessionId
     * @param array                  $databaseOdePropertiesData
     * @param array                  $odePropertiesConfigValues
     * @param string                 $odePropertiesConfigKey
     *
     * @return array
     */
    public function saveOdeProperty(
        &$entityManager,
        $request,
        $odeSessionId,
        $databaseOdePropertiesData,
        $odePropertiesConfigValues,
        $odePropertiesConfigKey,
    );
}
