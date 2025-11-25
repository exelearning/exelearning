<?php

namespace App\Entity\net\exelearning\Dto;

use App\Constants;
use App\Helper\net\exelearning\Helper\ThemeHelper;
use App\Util\net\exelearning\Util\FileUtil;
use Symfony\Component\Security\Core\User\UserInterface;

/**
 * ThemeDto.
 */
class ThemeDto extends BaseDto
{
    // Xml tags
    public const THEME_XML_TAG_ROOT = 'theme';
    public const THEME_XML_TAG_NAME = 'name';
    public const THEME_XML_TAG_TITLE = 'title';
    public const THEME_XML_TAG_VERSION = 'version';
    public const THEME_XML_TAG_COMPATIBILITY = 'compatibility';
    public const THEME_XML_TAG_AUTHOR = 'author';
    public const THEME_XML_TAG_AUTHOR_URL = 'author-url';
    public const THEME_XML_TAG_LICENSE = 'license';
    public const THEME_XML_TAG_LICENSE_URL = 'license-url';
    public const THEME_XML_TAG_DESCRIPTION = 'description';
    public const THEME_XML_TAG_TEMPLATE_PAGE = 'template-page';
    public const THEME_XML_TAG_TEMPLATE_IDEVICE = 'template-idevice';
    public const THEME_XML_TAG_TEXT_COLOR = 'text-color';
    public const THEME_XML_TAG_LINK_COLOR = 'link-color';
    public const THEME_XML_TAG_HEADER_IMG = 'header-img';
    public const THEME_XML_TAG_LOGO_IMG = 'logo-img';
    public const THEME_XML_TAG_FAVICON_IMG = 'favicon-img';
    public const THEME_XML_TAG_DOWNLOADABLE = 'downloadable';

    private $icons;

    /**
     * @var string
     */
    protected $name;

    /**
     * @var string
     */
    protected $dirName;

    /**
     * @var string
     */
    protected $title;

    /**
     * @var string
     */
    protected $version;

    /**
     * @var string
     */
    protected $author;

    /**
     * @var string
     */
    protected $authorUrl;

    /**
     * @var string
     */
    protected $license;

    /**
     * @var string
     */
    protected $licenseUrl;

    /**
     * @var string
     */
    protected $description;

    /**
     * @var string
     */
    protected $type;

    /**
     * @var string
     */
    protected $url;

    /**
     * @var array
     */
    protected $cssFiles;

    /**
     * @var array
     */
    protected $jsFiles;

    /**
     * @var string
     */
    protected $templatePage;

    /**
     * @var string
     */
    protected $templateIdevice;

    /**
     * @var string
     */
    protected $textColor;

    /**
     * @var string
     */
    protected $linkColor;

    /**
     * @var string
     */
    protected $headerImg;

    /**
     * @var string
     */
    protected $logoImg;

    /**
     * @var string
     */
    protected $faviconImg;

    /**
     * @var string
     */
    protected $headerImgUrl;

    /**
     * @var string
     */
    protected $logoImgUrl;

    /**
     * @var string
     */
    protected $faviconUrl;

    /**
     * @var bool
     */
    protected $downloadable;

    public function __construct()
    {
    }

    /**
     * @return string
     */
    public function getName()
    {
        return $this->name;
    }

    /**
     * @param string $name
     */
    public function setName($name)
    {
        $this->name = $name;
    }

    /**
     * @return string
     */
    public function getDirName()
    {
        return $this->dirName;
    }

    /**
     * @param string $dirName
     */
    public function setDirName($dirName)
    {
        $this->dirName = $dirName;
    }

    /**
     * @return string
     */
    public function getTitle()
    {
        return $this->title;
    }

    /**
     * @param string $title
     */
    public function setTitle($title)
    {
        $this->title = $title;
    }

    /**
     * @return string
     */
    public function getVersion()
    {
        return $this->version;
    }

    /**
     * @param string $version
     */
    public function setVersion($version)
    {
        $this->version = $version;
    }

    /**
     * @return string
     */
    public function getAuthor()
    {
        return $this->author;
    }

    /**
     * @param string $author
     */
    public function setAuthor($author)
    {
        $this->author = $author;
    }

    /**
     * @return string
     */
    public function getAuthorUrl()
    {
        return $this->authorUrl;
    }

    /**
     * @param string $authorUrl
     */
    public function setAuthorUrl($authorUrl)
    {
        $this->authorUrl = $authorUrl;
    }

    /**
     * @return string
     */
    public function getLicense()
    {
        return $this->license;
    }

    /**
     * @param string $license
     */
    public function setLicense($license)
    {
        $this->license = $license;
    }

    /**
     * @return string
     */
    public function getLicenseUrl()
    {
        return $this->licenseUrl;
    }

    /**
     * @param string $licenseUrl
     */
    public function setLicenseUrl($licenseUrl)
    {
        $this->licenseUrl = $licenseUrl;
    }

    /**
     * @return string
     */
    public function getDescription()
    {
        return $this->description;
    }

    /**
     * @param string $description
     */
    public function setDescription($description)
    {
        $this->description = $description;
    }

    /**
     * @return string
     */
    public function getType()
    {
        return $this->type;
    }

    /**
     * @param string $type
     */
    public function setType($type)
    {
        $this->type = $type;
    }

    /**
     * @return string
     */
    public function getUrl()
    {
        return $this->url;
    }

    public function setUrl($url)
    {
        $this->url = $url;
    }

    /**
     * @return array
     */
    public function getCssFiles()
    {
        return $this->cssFiles;
    }

    /**
     * @param array $cssFiles
     */
    public function setCssFiles($cssFiles)
    {
        $this->cssFiles = $cssFiles;
    }

    /**
     * @return array
     */
    public function getJsFiles()
    {
        return $this->jsFiles;
    }

    public function setJsFiles($jsFiles)
    {
        $this->jsFiles = $jsFiles;
    }

    /**
     * @return array
     */
    public function getIcons()
    {
        return $this->icons;
    }

    /**
     * @param array $icons
     */
    public function setIcons($icons)
    {
        $this->icons = $icons;
    }

    /**
     * @return string
     */
    public function getTemplatePage()
    {
        return $this->templatePage;
    }

    /**
     * @param string $templatePage
     */
    public function setTemplatePage($templatePage)
    {
        $this->templatePage = $templatePage;
    }

    /**
     * @return string
     */
    public function getTemplateIdevice()
    {
        return $this->templateIdevice;
    }

    /**
     * @param string $templateIdevice
     */
    public function setTemplateIdevice($templateIdevice)
    {
        $this->templateIdevice = $templateIdevice;
    }

    /**
     * @return string
     */
    public function getTextColor()
    {
        return $this->textColor;
    }

    /**
     * @param string $textColor
     */
    public function setTextColor($textColor)
    {
        $this->textColor = $textColor;
    }

    /**
     * @return string
     */
    public function getLinkColor()
    {
        return $this->linkColor;
    }

    /**
     * @param string $linkColor
     */
    public function setLinkColor($linkColor)
    {
        $this->linkColor = $linkColor;
    }

    /**
     * @return string
     */
    public function getHeaderImg()
    {
        return $this->headerImg;
    }

    /**
     * @param string $headerImg
     */
    public function setHeaderImg($headerImg)
    {
        $this->headerImg = $headerImg;
    }

    /**
     * @return string
     */
    public function getLogoImg()
    {
        return $this->logoImg;
    }

    /**
     * @param string $logoImg
     */
    public function setLogoImg($logoImg)
    {
        $this->logoImg = $logoImg;
    }

    /**
     * @return string
     */
    public function getFaviconImg()
    {
        return $this->faviconImg;
    }

    /**
     * @param string $faviconImg
     */
    public function setFaviconImg($faviconImg)
    {
        $this->faviconImg = $faviconImg;
    }

    /**
     * @return string
     */
    public function getHeaderImgUrl()
    {
        return $this->headerImgUrl;
    }

    /**
     * @param string $headerImgUrl
     */
    public function setHeaderImgUrl($headerImgUrl)
    {
        $this->headerImgUrl = $headerImgUrl;
    }

    /**
     * @return string
     */
    public function getLogoImgUrl()
    {
        return $this->logoImgUrl;
    }

    /**
     * @param string $logoImgUrl
     */
    public function setLogoImgUrl($logoImgUrl)
    {
        $this->logoImgUrl = $logoImgUrl;
    }

    /**
     * @return string
     */
    public function getFaviconUrl()
    {
        return $this->faviconUrl;
    }

    /**
     * @param string $faviconUrl
     */
    public function setFaviconUrl($faviconUrl)
    {
        $this->faviconUrl = $faviconUrl;
    }

    /**
     * @return bool
     */
    public function isDownloadable()
    {
        return $this->downloadable;
    }

    /**
     * @param bool $downloadable
     */
    public function setDownloadable($downloadable)
    {
        $this->downloadable = $downloadable;
    }

    /**
     * Loads theme data from its config file.
     *
     * @param array $themeConfigArray
     */
    public function loadFromConfigArray($themeConfigArray)
    {
        if (isset($themeConfigArray[self::THEME_XML_TAG_NAME])) {
            $this->setName($themeConfigArray[self::THEME_XML_TAG_NAME]);
        } elseif (isset($themeConfigArray['dirName'])) {
            $this->setName($themeConfigArray['dirName']);
        }

        if (isset($themeConfigArray['dirName'])) {
            $this->setDirName($themeConfigArray['dirName']);
        }

        if (isset($themeConfigArray[self::THEME_XML_TAG_TITLE])) {
            $this->setTitle($themeConfigArray[self::THEME_XML_TAG_TITLE]);
        }

        if (isset($themeConfigArray[self::THEME_XML_TAG_VERSION])) {
            $this->setVersion($themeConfigArray[self::THEME_XML_TAG_VERSION]);
        }

        if (isset($themeConfigArray[self::THEME_XML_TAG_AUTHOR])) {
            $this->setAuthor($themeConfigArray[self::THEME_XML_TAG_AUTHOR]);
        }

        if (isset($themeConfigArray[self::THEME_XML_TAG_AUTHOR_URL])) {
            $this->setAuthorUrl($themeConfigArray[self::THEME_XML_TAG_AUTHOR_URL]);
        }

        if (isset($themeConfigArray[self::THEME_XML_TAG_LICENSE])) {
            $this->setLicense($themeConfigArray[self::THEME_XML_TAG_LICENSE]);
        }

        if (isset($themeConfigArray[self::THEME_XML_TAG_LICENSE_URL])) {
            $this->setLicenseUrl($themeConfigArray[self::THEME_XML_TAG_LICENSE_URL]);
        }

        if (isset($themeConfigArray[self::THEME_XML_TAG_DESCRIPTION])) {
            $this->setDescription($themeConfigArray[self::THEME_XML_TAG_DESCRIPTION]);
        }

        if (isset($themeConfigArray[self::THEME_XML_TAG_TEXT_COLOR])) {
            $this->setTextColor($themeConfigArray[self::THEME_XML_TAG_TEXT_COLOR]);
        }

        if (isset($themeConfigArray[self::THEME_XML_TAG_LINK_COLOR])) {
            $this->setLinkColor($themeConfigArray[self::THEME_XML_TAG_LINK_COLOR]);
        }

        if (isset($themeConfigArray[self::THEME_XML_TAG_HEADER_IMG])) {
            $this->setHeaderImg($themeConfigArray[self::THEME_XML_TAG_HEADER_IMG]);
        }

        if (isset($themeConfigArray[self::THEME_XML_TAG_LOGO_IMG])) {
            $this->setLogoImg($themeConfigArray[self::THEME_XML_TAG_LOGO_IMG]);
        }

        if (isset($themeConfigArray[self::THEME_XML_TAG_FAVICON_IMG])) {
            $this->setFaviconImg($themeConfigArray[self::THEME_XML_TAG_FAVICON_IMG]);
        }

        if (isset($themeConfigArray[self::THEME_XML_TAG_DOWNLOADABLE])) {
            $this->setDownloadable('1' == $themeConfigArray[self::THEME_XML_TAG_DOWNLOADABLE]);
        } else {
            $this->setDownloadable(true);
        }
    }

    /**
     * Get theme css files.
     *
     * @param ThemeHelper   $themeHelper
     * @param UserInterface $user
     *
     * @return array
     */
    public function loadCssFiles($themeHelper, $user)
    {
        $cssFiles = [];

        $themeDir = $themeHelper->getThemeDir($this->dirName, $this->type, $user);
        $filesList = scandir($themeDir);
        foreach ($filesList as $fileName) {
            if ('.css' === substr($fileName, -4)) {
                $cssFiles[] = $fileName;
            }
        }

        $this->setCssFiles($cssFiles);

        return $cssFiles;
    }

    /**
     * Get theme css files.
     *
     * @param ThemeHelper   $themeHelper
     * @param UserInterface $user
     *
     * @return array
     */
    public function loadJsFiles($themeHelper, $user)
    {
        $jsFiles = [];

        $themeDir = $themeHelper->getThemeDir($this->dirName, $this->type, $user);
        $filesList = scandir($themeDir);
        foreach ($filesList as $fileName) {
            if ('.js' === substr($fileName, -3)) {
                $jsFiles[] = $fileName;
            }
        }

        $this->setJsFiles($jsFiles);

        return $jsFiles;
    }

    /**
     * Get icons.
     *
     * @param ThemeHelper   $themeHelper
     * @param UserInterface $user
     *
     * @return array
     */
    public function loadIcons($themeHelper, $user)
    {
        $icons = [];

        $themeDir = $themeHelper->getThemeDir($this->dirName, $this->type, $user);
        $iconsDir = $themeDir.Constants::THEME_ICONS_DIR;

        $iconsList = [];

        // Get icons from theme dir
        if (is_dir($iconsDir)) {
            $iconsList = array_diff(scandir($iconsDir), ['.', '..']);
            $iconType = 'img';
        }

        // Load icons array
        foreach ($iconsList as $iconFileName) {
            // Icon id
            $iconId = pathinfo($iconFileName, PATHINFO_FILENAME);
            // New icon
            $iconArray = [];
            $iconArray['id'] = $iconId;
            $iconArray['title'] = $iconId;
            $iconArray['type'] = $iconType;
            switch ($iconType) {
                case 'img':
                    $iconArray['value'] = substr($this->url, 1).Constants::SLASH.
                        Constants::THEME_ICONS_DIR.Constants::SLASH.$iconFileName;
                    break;
                case 'exe':
                    $iconArray['value'] = $iconFileName;
                    break;
            }
            $icons[$iconId] = $iconArray;
        }

        $this->setIcons($icons);

        return $icons;
    }

    /**
     * Get favicon.
     *
     * @param ThemeHelper   $themeHelper
     * @param UserInterface $user
     *
     * @return string
     */
    public function loadFavicon($themeHelper, $user)
    {
        $themeDir = $themeHelper->getThemeDir($this->dirName, $this->type, $user);
        $faviconDir = $themeDir.Constants::THEME_IMG_DIR;

        // Get favicon from theme dir
        if (is_dir($faviconDir)) {
            // Search for favicon files with common extensions
            $faviconExtensions = ['ico', 'png'];

            foreach ($faviconExtensions as $ext) {
                $faviconFile = $faviconDir.DIRECTORY_SEPARATOR.Constants::THEME_FAVICON_FILENAME.'.'.$ext;
                if (file_exists($faviconFile)) {
                    $faviconPath = Constants::THEME_IMG_DIR.Constants::SLASH.Constants::THEME_FAVICON_FILENAME.'.'.$ext;
                    $this->setFaviconImg($faviconPath);
                    $this->setFaviconUrl($this->url.Constants::SLASH.$faviconPath);

                    return $faviconPath;
                }
            }
        } else {
            return null;
        }
    }

    /**
     * Create config xml.
     *
     * @param ThemeHelper   $themeHelper
     * @param UserInterface $user
     * @param array         $themeConfigArray
     */
    public function createConfigXml($themeHelper, $themeConfigArray, $user)
    {
        $encodingString = '<?xml version="1.0" encoding="utf-8" ?>';
        $themeTagString = '<'.self::THEME_XML_TAG_ROOT.'></'.self::THEME_XML_TAG_ROOT.'>';

        $xml = new \SimpleXMLElement($encodingString.$themeTagString);

        $xml->addChild(self::THEME_XML_TAG_NAME, $this->name);

        $xml->addChild(self::THEME_XML_TAG_TITLE, $themeConfigArray[self::THEME_XML_TAG_TITLE]);

        if ($themeConfigArray[self::THEME_XML_TAG_VERSION]) {
            $xml->addChild(self::THEME_XML_TAG_VERSION, $themeConfigArray[self::THEME_XML_TAG_VERSION]);
        }

        if ($themeConfigArray[self::THEME_XML_TAG_AUTHOR]) {
            $xml->addChild(self::THEME_XML_TAG_AUTHOR, $themeConfigArray[self::THEME_XML_TAG_AUTHOR]);
        }

        if ($themeConfigArray[self::THEME_XML_TAG_AUTHOR_URL]) {
            $xml->addChild(self::THEME_XML_TAG_AUTHOR_URL, $themeConfigArray[self::THEME_XML_TAG_AUTHOR_URL]);
        }

        if ($themeConfigArray[self::THEME_XML_TAG_LICENSE]) {
            $xml->addChild(self::THEME_XML_TAG_LICENSE, $themeConfigArray[self::THEME_XML_TAG_LICENSE]);
        }

        if ($themeConfigArray[self::THEME_XML_TAG_LICENSE_URL]) {
            $xml->addChild(self::THEME_XML_TAG_LICENSE_URL, $themeConfigArray[self::THEME_XML_TAG_LICENSE_URL]);
        }

        if ($themeConfigArray[self::THEME_XML_TAG_DESCRIPTION]) {
            $xml->addChild(self::THEME_XML_TAG_DESCRIPTION, $themeConfigArray[self::THEME_XML_TAG_DESCRIPTION]);
        }

        if ($themeConfigArray[self::THEME_XML_TAG_TEXT_COLOR]) {
            $xml->addChild(self::THEME_XML_TAG_TEXT_COLOR, $themeConfigArray[self::THEME_XML_TAG_TEXT_COLOR]);
        }

        if ($themeConfigArray[self::THEME_XML_TAG_LINK_COLOR]) {
            $xml->addChild(self::THEME_XML_TAG_LINK_COLOR, $themeConfigArray[self::THEME_XML_TAG_LINK_COLOR]);
        }

        if ($themeConfigArray[self::THEME_XML_TAG_HEADER_IMG]) {
            $xml->addChild(self::THEME_XML_TAG_HEADER_IMG, $themeConfigArray[self::THEME_XML_TAG_HEADER_IMG]);
        }

        if ($themeConfigArray[self::THEME_XML_TAG_LOGO_IMG]) {
            $xml->addChild(self::THEME_XML_TAG_LOGO_IMG, $themeConfigArray[self::THEME_XML_TAG_LOGO_IMG]);
        }

        if ($themeConfigArray[self::THEME_XML_TAG_FAVICON_IMG]) {
            $xml->addChild(self::THEME_XML_TAG_FAVICON_IMG, $themeConfigArray[self::THEME_XML_TAG_FAVICON_IMG]);
        }

        $themeDir = $themeHelper->getThemeDir($this->dirName, $this->type, $user);
        $xmlFilePath = $themeDir.Constants::THEME_CONFIG_FILENAME;
        $file = $xml->asXML($xmlFilePath);

        $this->loadFromConfigArray($themeConfigArray);
    }

    /**
     * Create style css.
     *
     * @param ThemeHelper   $themeHelper
     * @param UserInterface $user
     */
    public function createStyleCss($themeHelper, $user)
    {
        $colorTextValue = $this->getTextColor();
        $colorLinkValue = $this->getLinkColor();

        $comment = ''.
            "/* eXeLearning generated style /*/\n".
            "/* This file should only be edited using the app /*/\n";

        $styleRulesText = ''.
            ":root {--color-text: $colorTextValue;--color-link: $colorLinkValue;} \n".
            ".exe-content {color: var(--color-text);}\n".
            '.exe-content a {color: var(--color-link);}';

        $styleGeneratedText = $comment.$styleRulesText;

        $themeDir = $themeHelper->getThemeDir($this->dirName, $this->type, $user);
        $cssFilePath = $themeDir.Constants::THEME_GENERATED_CSS_FILE;

        $file = fopen($cssFilePath, 'w') or exit('Unable to open file!');
        fwrite($file, $styleGeneratedText);
        fclose($file);
    }

    /**
     * Upload header img to theme.
     *
     * @param ThemeHelper   $themeHelper
     * @param UserInterface $user
     * @param string        $base64file
     *
     * @return string|bool
     */
    public function uploadImgHeader($themeHelper, $user, $base64file)
    {
        $mimeType = preg_match_all("/data:image\/(.+);base64/", $base64file, $matches);
        if ($matches && $matches[1]) {
            $themeDir = $themeHelper->getThemeDir($this->dirName, $this->type, $user);
            $headerDirPath = $themeDir.Constants::THEME_HEADER_IMG_DIR.DIRECTORY_SEPARATOR;
            // Remove header dir
            FileUtil::removeDir($headerDirPath);
            // Create header dir
            FileUtil::createDir($headerDirPath, 0775, true);
            // Create header img
            $fileName = Constants::THEME_HEADER_IMG.'.'.$matches[1][0];
            $filePath = Constants::THEME_HEADER_IMG_DIR.DIRECTORY_SEPARATOR.$fileName;
            $this->uploadFile($themeHelper, $user, $filePath, $base64file);

            return Constants::THEME_HEADER_IMG_DIR.Constants::SLASH.$fileName;
        } elseif (str_contains($base64file, Constants::THEME_HEADER_IMG_DIR)) {
            $urlFileArray = explode(Constants::SLASH, $base64file);
            $fileName = end($urlFileArray);

            return Constants::THEME_HEADER_IMG_DIR.Constants::SLASH.$fileName;
        }

        return false;
    }

    /**
     * Upload logo img to theme.
     *
     * @param ThemeHelper   $themeHelper
     * @param UserInterface $user
     * @param string        $base64file
     *
     * @return string|bool
     */
    public function uploadImgLogo($themeHelper, $user, $base64file)
    {
        $mimeType = preg_match_all("/data:image\/(.+);base64/", $base64file, $matches);
        if ($matches && $matches[1]) {
            $themeDir = $themeHelper->getThemeDir($this->dirName, $this->type, $user);
            $logoDirPath = $themeDir.Constants::THEME_LOGO_IMG_DIR.DIRECTORY_SEPARATOR;
            // Remove logo dir
            FileUtil::removeDir($logoDirPath);
            // Create logo dir
            FileUtil::createDir($logoDirPath, 0775, true);
            // Create logo img
            $fileName = Constants::THEME_LOGO_IMG.'.'.$matches[1][0];
            $filePath = Constants::THEME_LOGO_IMG_DIR.DIRECTORY_SEPARATOR.$fileName;
            $this->uploadFile($themeHelper, $user, $filePath, $base64file);

            return Constants::THEME_LOGO_IMG_DIR.Constants::SLASH.$fileName;
        } elseif (str_contains($base64file, Constants::THEME_LOGO_IMG_DIR)) {
            $urlFileArray = explode(Constants::SLASH, $base64file);
            $fileName = end($urlFileArray);

            return Constants::THEME_LOGO_IMG_DIR.Constants::SLASH.$fileName;
        }

        return false;
    }

    /**
     * Upload file to theme dir.
     *
     * @param ThemeHelper   $themeHelper
     * @param UserInterface $user
     * @param string        $filename
     * @param string        $base64data
     *
     * @return void
     */
    public function uploadFile($themeHelper, $user, $filename, $base64data)
    {
        $themeDir = $themeHelper->getThemeDir($this->dirName, $this->type, $user);
        $imgFile = $themeDir.$filename;

        $ifp = fopen($imgFile, 'wb');
        $data = explode(',', $base64data);
        if (isset($data[1])) {
            fwrite($ifp, base64_decode($data[1]));
        }
        fclose($ifp);
    }

    /**
     * Checks if theme is valid.
     *
     * @return bool
     */
    public function isValid()
    {
        // TODO
        return true;
    }
}
