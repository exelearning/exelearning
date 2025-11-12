<?php

namespace App\Util\net\exelearning\Util;

use App\Settings;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * SettingsUtil.
 *
 * Utility functions for working with Settings
 */
class SettingsUtil
{
    private static ?ContainerInterface $container = null;

    /**
     * Sets the container.
     */
    public static function setContainer(ContainerInterface $container): void
    {
        self::$container = $container;
    }

    /**
     * Retrieves a parameter from the container.
     */
    public static function getParameter(string $parameter)
    {
        if (null === self::$container) {
            throw new \LogicException('Container is not set. You need to call SettingsUtil::setContainer() before accessing parameters.');
        }

        return self::$container->getParameter($parameter);
    }

    /**
     * Checks if idevices installation allowed in online.
     */
    public static function idevicesInstallationAllowed(): bool
    {
        // return self::getParameter('app.online_idevices_install'); // To do (see #381)
        return 0;
    }

    /**
     * Converts USER_STORAGE_MAX_DISK_SPACE from MB to Bytes.
     */
    public static function getUserStorageMaxDiskSpaceInBytes(): int
    {
        $factor = 2;

        $maxDiskSpaceMB = self::getParameter('app.user_storage_max_disk_space');

        return (int) ($maxDiskSpaceMB * pow(1024, $factor));
    }

    /**
     * Converts FILE_UPLOAD_MAX_SIZE from MB to Bytes.
     */
    public static function getFileMaxUploadSizeInBytes(): int
    {
        $factor = 2;

        $maxUploadSizeMB = self::getParameter('app.file_upload_max_size');

        return (int) ($maxUploadSizeMB * pow(1024, $factor));
    }

    /**
     * Get platform json structures.
     */
    public static function getPlatformJsonStructure()
    {
        $platform = self::setPlatform();
        if (!empty($platform)) {
            switch ($platform['api']) {
                case 1:
                case 2:
                case 3:
                    $jsonStructure = ['ode_id' => '', 'ode_filename' => '', 'ode_file' => '', 'ode_uri' => '', 'ode_user' => '', 'jwt_token' => ''];

                    return $jsonStructure;
                default:
                    return false;
            }
        }
    }

    /**
     * Get platform selected on settings.
     */
    public static function setPlatform()
    {
        return Settings::PLATFORMS[Settings::PLATFORM_INTEGRATION];
    }
}
