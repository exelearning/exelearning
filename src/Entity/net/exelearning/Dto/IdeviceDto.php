<?php

namespace App\Entity\net\exelearning\Dto;

use App\Constants;
use App\Helper\net\exelearning\Helper\IdeviceHelper;
use App\Util\net\exelearning\Util\FileUtil;
use Symfony\Component\Security\Core\User\UserInterface;

/**
 * IdeviceDto.
 */
class IdeviceDto extends BaseDto
{
    public const ICON_TYPE_EXE_ICON = 'exe-icon';
    public const ICON_TYPE_IMG = 'img';

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
    protected $cssClass;

    /**
     * @var string
     */
    protected $category;

    /**
     * @var array
     */
    protected $icon;

    /**
     * @var string
     */
    protected $url;

    /**
     * @var string
     */
    protected $version;

    /**
     * @var string
     */
    protected $apiVersion;

    /**
     * @var string
     */
    protected $componentType;

    /**
     * @var string
     */
    protected $location;

    /**
     * @var string
     */
    protected $locationType;

    /**
     * @var string[]
     */
    protected $editionJs;

    /**
     * @var string[]
     */
    protected $editionCss;

    /**
     * @var string[]
     */
    protected $exportJs;

    /**
     * @var string[]
     */
    protected $exportCss;

    /**
     * @var string
     */
    protected $exportTemplateFilename;

    /**
     * @var string
     */
    protected $exportTemplateContent;

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
     * @var bool
     */
    protected $defaultVisibility;

    /**
     * @var string
     */
    protected $visible;

    /**
     * @var string
     */
    protected $downloadable;

    public function __construct()
    {
        $this->editionJs = [];
        $this->editionCss = [];
        $this->exportJs = [];
        $this->exportCss = [];

        $this->icon = [
            'name' => null,
            'url' => null,
            'type' => null,
        ];
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
    public function getCssClass()
    {
        return $this->cssClass;
    }

    /**
     * @param string $cssClass
     */
    public function setCssClass($cssClass)
    {
        $this->cssClass = $cssClass;
    }

    /**
     * @return string
     */
    public function getCategory()
    {
        return $this->category;
    }

    /**
     * @param string $category
     */
    public function setCategory($category)
    {
        $this->category = $category;
    }

    /**
     * @return array
     */
    public function getIcon()
    {
        return $this->icon;
    }

    /**
     * @param array $icon
     */
    public function setIcon($icon)
    {
        $this->icon = $icon;
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
    public function getApiVersion()
    {
        return $this->apiVersion;
    }

    /**
     * @param string $apiVersion
     */
    public function setApiVersion($apiVersion)
    {
        $this->apiVersion = $apiVersion;
    }

    /**
     * @return string
     */
    public function getComponentType()
    {
        return $this->componentType;
    }

    /**
     * @param string $componentType
     */
    public function setComponentType($componentType)
    {
        $this->componentType = $componentType;
    }

    /**
     * @return string
     */
    public function getLocation()
    {
        return $this->location;
    }

    /**
     * @param string $location
     */
    public function setLocation($location)
    {
        $this->location = $location;
    }

    /**
     * @return string
     */
    public function getLocationType()
    {
        return $this->locationType;
    }

    /**
     * @param string $locationType
     */
    public function setLocationType($locationType)
    {
        $this->locationType = $locationType;
    }

    /**
     * @return string[]
     */
    public function getEditionJs()
    {
        return $this->editionJs;
    }

    /**
     * @param string[] $editionJs
     */
    public function setEditionJs($editionJs)
    {
        $this->editionJs = $editionJs;
    }

    /**
     * @param string $filename
     */
    public function addEditionJs($filename)
    {
        $this->editionJs[] = $filename;
    }

    /**
     * @return string[]
     */
    public function getEditionCss()
    {
        return $this->editionCss;
    }

    /**
     * @param string[] $editionCss
     */
    public function setEditionCss($editionCss)
    {
        $this->editionCss = $editionCss;
    }

    /**
     * @param string $filename
     */
    public function addEditionCss($filename)
    {
        $this->editionCss[] = $filename;
    }

    /**
     * @return string[]
     */
    public function getExportJs()
    {
        return $this->exportJs;
    }

    /**
     * @param string[] $exportJs
     */
    public function setExportJs($exportJs)
    {
        $this->exportJs = $exportJs;
    }

    /**
     * @param string $filename
     */
    public function addExportJs($filename)
    {
        $this->exportJs[] = $filename;
    }

    /**
     * @return string[]
     */
    public function getExportCss()
    {
        return $this->exportCss;
    }

    /**
     * @param string[] $exportCss
     */
    public function setExportCss($exportCss)
    {
        $this->exportCss = $exportCss;
    }

    /**
     * @param string $filename
     */
    public function addExportCss($filename)
    {
        $this->exportCss[] = $filename;
    }

    /**
     * @return string
     */
    public function getExportTemplateFilename()
    {
        return $this->exportTemplateFilename;
    }

    /**
     * @param string $exportTemplateFilename
     */
    public function setExportTemplateFilename($exportTemplateFilename)
    {
        $this->exportTemplateFilename = $exportTemplateFilename;
    }

    /**
     * @return string
     */
    public function getExportTemplateContent()
    {
        return $this->exportTemplateContent;
    }

    /**
     * @param string $exportTemplateContent
     */
    public function setExportTemplateContent($exportTemplateContent)
    {
        $this->exportTemplateContent = $exportTemplateContent;
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
     * @return bool
     */
    public function getDefaultVisibility()
    {
        return $this->defaultVisibility;
    }

    /**
     * @param bool $defaultVisibility
     */
    public function setDefaultVisibility($defaultVisibility)
    {
        $this->defaultVisibility = $defaultVisibility;
    }

    /**
     * @return bool
     */
    public function isVisible()
    {
        return $this->visible;
    }

    /**
     * @param bool $visible
     */
    public function setVisible($visible)
    {
        $this->visible = $visible;
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
     * Loads iDevice data from its config file.
     *
     * @param array         $iDeviceConfigArray
     * @param IdeviceHelper $iDeviceHelper
     * @param string        $type
     * @param UserInterface $user
     */
    public function loadFromConfigArray($iDeviceConfigArray, $iDeviceHelper, $type, $user)
    {
        if (isset($iDeviceConfigArray['name'])) {
            $this->setName($iDeviceConfigArray['name']);
        } elseif (isset($iDeviceConfigArray['dirName'])) {
            $this->setName($iDeviceConfigArray['dirName']);
        }

        if (isset($iDeviceConfigArray['dirName'])) {
            $this->setDirName($iDeviceConfigArray['dirName']);
        }

        if (isset($iDeviceConfigArray['title'])) {
            $this->setTitle($iDeviceConfigArray['title']);
        }

        if (isset($iDeviceConfigArray['css-class'])) {
            $this->setCssClass($iDeviceConfigArray['css-class']);
        }

        if (isset($iDeviceConfigArray['category'])) {
            $this->setCategory($iDeviceConfigArray['category']);
        }

        if (isset($iDeviceConfigArray['icon'])) {
            $icon = $iDeviceConfigArray['icon'];
            if (is_array($icon)) {
                $iconPath = $iDeviceHelper->getIdeviceDir($this->getDirName(), $type, $user).$icon['url'];
                $iconIsFile = file_exists($iconPath);

                if ($iconIsFile) {
                    $iconData = [
                        'name' => $icon['name'],
                        'url' => $icon['url'],
                        'type' => self::ICON_TYPE_IMG,
                    ];
                } else {
                    $iconData = [
                        'name' => $icon['name'],
                        'url' => null,
                        'type' => self::ICON_TYPE_EXE_ICON,
                    ];
                }
            } else {
                $iconData = [
                    'name' => $icon,
                    'url' => null,
                    'type' => self::ICON_TYPE_EXE_ICON,
                ];
            }

            $this->setIcon($iconData);
        }

        if (isset($iDeviceConfigArray['version'])) {
            $this->setVersion($iDeviceConfigArray['version']);
        }

        if (isset($iDeviceConfigArray['api-version'])) {
            $this->setApiVersion($iDeviceConfigArray['api-version']);
        }

        if (isset($iDeviceConfigArray['component-type'])) {
            $this->setComponentType($iDeviceConfigArray['component-type']);
        }

        if (isset($iDeviceConfigArray['location'])) {
            $this->setLocation($iDeviceConfigArray['location']);
        }

        if (isset($iDeviceConfigArray['location-type'])) {
            $this->setLocationType($iDeviceConfigArray['location-type']);
        }

        $iDeviceEditionDirPath = $iDeviceHelper->getIdeviceEditionDirPath(
            $this->dirName,
            $type,
            $user
        ).DIRECTORY_SEPARATOR;
        $iDeviceExportDirPath = $iDeviceHelper->getIdeviceExportDirPath(
            $this->dirName,
            $type,
            $user
        ).DIRECTORY_SEPARATOR;

        // If filenames are defined in config file read them
        if (isset($iDeviceConfigArray['edition-js']['filename'])) {
            if (is_array($iDeviceConfigArray['edition-js']['filename'])) {
                foreach ($iDeviceConfigArray['edition-js']['filename'] as $filename) {
                    if (file_exists($iDeviceEditionDirPath.$filename)) {
                        $this->addEditionJs($filename);
                    }
                }
            } else {
                $filename = $iDeviceConfigArray['edition-js']['filename'];

                if (file_exists($iDeviceEditionDirPath.$filename)) {
                    $this->addEditionJs($filename);
                }
            }
        } else { // Search all files in dir and subdirectories
            if (file_exists($iDeviceEditionDirPath)) {
                $jsEditionFileList = FileUtil::listFilesByName(
                    $iDeviceEditionDirPath,
                    ['*.'.Constants::FILE_EXTENSION_JS]
                );

                foreach ($jsEditionFileList as $filename) {
                    if (file_exists($filename)) {
                        $this->addEditionJs(str_replace($iDeviceEditionDirPath, '', $filename));
                    }
                }
            }
        }

        // If filenames are defined in config file read them
        if (isset($iDeviceConfigArray['edition-css']['filename'])) {
            if (is_array($iDeviceConfigArray['edition-css']['filename'])) {
                foreach ($iDeviceConfigArray['edition-css']['filename'] as $filename) {
                    if (file_exists($iDeviceEditionDirPath.$filename)) {
                        $this->addEditionCss($filename);
                    }
                }
            } else {
                $filename = $iDeviceConfigArray['edition-css']['filename'];

                if (file_exists($iDeviceEditionDirPath.$filename)) {
                    $this->addEditionCss($filename);
                }
            }
        } else { // Search all files in dir and subdirectories
            if (file_exists($iDeviceEditionDirPath)) {
                $cssEditionFileList = FileUtil::listFilesByName(
                    $iDeviceEditionDirPath,
                    ['*.'.Constants::FILE_EXTENSION_CSS]
                );

                foreach ($cssEditionFileList as $filename) {
                    if (file_exists($filename)) {
                        $this->addEditionCss(str_replace($iDeviceEditionDirPath, '', $filename));
                    }
                }
            }
        }

        // If filenames are defined in config file read them
        if (isset($iDeviceConfigArray['export-js']['filename'])) {
            if (is_array($iDeviceConfigArray['export-js']['filename'])) {
                foreach ($iDeviceConfigArray['export-js']['filename'] as $filename) {
                    if (file_exists($iDeviceExportDirPath.$filename)) {
                        $this->addExportJs($filename);
                    }
                }
            } else {
                $filename = $iDeviceConfigArray['export-js']['filename'];

                if (file_exists($iDeviceExportDirPath.$filename)) {
                    $this->addExportJs($filename);
                }
            }
        } else { // Search all files in dir and subdirectories
            if (file_exists($iDeviceExportDirPath)) {
                $jsExportFileList = FileUtil::listFilesByName(
                    $iDeviceExportDirPath,
                    ['*.'.Constants::FILE_EXTENSION_JS]
                );

                foreach ($jsExportFileList as $filename) {
                    if (file_exists($filename)) {
                        $this->addExportJs(str_replace($iDeviceExportDirPath, '', $filename));
                    }
                }
            }
        }

        // If filenames are defined in config file read them
        if (isset($iDeviceConfigArray['export-css']['filename'])) {
            if (is_array($iDeviceConfigArray['export-css']['filename'])) {
                foreach ($iDeviceConfigArray['export-css']['filename'] as $filename) {
                    if (file_exists($iDeviceExportDirPath.$filename)) {
                        $this->addExportCss($filename);
                    }
                }
            } else {
                $filename = $iDeviceConfigArray['export-css']['filename'];

                if (file_exists($iDeviceExportDirPath.$filename)) {
                    $this->addExportCss($filename);
                }
            }
        } else { // Search all files in dir and subdirectories
            if (file_exists($iDeviceExportDirPath)) {
                $cssExportFileList = FileUtil::listFilesByName(
                    $iDeviceExportDirPath,
                    ['*.'.Constants::FILE_EXTENSION_CSS]
                );

                foreach ($cssExportFileList as $filename) {
                    if (file_exists($filename)) {
                        $this->addExportCss(str_replace($iDeviceExportDirPath, '', $filename));
                    }
                }
            }
        }

        if (isset($iDeviceConfigArray['export-template-filename'])) {
            $filename = $iDeviceConfigArray['export-template-filename'];

            if (file_exists($iDeviceExportDirPath.$filename)) {
                $this->setExportTemplateFilename($filename);
            }
        } else {
            $filename = $this->name.'.'.Constants::FILE_EXTENSION_HTML;

            if (file_exists($iDeviceExportDirPath.$filename)) {
                $this->setExportTemplateFilename($filename);
            }
        }

        if (!empty($this->getExportTemplateFilename())) {
            $htmlTemplatePath = $iDeviceHelper->getIdeviceExportDirPath(
                $this->getDirName(),
                $type,
                $user
            ).DIRECTORY_SEPARATOR.$this->getExportTemplateFilename();

            if (file_exists($htmlTemplatePath)) {
                $htmlTemplate = '';
                $file = new \SplFileObject($htmlTemplatePath);
                while (!$file->eof()) {
                    $htmlTemplate .= trim($file->fgets());
                }
                $file = null;
                $this->setExportTemplateContent($htmlTemplate);
            }
        }

        if (isset($iDeviceConfigArray['author'])) {
            $this->setAuthor($iDeviceConfigArray['author']);
        }

        if (isset($iDeviceConfigArray['author-url'])) {
            $this->setAuthorUrl($iDeviceConfigArray['author-url']);
        }

        if (isset($iDeviceConfigArray['license'])) {
            $this->setLicense($iDeviceConfigArray['license']);
        }

        if (isset($iDeviceConfigArray['license-url'])) {
            $this->setLicenseUrl($iDeviceConfigArray['license-url']);
        }

        if (isset($iDeviceConfigArray['description'])) {
            $this->setDescription($iDeviceConfigArray['description']);
        }

        if (isset($iDeviceConfigArray['default-visibility'])) {
            $this->setDefaultVisibility('1' == $iDeviceConfigArray['default-visibility']);
        } else {
            $this->setDefaultVisibility(true);
        }

        if (isset($iDeviceConfigArray['downloadable'])) {
            $this->setDownloadable('1' == $iDeviceConfigArray['downloadable']);
        } else {
            $this->setDownloadable(true);
        }
    }

    /**
     * Checks if iDevice is valid.
     *
     * @return bool
     */
    public function isValid()
    {
        if (!empty($this->getEditionJs())) {
            return true;
        } else {
            return false;
        }
    }
}
