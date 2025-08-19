<?php

namespace App\Util\net\exelearning\Util;

use App\Settings;
use Symfony\Component\Filesystem\Exception\IOExceptionInterface;
use Symfony\Component\Filesystem\Filesystem;
use Symfony\Component\Finder\Finder;
use Symfony\Component\Mime\MimeTypes;
use Symfony\Component\Translation\Loader\XliffFileLoader; // Add this line

/**
 * FileUtil.
 *
 * Utility functions for working with files and directories
 */
class FileUtil
{
    /**
     * Returns an array of the names of the subdirectories of the directory passed as param.
     *
     * @param string $dir
     *
     * @return array
     */
    public static function listSubdirs($dir)
    {
        $subdirectories = [];

        // Call the function to ensure the directory exists, if not, it tries to create it
        self::ensureDirectoryExists($dir);

        $directoryIterator = new \DirectoryIterator($dir);

        foreach ($directoryIterator as $subdirectory) {
            if ($subdirectory->isDir() && !$subdirectory->isDot()) {
                $subdirectories[] = $subdirectory->getFilename();
            }
        }

        return $subdirectories;
    }

    /**
     * Returns an array of the names of the files of the directory passed as param.
     *
     * @param string $dir
     *
     * @return array
     */
    public static function listFilesByParentFolder($dir)
    {
        $files = [];

        // Call the function to ensure the directory exists, if not, it tries to create it
        self::ensureDirectoryExists($dir);

        $directoryIterator = new \DirectoryIterator($dir);

        foreach ($directoryIterator as $file) {
            if ($file->isFile() && !$file->isDot()) {
                $files[] = $file->getFilename();
            }
        }

        return $files;
    }

    /**
     * Returns an array of the names of the files of the directory passed as param and all its subdirectories.
     *
     * @param string $dir
     *
     * @return array
     */
    public static function listAllFilesByParentFolder($dir)
    {
        $files = [];

        // Call the function to ensure the directory exists, if not, it tries to create it
        self::ensureDirectoryExists($dir);

        $ffs = scandir($dir);
        unset($ffs[array_search('.', $ffs, true)]);
        unset($ffs[array_search('..', $ffs, true)]);

        if (count($ffs) < 1) {
            return [];
        }

        foreach ($ffs as $ff) {
            $hasSeparator = DIRECTORY_SEPARATOR == substr($dir, -1);
            $pathToFile = $dir.($hasSeparator ? '' : DIRECTORY_SEPARATOR).$ff;
            if (is_dir($pathToFile)) {
                $childrenFiles = self::listAllFilesByParentFolder($pathToFile);
                $files = array_merge($files, $childrenFiles);
            } else {
                $files[] = $pathToFile;
            }
        }

        return $files;
    }

    /**
     * Returns an array of the names of the files of the directory passed as param and all its subdirectories.
     *
     * @param string $dir
     *
     * @return array
     */
    public static function listAllFilesAndDirsByParentFolder($dir)
    {
        $files = [];

        $ffs = scandir($dir);
        unset($ffs[array_search('.', $ffs, true)]);
        unset($ffs[array_search('..', $ffs, true)]);

        if (count($ffs) < 1) {
            return [];
        }

        foreach ($ffs as $ff) {
            $hasSeparator = DIRECTORY_SEPARATOR == substr($dir, -1);
            $pathToFile = $dir.($hasSeparator ? '' : DIRECTORY_SEPARATOR).$ff;
            if (is_dir($pathToFile)) {
                $childrenFiles = self::listAllFilesByParentFolder($pathToFile);
                if (empty($childrenFiles)) {
                    $files[] = $pathToFile;
                }
                $childrenFilesAndDir = self::listAllFilesAndDirsByParentFolder($pathToFile);
                $files = array_merge($files, $childrenFilesAndDir);
            } else {
                $files[] = $pathToFile;
            }
        }

        return $files;
    }

    /**
     * Returns an array of the names of the files that match pattern passed as param.
     *
     * @param string $dir
     * @param array  $patterns
     *
     * @return string[]
     */
    public static function listFilesByName($dir, $patterns, $depth = 0)
    {
        $result = [];

        // Call the function to ensure the directory exists, if not, it tries to create it
        self::ensureDirectoryExists($dir);

        $finder = Finder::create()
            ->in($dir)
            ->depth($depth)
            ->name($patterns)
            ->sortByName();

        $filesArray = iterator_to_array($finder, true);

        foreach ($filesArray as $file) {
            $result[] = $file->getPathName();
        }

        return $result;
    }

    /**
     * Returns the content of the file passed as param.
     *
     * @param string $filePathName
     *
     * @return string
     */
    public static function getFileContent($filePathName)
    {
        return file_get_contents($filePathName);
    }

    /**
     * Returns array with ode files, total disk space and left space on disk.
     *
     * @param object $odeFilesDto
     * @param bool   $includeAutosave
     *
     * @return array
     */
    public static function getOdeFilesDiskSpace($odeFilesDto, $includeAutosave)
    {
        // Calculate used space
        $usedSpace = 0;
        foreach ($odeFilesDto as $odeFileDto) {
            if (true == $includeAutosave) {
                $usedSpace += $odeFileDto->getSize();
            } else {
                $isManualSave = $odeFileDto->getIsManualSave();
                if (true == $isManualSave) {
                    $usedSpace += $odeFileDto->getSize();
                }
            }
        }

        $maxDiskSpace = SettingsUtil::getUserStorageMaxDiskSpaceInBytes();

        $freeSpace = $maxDiskSpace - $usedSpace;

        $decimals = 2;

        $responseData = [
            'odeFilesSync' => $odeFilesDto,
            'maxDiskSpace' => $maxDiskSpace, // bytes
            'maxDiskSpaceFormatted' => self::formatFilesize($maxDiskSpace, $decimals),
            'usedSpace' => $usedSpace, // bytes
            'usedSpaceFormatted' => self::formatFilesize($usedSpace, $decimals),
            'freeSpace' => $freeSpace, // bytes
            'freeSpaceFormatted' => self::formatFilesize($freeSpace, $decimals),
        ];

        return $responseData;
    }

    /**
     * Returns file size formatted to the most suitable size.
     *
     * @param int $bytes
     * @param int $decimals
     *
     * @return string
     */
    public static function formatFilesize($bytes, $decimals = 2)
    {
        $size = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        $factor = floor((strlen($bytes) - 1) / 3);

        $result = round($bytes / pow(1024, $factor), $decimals);

        return $result.' '.@$size[$factor];
    }

    /**
     * Opens for reading the file passed as param.
     *
     * @param string $filePathName
     *
     * @return resource
     */
    public static function openFileForRead($filePathName)
    {
        $file = fopen($filePathName, 'r');

        if (!$file) {
            exit('file does not exist or cannot be opened');
        }

        return $file;
    }

    /**
     * Opens for writing the file passed as param.
     *
     * @param string $filePathName
     *
     * @return resource
     */
    public static function openFileForWrite($filePathName)
    {
        $file = fopen($filePathName, 'w');

        if (!$file) {
            exit('file does not exist or cannot be opened');
        }

        return $file;
    }

    /**
     * Writes the text passed as parameter to the file passed as parameter.
     *
     * @param string $filePathName
     * @param string $text
     * @param bool   $append
     * @param bool   $loc_ex
     *
     * @return number
     */
    public static function writeToFile($filePathName, $text, $append, $loc_ex)
    {
        $flags = null;

        if ($append && $loc_ex) {
            $flags = FILE_APPEND | LOCK_EX;
        } elseif ($append) {
            $flags = FILE_APPEND;
        } elseif ($loc_ex) {
            $flags = LOCK_EX;
        }

        return file_put_contents($filePathName, $text, $flags);
    }

    /**
     * Reads an XLF file and returns an array of its values.
     *
     * @param string $filePath
     * @param string $locale
     *
     * @return array
     */
    public static function readXlfFile($filePath, $locale)
    {
        $loader = new XliffFileLoader();
        $catalogue = $loader->load($filePath, $locale);

        $translationsArray = [];

        foreach ($catalogue->all() as $domain => $messages) {
            foreach ($messages as $key => $value) {
                $translationsArray[$key] = $value;
            }
        }

        return $translationsArray;
    }

    /**
     * Creates the directory passed as param.
     *
     * @param string $dirPath
     * @param number $mode
     * @param bool   $recursive
     *
     * @return bool
     */
    public static function createDir($dirPath, $mode = 0775, $recursive = true)
    {
        if (!file_exists($dirPath)) {
            return mkdir($dirPath, $mode, $recursive);
        } else {
            return true;
        }
    }

    /**
     * Creates a dir structure defined in an array.
     *
     * @param string $dirBasePath
     * @param array  $dirStruc
     *
     * @return bool
     */
    public static function createDirStructureFromArray($dirBasePath, $dirStruc)
    {
        foreach ($dirStruc as $dirName => $subDirs) {
            $newDirPath = $dirBasePath.DIRECTORY_SEPARATOR.$dirName;

            try {
                self::createDir($newDirPath);
            } catch (\Exception $exception) {
                return false;
            }

            if ((!empty($subDirs)) && is_array($subDirs)) {
                self::createDirStructureFromArray($newDirPath, $subDirs);
            }
        }

        return true;
    }

    /**
     * Removes the directory passed as param and all its contents.
     *
     * @param string $dirPath
     *
     * @return bool
     */
    public static function removeDir($dirPath)
    {
        if (true === is_dir($dirPath)) {
            $files = array_diff(scandir($dirPath), ['.', '..']);

            foreach ($files as $file) {
                self::removeDir(realpath($dirPath).DIRECTORY_SEPARATOR.$file);
            }

            return rmdir($dirPath);
        } elseif (true === is_file($dirPath)) {
            return unlink($dirPath);
        }

        return false;
    }

    /**
     * Removes the content of directory passed as param.
     *
     * @param string $dirPath
     *
     * @return bool
     */
    public static function removeDirContent($dirPath)
    {
        if (true === is_dir($dirPath)) {
            $files = array_diff(scandir($dirPath), ['.', '..']);
            foreach ($files as $file) {
                self::removeDir(realpath($dirPath).DIRECTORY_SEPARATOR.$file);
            }
        }

        return false;
    }

    /**
     * Removes the file passed with path.
     *
     * @param string $filePath
     *
     * @return bool
     */
    public static function removeFile($filePath)
    {
        $filesystem = new Filesystem();

        try {
            $filesystem->remove($filePath);
        } catch (IOExceptionInterface $exception) {
            return false;
        }

        return true;
    }

    /**
     * Copies the directory passed as param and all of its subdirectories in destinationPath.
     *
     * @param string $sourcePath
     * @param string $destinationPath
     *
     * @return bool
     */
    public static function copyDir($sourcePath, $destinationPath)
    {
        $filesystem = new Filesystem();

        try {
            $filesystem->mirror($sourcePath, $destinationPath);
        } catch (IOExceptionInterface $exception) {
            return false;
        }

        return true;
    }

    /**
     * Copies the file passed as param in destinationPath.
     *
     * @param string $sourceFilePathName
     * @param string $destinationFilePathName
     *
     * @return bool
     */
    public static function copyFile($sourceFilePathName, $destinationFilePathName)
    {
        $filesystem = new Filesystem();

        try {
            $filesystem->copy($sourceFilePathName, $destinationFilePathName);
        } catch (IOExceptionInterface $exception) {
            return false;
        }

        return true;
    }

    /**
     * Returns mime type from file.
     *
     * @param string $filePathName
     *
     * @return string
     */
    public static function getFileMimeType($filePathName)
    {
        $mimeTypes = new MimeTypes();
        $mimeType = $mimeTypes->guessMimeType($filePathName);

        return $mimeType;
    }

    /**
     * Returns the path to an element according to the structure defined in the array.
     *
     * @param array  $dirStruc
     * @param string $dirName
     *
     * @return string|null
     */
    public static function getPathFromDirStructureArray($dirStruc, $dirName)
    {
        if (array_key_exists($dirName, $dirStruc)) {
            return $dirName.DIRECTORY_SEPARATOR;
        } else {
            foreach ($dirStruc as $key => $subarr) {
                if (is_array($subarr)) {
                    $result = self::getPathFromDirStructureArray($subarr, $dirName);

                    if (!empty($result)) {
                        $result = $key.DIRECTORY_SEPARATOR.$result;

                        return $result;
                    }
                }
            }
        }

        return null;
    }

    /**
     * Creates a zip file with the dir sourcepath.
     *
     * @param string $sourcePath
     * @param string $sourcePath
     *
     * @return bool
     */
    public static function zipDir($sourcePath, $outZipPath)
    {
        $pathInfo = pathinfo($sourcePath);
        $parentPath = $pathInfo['dirname'];
        $dirName = $pathInfo['basename'];

        $z = new \ZipArchive();
        $z->open($outZipPath, \ZipArchive::CREATE);
        // $z->addEmptyDir($dirName);
        if ($sourcePath == $dirName) {
            self::dirToZip($sourcePath, $z, 0);
        } else {
            self::dirToZip($sourcePath, $z, strlen("$sourcePath/"));
        }
        $z->close();

        return true;
    }

    /**
     * Examines dir to add to zip.
     *
     * @param string $folder
     * @param string $exclusiveLength
     */
    private static function dirToZip($folder, &$zipFile, $exclusiveLength)
    {
        $handle = opendir($folder);
        while (false !== $f = readdir($handle)) {
            // Check for local/parent path or zipping file itself and skip
            if ('.' != $f && '..' != $f && $f != basename(__FILE__)) {
                $filePath = "$folder/$f";
                // Remove prefix from file path before add to zip
                $localPath = substr($filePath, $exclusiveLength);
                if (is_file($filePath)) {
                    $zipFile->addFile($filePath, $localPath);
                } elseif (is_dir($filePath)) {
                    // Add sub-directory
                    $zipFile->addEmptyDir($localPath);
                    self::dirToZip($filePath, $zipFile, $exclusiveLength);
                }
            }
        }
        closedir($handle);
    }

    /**
     * Extract zip into dir.
     *
     * @param string $zipFile
     * @param string $dir
     *
     * @return void
     */
    public static function extractZipTo($zipFile, $dir)
    {
        $zip = new \ZipArchive();
        $zip->open($zipFile);
        $zip->extractTo($dir);
        $zip->close();
    }

    /**
     * Returns date dir structure from identifier in "20201018103234EWHDKF" format passed as param.
     *
     * @param string $identifier
     *
     * @return string
     */
    public static function getDateDirStructureFromIdentifier($identifier)
    {
        $year = substr($identifier, 0, 4);
        $month = substr($identifier, 4, 2);
        $day = substr($identifier, 6, 2);

        $dateDirStructure = $year.DIRECTORY_SEPARATOR.$month.DIRECTORY_SEPARATOR.$day.DIRECTORY_SEPARATOR;

        return $dateDirStructure;
    }

    /**
     * Returns the size of a file.
     *
     * @param string $filePath
     *
     * @return int
     */
    public static function getFileSize($filePath)
    {
        return filesize($filePath);
    }

    /**
     * Check mime type by Base64.
     *
     * @param string $base64
     *
     * @return int|false $isAllowedFile
     */
    public static function checkMimeTypeBase64($base64)
    {
        // Check allowed mimeTypes
        $allowedMimeTypes = Settings::ALLOWED_MIME_TYPES;
        foreach ($allowedMimeTypes as $allowedMimeType) {
            $isAllowedFile = preg_match('('.$allowedMimeType.')', $base64);
            if ($isAllowedFile) {
                break;
            }
        }

        return $isAllowedFile;
    }

    /**
     * Check mime type by file.
     *
     * @param object $file
     *
     * @return bool
     */
    public static function checkMimeTypeFile($file)
    {
        // Check allowed mimeTypes
        $mimeType = $file->getMimeType();
        $allowedMimeTypes = Settings::ALLOWED_MIME_TYPES;
        if (!in_array($mimeType, $allowedMimeTypes)) {
            return false;
        } else {
            return true;
        }
    }

    /**
     * Check filesize.
     *
     * @param string $filesize
     *
     * @return bool
     */
    public static function checkFileSize($filesize)
    {
        $maxUploadSize = SettingsUtil::getFileMaxUploadSizeInBytes();
        if ($filesize <= $maxUploadSize) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * Ensures the given directory exists, creating it if necessary.
     * If the directory cannot be created, an exception is thrown.
     *
     * @param string $dir path of the directory to check or create
     *
     * @throws \Exception if the directory cannot be created
     */
    public static function ensureDirectoryExists($dir)
    {
        if (!is_dir($dir)) {
            if (!mkdir($dir, 0777, true) && !is_dir($dir)) {
                throw new \RuntimeException('Unable to create directory: '.$dir);
            }
        }
    }
}
