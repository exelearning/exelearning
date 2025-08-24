<?php

namespace App\Helper\net\exelearning\Helper;

use App\Constants;
use App\Entity\net\exelearning\Entity\User;
use App\Util\net\exelearning\Util\FilePermissionsUtil;
use App\Util\net\exelearning\Util\FileUtil;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * FileHelper.
 *
 * Utility functions for working with files and directories
 */
class FileHelper
{
    private $container;
    private $logger;

    public function __construct(ContainerInterface $container, LoggerInterface $logger)
    {
        $this->container = $container;
        $this->logger = $logger;
    }

    /**
     * Returns path to files dir defined in config param.
     *
     * @return string
     */
    public function getFilesDir()
    {
        $filesDir = $this->container->getParameter('filesdir');

        // Add final slash if parameter doesn't have it
        if (DIRECTORY_SEPARATOR !== substr($filesDir, -1)) {
            $filesDir .= DIRECTORY_SEPARATOR;
        }

        // $this->logger->debug('filesDir', ['filesDir' => $filesDir, 'file:' => $this, 'line' => __LINE__]);

        return $filesDir;
    }

    /**
     * Returns path to public libs dir in symfony.
     *
     * @return string
     */
    public function getSymfonyPublicDir()
    {
        return $this->container->getParameter('kernel.project_dir').DIRECTORY_SEPARATOR.
            Constants::PUBLIC_DIR_NAME.DIRECTORY_SEPARATOR;
    }

    /**
     * Returns path to app dir in symfony.
     *
     * @return string
     */
    public function getSymfonyPublicAppDir()
    {
        return $this->getSymfonyPublicDir().Constants::JS_APP_NAME.DIRECTORY_SEPARATOR;
    }

    /**
     * Returns path to libs dir in symfony.
     *
     * @return string
     */
    public function getSymfonyPublicLibsDir()
    {
        return $this->getSymfonyPublicDir().Constants::LIBS_DIR.DIRECTORY_SEPARATOR;
    }

    /**
     * Returns path to common dir in symfony.
     *
     * @return string
     */
    public function getSymfonyPublicCommonDir()
    {
        return $this->getSymfonyPublicAppDir().Constants::COMMON_NAME.DIRECTORY_SEPARATOR;
    }

    /**
     * Returns path to files dir in symfony.
     *
     * @return string
     */
    public function getSymfonyFilesDir()
    {
        return $this->getSymfonyPublicDir().Constants::FILES_DIR_NAME.DIRECTORY_SEPARATOR;
    }

    /**
     * Returns absolute path to translations dir.
     *
     * @return string
     */
    public function getTranslationsDir()
    {
        return $this->container->getParameter('kernel.project_dir').DIRECTORY_SEPARATOR.
            Constants::TRANSLATIONS_DIR_NAME;
    }

    /**
     * Returns client translations file path and name.
     *
     * @return string
     */
    public function getClientTranslationFilePathName($locale, $format, $addLocaleSubdir)
    {
        if ($addLocaleSubdir) {
            return $this->getTranslationsDir().DIRECTORY_SEPARATOR.$locale.DIRECTORY_SEPARATOR.
                Constants::TRANSLATION_FILENAME.'.'.$locale.'.'.$format;
        } else {
            return $this->getTranslationsDir().DIRECTORY_SEPARATOR.Constants::TRANSLATION_FILENAME.
                '.'.$locale.'.'.$format;
        }
    }

    /**
     * Returns client translations temporary file path and name.
     *
     * @return string
     */
    public function getClientTempTranslationFilePathName($locale, $format, $addLocaleSubdir)
    {
        return $this->getClientTranslationFilePathName($locale, $format, $addLocaleSubdir).'.'.
            Constants::TRANSLATION_FILENAME_TMP_SUFFIX;
    }

    /**
     * Returns absolute path to idevices dir.
     *
     * @return string
     */
    public function getIdevicesDir()
    {
        return $this->getFilesDir().Constants::PERMANENT_CONTENT_STORAGE_DIRECTORY.DIRECTORY_SEPARATOR.
            Constants::IDEVICES_DIR_NAME.DIRECTORY_SEPARATOR;
    }

    /**
     * Returns absolute path to base idevices dir.
     *
     * @return string
     */
    public function getIdevicesBaseDir()
    {
        return $this->getIdevicesDir().Constants::IDEVICES_BASE_DIR_NAME.DIRECTORY_SEPARATOR;
    }

    /**
     * Returns absolute path to users idevices dir.
     *
     * @return string
     */
    public function getIdevicesUsersDir()
    {
        return $this->getIdevicesDir().Constants::IDEVICES_USERS_DIR_NAME.DIRECTORY_SEPARATOR;
    }

    /**
     * Returns absolute path to themes dir.
     *
     * @return string
     */
    public function getThemesDir()
    {
        return $this->getFilesDir().Constants::PERMANENT_CONTENT_STORAGE_DIRECTORY.DIRECTORY_SEPARATOR.
            Constants::THEMES_DIR_NAME.DIRECTORY_SEPARATOR;
    }

    /**
     * Returns absolute path to base themes dir.
     *
     * @return string
     */
    public function getThemesBaseDir()
    {
        return $this->getThemesDir().Constants::THEMES_BASE_DIR_NAME.DIRECTORY_SEPARATOR;
    }

    /**
     * Returns absolute path to users themes dir.
     *
     * @return string
     */
    public function getThemesUsersDir()
    {
        return $this->getThemesDir().Constants::THEMES_USERS_DIR_NAME.DIRECTORY_SEPARATOR;
    }

    /**
     * Returns absolute path to style workarea dir.
     *
     * @return string
     */
    public function getStyleWorkareaDir()
    {
        return $this->container->getParameter('kernel.project_dir').DIRECTORY_SEPARATOR.
            Constants::PUBLIC_DIR_NAME.DIRECTORY_SEPARATOR.Constants::STYLE_DIR_NAME.DIRECTORY_SEPARATOR.
            Constants::WORKAREA_DIR_NAME.DIRECTORY_SEPARATOR;
    }

    /**
     * Returns absolute path to TEMPORARY_CONTENT_STORAGE_DIRECTORY dir.
     *
     * @return string
     */
    public function getTemporaryContentStorageDir()
    {
        return $this->getFilesDir().Constants::TEMPORARY_CONTENT_STORAGE_DIRECTORY.DIRECTORY_SEPARATOR;
    }

    /**
     * Returns absolute path to PERMANENT_CONTENT_STORAGE_DIRECTORY dir.
     *
     * @return string
     */
    public function getPermanentContentStorageDir()
    {
        return $this->getFilesDir().Constants::PERMANENT_CONTENT_STORAGE_DIRECTORY.DIRECTORY_SEPARATOR;
    }

    /**
     * Returns absolute path to PERMANENT_CONTENT_STORAGE_ODES dir.
     *
     * @return string
     */
    public function getPermanentContentStorageOdesDir()
    {
        return $this->getPermanentContentStorageDir().Constants::PERMANENT_CONTENT_STORAGE_ODES_DIRECTORY.DIRECTORY_SEPARATOR;
    }

    /**
     * Returns absolute path to an ode Session dir.
     *
     * @param string $odeSessionId
     *
     * @return bool|string
     */
    public function getOdeSessionDir($odeSessionId)
    {
        // validade $odeSessionId
        if (strlen($odeSessionId) < 8) {
            return false;
        }

        $dateDirStructure = FileUtil::getDateDirStructureFromIdentifier($odeSessionId);

        $odeSessionDirPath = $this->getTemporaryContentStorageDir().$dateDirStructure.$odeSessionId;

        // if dir already exists
        if (file_exists($odeSessionDirPath)) {
            return $odeSessionDirPath;
        } else { // create dir
            $odeSessionDirCreated = false;
            if (FilePermissionsUtil::isWritable($this->getTemporaryContentStorageDir())) {
                $mode = 0775;
                $recursive = true;
                $odeSessionDirCreated = FileUtil::createDir($odeSessionDirPath, $mode, $recursive);
            }

            if ($odeSessionDirCreated) {
                return $odeSessionDirPath;
            } else {
                return false;
            }
        }
    }

    /**
     * Returns absolute path to an OdeComponentsSync Dir. If dir doesn't exists it tries to create it.
     *
     * @param string $odeSessionId
     * @param string $odeIdeviceId
     *
     * @return string|bool
     */
    public function getOdeComponentsSyncDir($odeSessionId, $odeIdeviceId)
    {
        // validade $odeSessionId
        if (strlen($odeSessionId) < 8) {
            return false;
        }

        $odeSessionTemporaryContentStorageDirPath = $this->getOdeSessionDir($odeSessionId);

        $iDeviceDir = $odeSessionTemporaryContentStorageDirPath.DIRECTORY_SEPARATOR.$odeIdeviceId.
            DIRECTORY_SEPARATOR;

        // if dir already exists
        if (file_exists($iDeviceDir)) {
            return $iDeviceDir;
        } else { // create dir
            $iDeviceDirCreated = false;
            if (FilePermissionsUtil::isWritable($odeSessionTemporaryContentStorageDirPath)) {
                $mode = 0775;
                $recursive = true;
                $iDeviceDirCreated = FileUtil::createDir($iDeviceDir, $mode, $recursive);
            }

            if ($iDeviceDirCreated) {
                return $iDeviceDir;
            } else {
                return false;
            }
        }
    }

    /**
     * Returns absolute path to a FilemanagerDir. If dir doesn't exists it tries to create it.
     *
     * @param string $odeSessionId
     *
     * @return string|bool
     */
    public function getOdeFilemanagerDir($odeSessionId)
    {
        // validade $odeSessionId
        if (strlen($odeSessionId) < 8) {
            return false;
        }

        $odeSessionTemporaryContentStorageDirPath = $this->getOdeSessionDir($odeSessionId);

        $filemanagerDir = $odeSessionTemporaryContentStorageDirPath.DIRECTORY_SEPARATOR.
            Constants::FILEMANAGER_DIRECTORY;

        // if dir already exists
        if (file_exists($filemanagerDir)) {
            return $filemanagerDir;
        } else { // create dir
            $filemanagerDirCreated = false;
            if (FilePermissionsUtil::isWritable($odeSessionTemporaryContentStorageDirPath)) {
                $mode = 0775;
                $recursive = true;
                $filemanagerDirCreated = FileUtil::createDir($filemanagerDir, $mode, $recursive);
            }

            if ($filemanagerDirCreated) {
                return $filemanagerDir;
            } else {
                return false;
            }
        }
    }

    /**
     * Returns absolute path to a Dist Dir. If dir doesn't exists it tries to create it.
     *
     * @param string $odeSessionId
     *
     * @return string|bool
     */
    public function getOdeSessionDistDir($odeSessionId)
    {
        // validade $odeSessionId
        if (strlen($odeSessionId) < 8) {
            return false;
        }

        $odeSessionTemporaryContentStorageDirPath = $this->getOdeSessionDir($odeSessionId);

        $distDir = $odeSessionTemporaryContentStorageDirPath.DIRECTORY_SEPARATOR.
            Constants::DIST_DIR.DIRECTORY_SEPARATOR;

        // if dir already exists
        if (file_exists($distDir)) {
            return $distDir;
        } else { // create dir
            $distDirCreated = false;
            if (FilePermissionsUtil::isWritable($odeSessionTemporaryContentStorageDirPath)) {
                $mode = 0775;
                $recursive = true;
                $distDirCreated = FileUtil::createDir($distDir, $mode, $recursive);
            }

            if ($distDirCreated) {
                return $distDir;
            } else {
                return false;
            }
        }
    }

    /**
     * Returns absolute path to an user Dist Dir. If dir doesn't exists it tries to create it.
     *
     * @param string $odeSessionId
     * @param User   $user
     *
     * @return bool|string
     */
    public function getOdeSessionDistDirForUser($odeSessionId, $user)
    {
        // validade $odeSessionId
        if (strlen($odeSessionId) < 8) {
            return false;
        }

        $odeSessionDistDirPath = $this->getOdeSessionDistDir($odeSessionId);

        $distDirForUser = $odeSessionDistDirPath.$user->getUserId().DIRECTORY_SEPARATOR;

        // if dir already exists
        if (file_exists($distDirForUser)) {
            return $distDirForUser;
        } else { // create dir
            $distDirForUserCreated = false;
            if (FilePermissionsUtil::isWritable($odeSessionDistDirPath)) {
                $mode = 0775;
                $recursive = true;
                $distDirForUserCreated = FileUtil::createDir($distDirForUser, $mode, $recursive);
            }

            if ($distDirForUserCreated) {
                return $distDirForUser;
            } else {
                return false;
            }
        }
    }

    /**
     * Returns absolute path to odeSessionTmp. If dir doesn't exists it tries to create it.
     *
     * @param string $odeSessionId
     *
     * @return string|bool
     */
    public function getOdeSessionTmpDir($odeSessionId)
    {
        // validade $odeSessionId
        if (strlen($odeSessionId) < 8) {
            return false;
        }

        $odeSessionTemporaryContentStorageDirPath = $this->getOdeSessionDir($odeSessionId);

        $odeSessionTmpDir = $odeSessionTemporaryContentStorageDirPath.DIRECTORY_SEPARATOR.
            Constants::ODE_SESSION_TMP_DIR.DIRECTORY_SEPARATOR;

        // if dir already exists
        if (file_exists($odeSessionTmpDir)) {
            return $odeSessionTmpDir;
        } else { // create dir
            $odeSessionTmpDirCreated = false;
            if (FilePermissionsUtil::isWritable($odeSessionTemporaryContentStorageDirPath)) {
                $mode = 0775;
                $recursive = true;
                $odeSessionTmpDirCreated = FileUtil::createDir($odeSessionTmpDir, $mode, $recursive);
            }

            if ($odeSessionTmpDirCreated) {
                return $odeSessionTmpDir;
            } else {
                return false;
            }
        }
    }

    /**
     * Returns absolute path to odeSessionUserTmp. If dir doesn't exists it tries to create it.
     *
     * @param string $odeSessionId
     *
     * @return string|bool
     */
    public function getOdeSessionUserTmpDir($odeSessionId, $user)
    {
        // validade $odeSessionId
        if (strlen($odeSessionId) < 8) {
            return false;
        }

        $odeSessionTmpDir = $this->getOdeSessionTmpDir($odeSessionId);

        $odeSessionTmpUserDir = $odeSessionTmpDir.$user->getUserId().DIRECTORY_SEPARATOR;

        // if dir already exists
        if (file_exists($odeSessionTmpUserDir)) {
            return $odeSessionTmpUserDir;
        } else { // create dir
            $odeSessionTmpUserDirCreated = false;
            if (FilePermissionsUtil::isWritable($odeSessionTmpDir)) {
                $mode = 0775;
                $recursive = true;
                $odeSessionTmpUserDirCreated = FileUtil::createDir($odeSessionTmpUserDir, $mode, $recursive);
            }

            if ($odeSessionTmpUserDirCreated) {
                return $odeSessionTmpUserDir;
            } else {
                return false;
            }
        }
    }

    /**
     * Returns absolute path to odeSessionUserTmpExport. If dir doesn't exists it tries to create it.
     *
     * @param string $odeSessionId
     * @param User   $user
     *
     * @return string|bool
     */
    public function getOdeSessionUserTmpExportDir($odeSessionId, $user)
    {
        // validade $odeSessionId
        if (strlen($odeSessionId) < 8) {
            return false;
        }

        $odeSessionUserTmpDir = $this->getOdeSessionUserTmpDir($odeSessionId, $user);

        $odeSessionUserTmpExportDir = $odeSessionUserTmpDir.Constants::EXPORT_TMP_DIR.DIRECTORY_SEPARATOR;

        // if dir already exists
        if (file_exists($odeSessionUserTmpExportDir)) {
            return $odeSessionUserTmpExportDir;
        } else { // create dir
            $odeSessionTmpUserDirCreated = false;
            if (FilePermissionsUtil::isWritable($odeSessionUserTmpDir)) {
                $mode = 0775;
                $recursive = true;
                $odeSessionTmpUserDirCreated = FileUtil::createDir($odeSessionUserTmpExportDir, $mode, $recursive);
            }

            if ($odeSessionTmpUserDirCreated) {
                return $odeSessionUserTmpExportDir;
            } else {
                return false;
            }
        }
    }

    /**
     * Delete directory with files.
     *
     * @param string $dirPath
     *
     * @return bool
     */
    public function deleteDir($dirPath)
    {
        if (!is_dir($dirPath)) {
            return false;
        }
        if ('/' != substr($dirPath, strlen($dirPath) - 1, 1)) {
            $dirPath .= '/';
        }
        $files = glob($dirPath.'*', GLOB_MARK);
        foreach ($files as $file) {
            if (is_dir($file)) {
                self::deleteDir($file);
            } else {
                unlink($file);
            }
        }
        rmdir($dirPath);

        return true;
    }

    /**
     * Adds a numeric suffix to the filename if it already exists in the directory.
     */
    public function addFilenameSuffix(string $filename, string $path): string
    {
        $fileInfo = pathinfo($filename);
        $name = $fileInfo['filename'];
        $extension = isset($fileInfo['extension']) ? '.'.$fileInfo['extension'] : '';
        $newFilename = $name.$extension;
        $counter = 1;

        while (file_exists($path.DIRECTORY_SEPARATOR.$newFilename)) {
            $newFilename = $name.'_'.$counter.$extension;
            ++$counter;
        }

        return $newFilename;
    }
}
