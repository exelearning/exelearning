<?php

namespace App\Service\net\exelearning\Service\Api;

use App\Entity\net\exelearning\Entity\User;

interface PlatformIntegrationServiceInterface
{
    /**
     * Petition to upload elp to the platform.
     *
     * @param User   $user
     * @param array  $odeResultParameters
     * @param string $filePathName
     * @param string $jwtToken
     *
     * @return array content
     */
    public function platformPetitionSet($user, $odeResultParameters, $platformIntegrationUrlSet, $filePathName, $jwtToken);

    /**
     * Send petition to get the elp from platform.
     *
     * @param User   $user
     * @param string $odePlatformId
     * @param string $platformIntegrationUrlGet
     * @param string $jwtToken
     *
     * @return array $content
     */
    public function platformPetitionGet($user, $odePlatformId, $platformIntegrationUrlGet, $jwtToken);
}
