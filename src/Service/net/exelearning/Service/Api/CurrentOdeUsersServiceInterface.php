<?php

namespace App\Service\net\exelearning\Service\Api;

use App\Entity\net\exelearning\Entity\OdeNavStructureSync;
use App\Entity\net\exelearning\Entity\User;

interface CurrentOdeUsersServiceInterface
{
    /**
     * Inserts CurrentOdeUsers from its data.
     *
     * @param string $odeId
     * @param string $odeVersionId
     * @param string $odeSessionId
     * @param User   $user
     * @param string $clientIp
     *
     * @return \App\Entity\net\exelearning\Entity\CurrentOdeUsers
     */
    public function createCurrentOdeUsers($odeId, $odeVersionId, $odeSessionId, $user, $clientIp);

    /**
     * Inserts or updates CurrentOdeUsers from OdeNavStructureSync data.
     *
     * @param OdeNavStructureSync $odeNavStructureSync
     * @param User                $user
     * @param string              $clientIp
     *
     * @return \App\Entity\net\exelearning\Entity\CurrentOdeUsers
     */
    public function insertOrUpdateFromOdeNavStructureSync($odeNavStructureSync, $user, $clientIp);

    /**
     * Inserts or updates CurrentOdeUsers from root node data.
     *
     * @param User   $user
     * @param string $clientIp
     *
     * @return \App\Entity\net\exelearning\Entity\CurrentOdeUsers
     */
    public function insertOrUpdateFromRootNode($user, $clientIp);

    /**
     * Updates current idevice CurrentOdeUser.
     *
     * @param OdeNavStructureSync $odeNavStructureSync
     * @param string              $blockId
     * @param string              $odeIdeviceId
     * @param User                $user
     * @param array               $odeCurrentUsersFlags
     *
     * @return \App\Entity\net\exelearning\Entity\CurrentOdeUsers|null
     */
    public function updateCurrentIdevice($odeNavStructureSync, $blockId, $odeIdeviceId, $user, $odeCurrentUsersFlags);

    /**
     * Checks if the user passed as param is the only one who is editing the content and updates CurrentOdeUser.
     *
     * @param User   $user
     * @param string $odeId
     * @param string $odeVersionId
     * @param string $odeSessionId
     * @param string $newOdeSessionId
     *
     * @return bool
     */
    public function updateLastUserOdesId($user, $odeId, $odeVersionId, $odeSessionId, $newOdeSessionId);

    /**
     * Update current user odeId, only for users who join (shared session).
     *
     * @param string $odeSessionId
     * @param User   $user
     */
    public function updateSyncCurrentUserOdeId($odeSessionId, $user);

    /**
     * Checks if the user passed as param is the only one who is editing the content.
     *
     * @param User   $user
     * @param string $odeId
     * @param string $odeVersionId
     * @param string $odeSessionId
     *
     * @return bool
     */
    public function isLastUser($user, $odeId, $odeVersionId, $odeSessionId);

    /**
     * Returns OdeId from CurrentOdeUsers for user and odeSessionId.
     *
     * @param User   $user
     * @param string $odeSessionId
     *
     * @return string
     */
    public function getOdeIdByOdeSessionId($user, $odeSessionId);

    /**
     * Returns OdeVersionId from CurrentOdeUsers for user and odeSessionId.
     *
     * @param User   $user
     * @param string $odeSessionId
     *
     * @return string
     */
    public function getOdeVersionIdByOdeSessionId($user, $odeSessionId);

    /**
     * Checks SyncSaveFlag state on CurrentOdeUsers.
     *
     * @return bool
     */
    public function checkSyncSaveFlag(string $odeId, string $odeSessionId);

    /**
     * Checks if another user in the session has the idevice open.
     *
     * @param string $odeSessionId
     * @param string $odeIdeviceId
     * @param string $odeBlockId
     * @param User   $user
     *
     * @return bool
     */
    public function checkIdeviceCurrentOdeUsers($odeSessionId, $odeIdeviceId, $odeBlockId, $user);

    /**
     * Check if any current user has the session id and set to the respective user.
     *
     * @param string $odeSessionId
     * @param User   $user
     *
     * @return bool
     */
    public function checkOdeSessionIdCurrentUsers($odeSessionId, $user);

    /**
     * Examines number of current users on page.
     *
     * @param string $odeSessionId
     * @param User   $user
     *
     * @return bool
     */
    public function checkCurrentUsersOnSamePage($odeSessionId, $user);

    /**
     * Removes the user syncSaveFlag activated value.
     *
     * @param User $user
     */
    public function removeActiveSyncSaveFlag($user);

    /**
     * Activate the user syncSaveFlag.
     *
     * @param User $user
     */
    public function activateSyncSaveFlag($user);

    /**
     * Removes the user syncSaveFlag activated value.
     *
     * @param User $user
     */
    public function removeActiveSyncComponentsFlag($user);
}
