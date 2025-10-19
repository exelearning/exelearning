<?php

namespace App\Helper\net\exelearning\Helper;

use App\Constants;
use App\Entity\net\exelearning\Dto\ThemeDto;
use App\Entity\net\exelearning\Entity\User;
use App\Util\net\exelearning\Util\FilePermissionsUtil;
use App\Util\net\exelearning\Util\FileUtil;
use App\Util\net\exelearning\Util\XmlUtil;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * ThemeHelper.
 *
 * Utility functions for working with themes
 */
class ThemeHelper
{
    private $fileHelper;
    private $translator;
    private $entityManager;
    private $tmpThemeFileName;

    public function __construct(
        FileHelper $fileHelper,
        TranslatorInterface $translator,
        EntityManagerInterface $entityManager,
    ) {
        $this->fileHelper = $fileHelper;
        $this->translator = $translator;
        $this->entityManager = $entityManager;
        $this->tmpThemeFileName = 'tmp';
    }

    /**
     * Returns theme dir path.
     *
     * @param string        $themeDir
     * @param string        $type
     * @param UserInterface $user
     *
     * @return string|bool
     */
    public function getThemeDir($themeDir, $type = Constants::THEME_TYPE_BASE, $user = null)
    {
        switch ($type) {
            case Constants::THEME_TYPE_BASE:
                $path = $this->fileHelper->getThemesBaseDir().$themeDir.DIRECTORY_SEPARATOR;
                break;
            case Constants::THEME_TYPE_USER:
                $dbUser = $this->getDatabaseUser($user);
                $path = $this->fileHelper->getThemesUsersDir().$dbUser->getUserId().
                    DIRECTORY_SEPARATOR.$themeDir.DIRECTORY_SEPARATOR;
                break;
            default:
                $path = false;
        }

        return $path;
    }

    /**
     * Returns theme config file path and name.
     *
     * @param string $themeDir
     * @param string $type
     *
     * @return string
     */
    public function getThemeConfigFilePathName($themeDir, $type = Constants::THEME_TYPE_BASE, $user = null)
    {
        switch ($type) {
            case Constants::THEME_TYPE_BASE:
                $path = $this->fileHelper->getThemesBaseDir().$themeDir.DIRECTORY_SEPARATOR.
                    Constants::THEME_CONFIG_FILENAME;
                break;
            case Constants::THEME_TYPE_USER:
                $dbUser = $this->getDatabaseUser($user);
                $path = $this->fileHelper->getThemesUsersDir().$dbUser->getUserId().
                    DIRECTORY_SEPARATOR.$themeDir.DIRECTORY_SEPARATOR.Constants::THEME_CONFIG_FILENAME;
                break;
            default:
                $path = false;
        }

        return $path;
    }

    /**
     * Get theme url.
     *
     * @param string $themeDir
     * @param string $type
     * @param bool   $user
     *
     * @return string
     */
    public function getThemeUrl($themeDir, $type, $user = false)
    {
        $baseUrl = $this->getThemeBaseUrl();
        switch ($type) {
            case Constants::THEME_TYPE_BASE:
                $baseUrl .= Constants::THEMES_BASE_DIR_NAME.Constants::SLASH.$themeDir;
                break;
            case Constants::THEME_TYPE_USER:
                $dbUser = $this->getDatabaseUser($user);
                $baseUrl .= Constants::THEMES_USERS_DIR_NAME.Constants::SLASH.$dbUser->getUserId().
                    Constants::SLASH.$themeDir;
                break;
        }

        return $baseUrl;
    }

    /**
     * Get themes base url.
     *
     * @return string
     */
    public function getThemeBaseUrl()
    {
        return Constants::SLASH.Constants::FILES_DIR_NAME.Constants::SLASH.
            Constants::PERMANENT_CONTENT_STORAGE_DIRECTORY.Constants::SLASH.
            Constants::THEMES_DIR_NAME.Constants::SLASH;
    }

    /**
     * Get user theme dir.
     *
     * @param UserInterface $user
     *
     * @return string
     */
    public function getUserThemeNameDirectory($user)
    {
        $dbUser = $this->getDatabaseUser($user);

        return Constants::SLASH.Constants::FILES_DIR_NAME.$dbUser->getUserId();
    }

    /**
     * Undocumented function.
     *
     * @param [type] $themeDir
     * @param [type] $user
     *
     * @return void
     */
    public function searchThemeFromThemeDir($themeDir, $user = null)
    {
        $theme = $this->getThemeFromThemeDir($themeDir, Constants::THEME_TYPE_BASE);
        if (!$theme) {
            $theme = $this->getThemeFromThemeDir($themeDir, Constants::THEME_TYPE_USER, $user);
        }

        return $theme;
    }

    /**
     * Returns ThemeDto from $themeDir.
     *
     * @param string        $themeDir
     * @param string        $type
     * @param UserInterface $user
     *
     * @return ThemeDto
     */
    public function getThemeFromThemeDir($themeDir, $type, $user = null)
    {
        $theme = false;
        $themeConfigFilePathName = $this->getThemeConfigFilePathName($themeDir, $type, $user);

        if ($themeConfigFilePathName && file_exists($themeConfigFilePathName)) {
            // New style
            $theme = new ThemeDto();

            // Set type
            $theme->setType($type);

            // Get theme dir
            $themeDirPath = $this->getThemeDir($themeDir, $type, $user);

            // Get config from xml and set to theme
            $themeConfigFileContent = FileUtil::getFileContent($themeConfigFilePathName);
            $themeConfigArray = XmlUtil::loadXmlStringToArray($themeConfigFileContent);
            $themeConfigArray['dirName'] = $themeDir;

            // Load theme data from its config array
            $theme->loadFromConfigArray($themeConfigArray);

            // Load css files
            $theme->loadCssFiles($this, $user);

            // Load js files
            $theme->loadJsFiles($this, $user);

            // Set url
            $theme->setUrl($this->getThemeUrl($theme->getDirName(), $type, $user));

            // Header images urls
            if ($theme->getLogoImg()) {
                $theme->setLogoImgUrl($theme->getUrl().Constants::SLASH.$theme->getLogoImg());
            }
            if ($theme->getHeaderImg()) {
                $theme->setHeaderImgUrl($theme->getUrl().Constants::SLASH.$theme->getHeaderImg());
            }

            // Load icons
            $theme->loadIcons($this, $user);

            // Set templates
            if (isset($themeConfigArray['template-page'])) {
                $templatePageFile = $themeDirPath.$themeConfigArray['template-page'];
                if (file_exists($templatePageFile)) {
                    $templatePageContent = FileUtil::getFileContent($templatePageFile);
                    $theme->setTemplatePage($templatePageContent);
                }
            }
            if (isset($themeConfigArray['template-idevice'])) {
                $templateIdeviceFile = $themeDirPath.$themeConfigArray['template-idevice'];
                if (file_exists($templateIdeviceFile)) {
                    $templateIdeviceContent = FileUtil::getFileContent($templateIdeviceFile);
                    $theme->setTemplateIdevice($templateIdeviceContent);
                }
            }

            // if theme doesn't have a name set dir as name
            if (empty($theme->getName())) {
                $theme->setName($themeDir);
            }
        }

        return $theme;
    }

    /**
     * Returns an array of ThemeDto from base themes.
     *
     * @return ThemeDto[]
     */
    public function getThemesConfigBase()
    {
        $dir = $this->fileHelper->getThemesBaseDir();
        $baseThemes = $this->getThemesConfigByDir($dir, Constants::THEME_TYPE_BASE);

        return $baseThemes;
    }

    /**
     * Returns an array of ThemeDto from user themes.
     *
     * @param UserInterface $user
     *
     * @return ThemeDto[]
     */
    public function getThemesConfigUser($user)
    {
        $dbUser = $this->getDatabaseUser($user);
        $dir = $this->fileHelper->getThemesUsersDir().DIRECTORY_SEPARATOR.$dbUser->getUserId();
        $userThemes = $this->getThemesConfigByDir($dir, Constants::THEME_TYPE_USER, $user);

        return $userThemes;
    }

    /**
     * Returns an array of ThemeDto from themes of dir.
     *
     * @param string        $themesRootDir
     * @param UserInterface $user
     *
     * @return ThemeDto[]
     */
    public function getThemesConfigByDir($themesRootDir, $type, $user = null)
    {
        $result = [];

        // Check if directory exists
        if (!$themesRootDir || !file_exists($themesRootDir)) {
            return $result;
        }

        // Get themes directories
        $themesDir = FileUtil::listSubdirs($themesRootDir);

        foreach ($themesDir as $themeDir) {
            $theme = $this->getThemeFromThemeDir($themeDir, $type, $user);
            if ($theme) {
                $result[$theme->getName()] = $theme;
            }
        }

        return $result;
    }

    /**
     * Create empty user theme directory.
     *
     * @param string        $themeDir
     * @param UserInterface $user
     */
    public function makeEmptyThemes($themeDir, $user)
    {
        $dbUser = $this->getDatabaseUser($user);
        $themesDir = $this->fileHelper->getThemesUsersDir().$dbUser->getUserId();
        $newThemeDir = $themesDir.DIRECTORY_SEPARATOR.$themeDir;
        mkdir($newThemeDir);

        $configFile = $newThemeDir.DIRECTORY_SEPARATOR.Constants::THEME_CONFIG_FILENAME;
        $fileConfig = fopen($configFile, 'w') or exit('Unable to open file!');
        fwrite($fileConfig, '');
        fclose($fileConfig);
    }

    /**
     * Upload and install theme zip.
     *
     * @param string        $filename
     * @param string        $base64String
     * @param UserInterface $user
     *
     * @return array
     */
    public function uploadThemeZip($filename, $base64String, $user)
    {
        $response = [];
        $response['error'] = false;

        // Modify zip filename
        $cleanFilename = str_replace(' ', '_', $filename); // replaces all spaces with underscores
        $cleanFilename = preg_replace("/[^A-Za-z0-9\-\.]/", '', $cleanFilename); // removes special chars

        // Generate new filename in user dir
        $dbUser = $this->getDatabaseUser($user);
        $themesDir = $this->fileHelper->getThemesUsersDir().$dbUser->getUserId();
        $outputFileZip = $themesDir.DIRECTORY_SEPARATOR.$cleanFilename;

        // Check if have write permission and create zip file in server
        $openThemeZipResponse = $this->fopenThemeZip($themesDir, $outputFileZip);
        $ifp = isset($openThemeZipResponse['ifp']) ? $openThemeZipResponse['ifp'] : false;

        if (!$ifp) {
            $response['error'] = $this->translator->trans('Unable to extract zip file');
        }
        if (isset($openThemeZipResponse['error'])) {
            $response['error'] = $openThemeZipResponse['error'];
        }

        // Theme dir
        $tmpThemeDirPath = $themesDir.DIRECTORY_SEPARATOR.$this->tmpThemeFileName;

        // Write zip in themes dir
        if ($ifp) {
            // Create zip in server
            $this->writeThemeZip($ifp, $base64String);
            // Extract zip in server
            $unzipThemeResponse = $this->unzipTheme($outputFileZip, $tmpThemeDirPath, $themesDir, $user);

            if (isset($unzipThemeResponse['error'])) {
                $response['error'] = $unzipThemeResponse['error'];
                $themeDirName = false;
            } else {
                $themeDirName = $unzipThemeResponse['themeDirName'];
            }
        }

        // Get new ThemeDto
        if ($themeDirName) {
            $theme = $this->getThemeFromThemeDir($themeDirName, Constants::THEME_TYPE_USER, $user);
        } else {
            $theme = false;
        }

        if ($theme) {
            $response['theme'] = $theme;
        }

        // Returns array with ThemeDto
        return $response;
    }

    /**
     * Create empty zip file in server.
     *
     * @param string $themesDir
     * @param string $outputFileZip
     *
     * @return array
     */
    public function fopenThemeZip($themesDir, $outputFileZip)
    {
        $response = [];

        // Check if have write permission
        $ifp = false;
        if (FilePermissionsUtil::isWritable($themesDir)) {
            try {
                $ifp = fopen($outputFileZip, 'wb');
                $response['ifp'] = $ifp;
            } catch (\Exception $e) {
                $response['error'] = $e->getMessage();
            }
        } else {
            $response['error'] = $this->translator->trans(
                'Write permissions error in %s',
                ['%s' => $themesDir]
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
    public function writeThemeZip($ifp, $base64String)
    {
        // Write data in open zip file
        $data = explode(';base64,', $base64String);
        fwrite($ifp, base64_decode($data[1]));
        fclose($ifp);
    }

    /**
     * Unzip theme in the corresponding directory.
     *
     * @param string        $outputFileZip
     * @param string        $tmpThemeDirPath
     * @param string        $themesDir
     * @param UserInterface $user
     */
    public function unzipTheme($outputFileZip, $tmpThemeDirPath, $themesDir, $user): array
    {
        $response = [];

        $preInstallationThemesBase = $this->getThemesConfigBase();
        $preInstallationThemesUser = $this->getThemesConfigUser($user);

        try {
            FileUtil::extractZipTo($outputFileZip, $tmpThemeDirPath);
        } catch (\Exception $e) {
            $response['error'] = $this->translator->trans('Could not extract style');
            $this->cleanupResources($outputFileZip, $tmpThemeDirPath);

            return $response;
        }

        $theme = $this->getThemeFromThemeDir($this->tmpThemeFileName, Constants::THEME_TYPE_USER, $user);

        if (!$theme) {
            $response['error'] = $this->translator->trans('Could not load style');
            $this->cleanupResources($outputFileZip, $tmpThemeDirPath);

            return $response;
        }

        if (!$theme->isDownloadable()) {
            $response['error'] = $this->translator->trans('The style is not installable');
            $this->cleanupResources($outputFileZip, $tmpThemeDirPath);

            return $response;
        }

        if ($theme->getName() === $this->tmpThemeFileName || empty($theme->getName())) {
            $response['error'] = $this->translator->trans('Invalid style name');
            $this->cleanupResources($outputFileZip, $tmpThemeDirPath);

            return $response;
        }

        if ($this->themeExists($theme->getName(), $preInstallationThemesBase, $preInstallationThemesUser)) {
            $response['error'] = $this->translator->trans(
                'The style [%s] already exists',
                ['%s' => $theme->getName()]
            );
            $this->cleanupResources($outputFileZip, $tmpThemeDirPath);

            return $response;
        }

        $themeDirPath = $themesDir.DIRECTORY_SEPARATOR.$theme->getName();

        try {
            FileUtil::extractZipTo($outputFileZip, $themeDirPath);
            $response['themeDirName'] = $theme->getName();
        } catch (\Exception $e) {
            $response['error'] = $this->translator->trans('Could not install style');
        }

        $this->cleanupResources($outputFileZip, $tmpThemeDirPath);

        return $response;
    }

    private function themeExists(string $themeName, array $baseThemes, array $userThemes): bool
    {
        foreach ($baseThemes as $theme) {
            if ($theme->getName() === $themeName) {
                return true;
            }
        }

        foreach ($userThemes as $theme) {
            if ($theme->getName() === $themeName) {
                return true;
            }
        }

        return false;
    }

    private function cleanupResources(string $zipPath, string $tmpDirPath): void
    {
        try {
            if (file_exists($zipPath)) {
                unlink($zipPath);
            }
        } catch (\Exception $e) {
            $this->logger->warning('Could not delete zip file', ['path' => $zipPath]);
        }

        try {
            if (is_dir($tmpDirPath)) {
                $this->fileHelper->deleteDir($tmpDirPath);
            }
        } catch (\Exception $e) {
            $this->logger->warning('Could not delete temp directory', ['path' => $tmpDirPath]);
        }
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
        $loggedUserName = $userLogged ? $userLogged->getUserIdentifier() : '';
        $userFilters = ['email' => $loggedUserName];

        // Add other filters
        foreach ($filters as $filter => $value) {
            $userFilters[$filter] = $value;
        }

        $user = $userRepo->findOneBy($userFilters);

        return $user;
    }
}
