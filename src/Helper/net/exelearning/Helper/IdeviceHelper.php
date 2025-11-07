<?php

namespace App\Helper\net\exelearning\Helper;

use App\Constants;
use App\Entity\net\exelearning\Dto\IdeviceDto;
use App\Entity\net\exelearning\Entity\User;
use App\Util\net\exelearning\Util\FilePermissionsUtil;
use App\Util\net\exelearning\Util\FileUtil;
use App\Util\net\exelearning\Util\XmlUtil;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * IdeviceHelper.
 *
 * Utility functions for working with iDevices
 */
class IdeviceHelper
{
    private FileHelper $fileHelper;
    private TranslatorInterface $translator;
    private EntityManagerInterface $entityManager;

    private string $tmpIdeviceFileName = 'tmp';

    public function __construct(
        FileHelper $fileHelper,
        TranslatorInterface $translator,
        EntityManagerInterface $entityManager,
    ) {
        $this->fileHelper = $fileHelper;
        $this->translator = $translator;
        $this->entityManager = $entityManager;
    }

    /**
     * Returns absolute path to an idevice dir.
     *
     * @param string        $ideviceDir
     * @param string        $type
     * @param UserInterface $user
     *
     * @return string|bool
     */
    public function getIdeviceDir($ideviceDir, $type = Constants::IDEVICE_TYPE_BASE, $user = null)
    {
        switch ($type) {
            case Constants::IDEVICE_TYPE_BASE:
                $path = $this->fileHelper->getIdevicesBaseDir().$ideviceDir.DIRECTORY_SEPARATOR;
                break;
            case Constants::IDEVICE_TYPE_USER:
                $dbUser = $this->getDatabaseUser($user);
                $path = $this->fileHelper->getIdevicesUsersDir().$dbUser->getUserId().
                    DIRECTORY_SEPARATOR.$ideviceDir.DIRECTORY_SEPARATOR;
                break;
            default:
                $path = false;
        }

        return $path;
    }

    /**
     * Returns iDevice config file path and name.
     *
     * @param string        $ideviceDir
     * @param string        $type
     * @param UserInterface $user
     *
     * @return string
     */
    public function getIdeviceConfigFilePathName($ideviceDir, $type = Constants::IDEVICE_TYPE_BASE, $user = null)
    {
        return $this->getIdeviceDir($ideviceDir, $type, $user).Constants::IDEVICE_CONFIG_FILENAME;
    }

    /**
     * Returns iDevice edition dir path and name.
     *
     * @param string        $ideviceDir
     * @param string        $type
     * @param UserInterface $user
     *
     * @return string
     */
    public function getIdeviceEditionDirPath($ideviceDir, $type = Constants::IDEVICE_TYPE_BASE, $user = null)
    {
        return $this->getIdeviceDir($ideviceDir, $type, $user).Constants::IDEVICE_EDITION_DIR_NAME;
    }

    /**
     * Returns iDevice export dir path and name.
     *
     * @param string        $ideviceDir
     * @param string        $type
     * @param UserInterface $user
     *
     * @return string
     */
    public function getIdeviceExportDirPath($ideviceDir, $type = Constants::IDEVICE_TYPE_BASE, $user = null)
    {
        return $this->getIdeviceDir($ideviceDir, $type, $user).Constants::IDEVICE_EXPORT_DIR_NAME;
    }

    /**
     * Get idevice url.
     *
     * @param string $ideviceDir
     * @param string $type
     * @param bool   $user
     *
     * @return string
     */
    public function getIdeviceUrl($ideviceDir, $type = Constants::IDEVICE_TYPE_BASE, $user = null)
    {
        $baseUrl = $this->getIdeviceBaseUrl();
        switch ($type) {
            case Constants::IDEVICE_TYPE_BASE:
                $baseUrl .= Constants::IDEVICES_BASE_DIR_NAME.Constants::SLASH.$ideviceDir;
                break;
            case Constants::IDEVICE_TYPE_USER:
                $dbUser = $this->getDatabaseUser($user);
                $baseUrl .= Constants::IDEVICES_USERS_DIR_NAME.Constants::SLASH.$dbUser->getUserId().
                    Constants::SLASH.$ideviceDir;
                break;
        }

        return $baseUrl;
    }

    /**
     * Get idevices base url.
     *
     * @return string
     */
    public function getIdeviceBaseUrl()
    {
        return Constants::SLASH.Constants::FILES_DIR_NAME.Constants::SLASH.
            Constants::PERMANENT_CONTENT_STORAGE_DIRECTORY.Constants::SLASH.
            Constants::IDEVICES_DIR_NAME.Constants::SLASH;
    }

    /**
     * Returns IdeviceDto from $ideviceDir.
     *
     * @param string $ideviceDir
     *
     * @return IdeviceDto
     */
    public function getIdeviceFromIdeviceDir($ideviceDir, $type = Constants::IDEVICE_TYPE_BASE, $user = null)
    {
        $iDeviceConfigFilePathName = $this->getIdeviceConfigFilePathName($ideviceDir, $type, $user);

        if (file_exists($iDeviceConfigFilePathName)) {
            $iDeviceConfigFileContent = FileUtil::getFileContent($iDeviceConfigFilePathName);
            $iDeviceConfigArray = XmlUtil::loadXmlStringToArray($iDeviceConfigFileContent);
        } else {
            return false;
        }

        $iDeviceConfigArray['dirName'] = $ideviceDir;

        $iDevice = new IdeviceDto();
        // Load iDevice data from its config array
        $iDevice->loadFromConfigArray($iDeviceConfigArray, $this, $type, $user);
        $iDevice->setType($type);
        $iDevice->setUrl($this->getIdeviceUrl($iDevice->getDirName(), $type, $user));

        // if iDevice doesn't have a name set dir as name
        if (empty($iDevice->getName())) {
            $iDevice->setName($ideviceDir);
        }

        return $iDevice;
    }

    /**
     * Get idevices installed.
     *
     * @param UserInterface $user
     *
     * @return IdeviceDto[]
     */
    public function getInstalledIdevices($user)
    {
        $installedBaseIdevicesList = $this->getInstalledBaseIdevices();
        $installedUserIdevicesList = $this->getInstalledUserIdevices($user);

        $installedIdevices = array_merge($installedBaseIdevicesList, $installedUserIdevicesList);

        return $installedIdevices;
    }

    /**
     * Get list of base installed idevices.
     *
     * @return array
     */
    public function getInstalledBaseIdevices()
    {
        $installedIdeviceList = [];
        // Idevice dirs
        $idevicesDir = $this->fileHelper->getIdevicesBaseDir();
        // each of subdirs is an iDevice
        $iDevices = FileUtil::listSubdirs($idevicesDir);

        foreach ($iDevices as $iDeviceDir) {
            $iDevice = $this->getIdeviceFromIdeviceDir($iDeviceDir, Constants::IDEVICE_TYPE_BASE);
            // Add idevice if is valid
            if ($iDevice && method_exists($iDevice, 'isValid') && $iDevice->isValid()) {
                $installedIdeviceList[$iDevice->getName()] = $iDevice;
            }
        }

        return $installedIdeviceList;
    }

    /**
     * Get list of user installed idevices.
     *
     * @param UserInterface $user
     *
     * @return array
     */
    public function getInstalledUserIdevices($user)
    {
        $installedIdeviceList = [];
        // Idevice dirs
        $dbUser = $this->getDatabaseUser($user);
        $idevicesDir = $this->fileHelper->getIdevicesUsersDir().$dbUser->getUserId().DIRECTORY_SEPARATOR;
        // each of subdirs is an iDevice
        $iDevices = FileUtil::listSubdirs($idevicesDir);

        foreach ($iDevices as $iDeviceDir) {
            $iDevice = $this->getIdeviceFromIdeviceDir($iDeviceDir, Constants::IDEVICE_TYPE_USER, $user);
            // Add idevice if is valid
            if ($iDevice && method_exists($iDevice, 'isValid') && $iDevice->isValid()) {
                $installedIdeviceList[$iDevice->getName()] = $iDevice;
            }
        }

        return $installedIdeviceList;
    }

    /**
     * Returns iDevice translations file path and name.
     *
     * @param string $locale
     * @param string $iDeviceDir
     * @param string $iDeviceName
     *
     * @return string
     */
    public function getIdeviceTranslationFilePathName($locale, $iDeviceDir, $iDeviceName)
    {
        $idevicesDir = $this->getIdeviceDir($iDeviceDir);

        return $idevicesDir.Constants::IDEVICE_LANG_DIR_NAME.DIRECTORY_SEPARATOR.
            $iDeviceName.'.'.$locale.'.'.Constants::TRANSLATION_DEFAULT_FORMAT;
    }

    /**
     * Returns an array of IdeviceDto from all iDevices.
     *
     * @param UserInterface $user
     *
     * @return IdeviceDto[]
     */
    public function getIdevicesConfig($user)
    {
        $result = [];

        // Base idevices list
        $idevicesBaseDir = $this->fileHelper->getIdevicesBaseDir();
        $idevicesBaseDirList = FileUtil::listSubdirs($idevicesBaseDir);

        // User idevices list
        if ($user) {
            $dbUser = $this->getDatabaseUser($user);
            $idevicesUserDir = $this->fileHelper->getIdevicesUsersDir().$dbUser->getUserId().DIRECTORY_SEPARATOR;
            $idevicesUserDirList = FileUtil::listSubdirs($idevicesUserDir);
        } else {
            $idevicesUserDirList = [];
        }

        $idevicesDir = array_merge($idevicesBaseDirList, $idevicesUserDirList);

        foreach ($idevicesDir as $iDeviceDir) {
            $type = Constants::IDEVICE_TYPE_BASE;
            if (in_array($iDeviceDir, $idevicesUserDirList)) {
                $type = Constants::IDEVICE_TYPE_USER;
            }

            $iDeviceConfigFilePathName = $this->getIdeviceConfigFilePathName($iDeviceDir, $type, $user);

            // Skip if config file doesn't exist
            if (!file_exists($iDeviceConfigFilePathName)) {
                continue;
            }

            $iDeviceConfigFileContent = FileUtil::getFileContent($iDeviceConfigFilePathName);
            $iDeviceConfigArray = XmlUtil::loadXmlStringToArray($iDeviceConfigFileContent);

            // if iDevice doesn't have a name set dir as name
            if (isset($iDeviceConfigArray['name'])) {
                $iDeviceName = $iDeviceConfigArray['name'];
            } else {
                $iDeviceName = basename($iDeviceDir);
                $iDeviceConfigArray['name'] = $iDeviceName;
            }

            $iDeviceConfigArray['dirName'] = $iDeviceDir;

            $iDevice = new IdeviceDto();
            // Load iDevice data from its config array
            $iDevice->loadFromConfigArray($iDeviceConfigArray, $this, $type, $user);
            $result[$iDeviceName] = $iDevice;
        }

        return $result;
    }

    /**
     * Returns a IdeviceDto.
     *
     * @param UserInterface $user
     *
     * @return IdeviceDto
     */
    public function getIdeviceConfig($iDeviceDir, $type, $user = Constants::IDEVICE_TYPE_BASE)
    {
        $iDeviceConfigFilePathName = $this->getIdeviceConfigFilePathName($iDeviceDir, $type, $user);
        $iDeviceConfigFileContent = FileUtil::getFileContent($iDeviceConfigFilePathName);
        $iDeviceConfigArray = XmlUtil::loadXmlStringToArray($iDeviceConfigFileContent);

        // if iDevice doesn't have a name set dir as name
        if (isset($iDeviceConfigArray['name'])) {
            $iDeviceName = $iDeviceConfigArray['name'];
        } else {
            $iDeviceName = basename($iDeviceDir);
            $iDeviceConfigArray['name'] = $iDeviceName;
        }

        $iDeviceConfigArray['dirName'] = $iDeviceDir;

        $iDevice = new IdeviceDto();
        // Load iDevice data from its config array
        $iDevice->loadFromConfigArray($iDeviceConfigArray, $this, $type, $user);

        return $iDevice;
    }

    /**
     * Upload and install idevice zip.
     *
     * @param string        $filename
     * @param string        $base64String
     * @param UserInterface $user
     *
     * @return array
     */
    public function uploadIdeviceZip($filename, $base64String, $user)
    {
        $response = [];
        $response['error'] = false;

        // Modify zip filename
        $cleanFilename = str_replace(' ', '_', $filename); // replaces all spaces with underscores
        $cleanFilename = preg_replace("/[^A-Za-z0-9\-\.]/", '', $cleanFilename); // removes special chars

        // Generate new filename in user dir
        $dbUser = $this->getDatabaseUser($user);
        $idevicesDir = $this->fileHelper->getIdevicesUsersDir().$dbUser->getUserId();
        $outputFileZip = $idevicesDir.DIRECTORY_SEPARATOR.$cleanFilename;

        // Check if have write permission and create zip file in server
        $openIdeviceZipResponse = $this->fopenIdeviceZip($idevicesDir, $outputFileZip);
        $ifp = isset($openIdeviceZipResponse['ifp']) ? $openIdeviceZipResponse['ifp'] : false;

        if (!$ifp) {
            $response['error'] = $this->translator->trans('Unable to extract zip file');
        }
        if (isset($openIdeviceZipResponse['error'])) {
            $response['error'] = $openIdeviceZipResponse['error'];
        }

        // Idevice dir
        $tmpIdeviceDirPath = $idevicesDir.DIRECTORY_SEPARATOR.$this->tmpIdeviceFileName;

        // Write zip in idevices dir
        if ($ifp) {
            // Create zip in server
            $this->writeIdeviceZip($ifp, $base64String);
            // Extract zip in server
            $unzipIdeviceResponse = $this->unzipIdevice($outputFileZip, $tmpIdeviceDirPath, $idevicesDir, $user);

            if (isset($unzipIdeviceResponse['error'])) {
                $response['error'] = $unzipIdeviceResponse['error'];
                $ideviceDirName = false;
            } else {
                $ideviceDirName = $unzipIdeviceResponse['ideviceDirName'];
            }
        }

        // Get new IdeviceDto
        if ($ideviceDirName) {
            $idevice = $this->getIdeviceFromIdeviceDir($ideviceDirName, Constants::IDEVICE_TYPE_USER, $user);
        } else {
            $idevice = false;
        }

        // Check idevice
        if ($idevice) {
            if ($idevice->isValid()) {
                $response['idevice'] = $idevice;
            } else {
                $response['error'] = $this->translator->trans('The iDevice is not valid');
            }
        }

        // Returns array with IdeviceDto
        return $response;
    }

    /**
     * Return database user data.
     *
     * @param UserInterface $userLogged
     * @param array filters
     *
     * @return User
     */
    public function getDatabaseUser($userLogged, $filters = [])
    {
        $userRepo = $this->entityManager->getRepository(User::class);

        // Add email filter
        $loggedUserName = $userLogged->getUserIdentifier() ? $userLogged->getUserIdentifier() : '';
        $userFilters = ['email' => $loggedUserName];

        // Add other filters
        foreach ($filters as $filter => $value) {
            $userFilters[$filter] = $value;
        }

        $user = $userRepo->findOneBy($userFilters);

        return $user;
    }

    /**
     * Create empty zip file in server.
     *
     * @param string $idevicesDir
     * @param string $outputFileZip
     *
     * @return array
     */
    public function fopenIdeviceZip($idevicesDir, $outputFileZip)
    {
        $response = [];

        // Check if have write permission
        $ifp = false;
        if (FilePermissionsUtil::isWritable($idevicesDir)) {
            try {
                $ifp = fopen($outputFileZip, 'wb');
                $response['ifp'] = $ifp;
            } catch (\Exception $e) {
                $response['error'] = $e->getMessage();
            }
        } else {
            $response['error'] = $this->translator->trans(
                'Write permissions error in %s',
                ['%s' => $idevicesDir]
            );
        }

        return $response;
    }

    /**
     * @param resource $ifp
     * @param string   $base64String
     *
     * @return void
     */
    public function writeIdeviceZip($ifp, $base64String)
    {
        // Write data in open zip file
        $data = explode(';base64,', $base64String);
        fwrite($ifp, base64_decode($data[1]));
        fclose($ifp);
    }

    /**
     * Unzip idevice in the corresponding directory.
     *
     * @param string        $outputFileZip
     * @param string        $tmpIdeviceDirPath
     * @param string        $idevicesDir
     * @param UserInterface $user
     *
     * @return array
     */
    public function unzipIdevice($outputFileZip, $tmpIdeviceDirPath, $idevicesDir, $user)
    {
        $response = [];

        // Load actual idevices
        $preInstallationIdevicesBase = $this->getInstalledBaseIdevices();
        $preInstallationIdevicesUser = $this->getInstalledUserIdevices($user);

        // Unzip idevice into tmp dir
        FileUtil::extractZipTo($outputFileZip, $tmpIdeviceDirPath);

        // Load idevice
        $idevice = $this->getIdeviceFromIdeviceDir($this->tmpIdeviceFileName, Constants::IDEVICE_TYPE_USER, $user);

        if (!$idevice) {
            $response['error'] = $this->translator->trans('Could not load iDevice');
        } else {
            // Idevice dir
            $response['ideviceDirName'] = $idevice->getName();
            // Check if name is valid
            if ($idevice->getName() == $this->tmpIdeviceFileName) {
                $response['error'] = $this->translator->trans('Invalid iDevice name');
            }
            // Check if idevice already exists in base idevices
            foreach ($preInstallationIdevicesBase as $t) {
                if ($t->getName() == $idevice->getName()) {
                    $response['error'] = $this->translator->trans(
                        'The iDevice [%s] already exists',
                        ['%s' => $idevice->getName()]
                    );
                }
            }
            // Check if idevice already exists in user idevices
            foreach ($preInstallationIdevicesUser as $t) {
                if ($t->getName() == $idevice->getName()) {
                    $response['error'] = $this->translator->trans(
                        'The iDevice [%s] already exists',
                        ['%s' => $idevice->getName()]
                    );
                }
            }
        }

        // Extract zip into idevice name dir
        if (!isset($response['error'])) {
            $ideviceDirPath = $idevicesDir.DIRECTORY_SEPARATOR.$idevice->getName();
            FileUtil::extractZipTo($outputFileZip, $ideviceDirPath);
        }

        // Delete tmp idevice dir
        try {
            $this->fileHelper->deleteDir($tmpIdeviceDirPath);
        } catch (\Exception $e) {
        }

        // Delete zip
        try {
            unlink($outputFileZip);
        } catch (\Exception $e) {
        }

        return $response;
    }
}
