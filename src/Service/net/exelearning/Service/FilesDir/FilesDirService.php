<?php

namespace App\Service\net\exelearning\Service\FilesDir;

use App\Constants;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Util\net\exelearning\Util\FilePermissionsUtil;
use App\Util\net\exelearning\Util\FileUtil;
use Symfony\Contracts\Translation\TranslatorInterface;

class FilesDirService implements FilesDirServiceInterface
{
    private FileHelper $fileHelper;
    private string $filesDir;
    private string $checkFile;
    private TranslatorInterface $translator;

    public function __construct(
        FileHelper $fileHelper,
        TranslatorInterface $translator,
    ) {
        $this->fileHelper = $fileHelper;
        $this->filesDir = $this->fileHelper->getFilesDir();
        $this->checkFile = $this->filesDir.Constants::FILE_CHECKED_FILENAME.Constants::FILE_CHECKED_VERSION;
        $this->translator = $translator;
    }

    /**
     * Undocumented function.
     *
     * @return void
     */
    public function checkFilesDir()
    {
        $data = ['checked' => true];

        if (FilePermissionsUtil::isWritable($this->filesDir)) {
            if (!$this->isChecked()) {
                $isStructure = $this->copyFilesDirStructure();
                if ($isStructure) {
                    // The directory structure has been created successfully
                    $data['info'] = $this->translator->trans('FILES_DIR directory structure generated');
                    $this->addCheck();
                } else {
                    // The FILES_DIR directory has write permissions, but the structure could not be copied correctly
                    $data['checked'] = false;
                    $errorMsg01 = $this->translator->trans('Failed to generate FILES_DIR structure in %s.', ['%s' => $this->filesDir]);
                    $errorMsg02 = $this->translator->trans('- Check that both the directory and the subdirectories inside it have the correct permissions.');
                    $errorMsg03 = $this->translator->trans('- Check that the symfony/public/files/ directory exists in your project and has the correct permissions.');
                    $data['info'] = [$errorMsg01, $errorMsg02, $errorMsg03];
                }
            }
        } else {
            $data['checked'] = false;
            if (file_exists($this->filesDir)) {
                // The FILES_DIR directory does not have write permissions
                $data['info'] = $this->translator->trans('The FILES_DIR directory does not have write permissions');
            } else {
                // FILES_DIR directory does not exist
                $data['info'] = $this->translator->trans('The FILES_DIR directory does not exists');
            }
        }

        return $data;
    }

    /**
     * Undocumented function.
     *
     * @return bool
     */
    public function isChecked()
    {
        // Compute dynamically to avoid any stale path reference
        $checkPath = $this->fileHelper->getFilesDir().Constants::FILE_CHECKED_FILENAME.'-'.Constants::APP_VERSION;

        return file_exists($checkPath);
    }

    /**
     * Undocumented function.
     *
     * @return void
     */
    public function addCheck()
    {
        $filesDir = $this->fileHelper->getFilesDir();
        if (FilePermissionsUtil::isWritable($filesDir)) {
            // Remove old checked files
            $files = scandir($filesDir);
            foreach ($files as $file) {
                $filePath = $filesDir.DIRECTORY_SEPARATOR.$file;
                if (is_file($filePath) && 0 === strpos($file, Constants::FILE_CHECKED_FILENAME)) {
                    unlink($filePath);
                }
            }
            // Add new checked file
            $checkPath = $filesDir.Constants::FILE_CHECKED_FILENAME.'-'.Constants::APP_VERSION;
            $file = fopen($checkPath, 'w');
            fclose($file);
        }
    }

    /**
     * Undocumented function.
     *
     * @return void
     */
    public function copyFilesDirStructure()
    {
        $copied = false;

        try {
            // Remove base dirs to ensure stale files are cleaned
            FileUtil::removeDir($this->fileHelper->getIdevicesBaseDir());
            FileUtil::removeDir($this->fileHelper->getThemesBaseDir());

            // Proactively sync base subfolders with delete => true to guarantee
            // stale files are removed even if removal above is skipped by the FS.
            $symfonyFilesDir = $this->fileHelper->getSymfonyFilesDir();

            $symfonyIdevicesBase = $symfonyFilesDir.Constants::PERMANENT_CONTENT_STORAGE_DIRECTORY.DIRECTORY_SEPARATOR.
                Constants::IDEVICES_DIR_NAME.DIRECTORY_SEPARATOR.
                Constants::IDEVICES_BASE_DIR_NAME;
            FileUtil::copyDir($symfonyIdevicesBase, $this->fileHelper->getIdevicesBaseDir(), ['delete' => true]);

            $symfonyThemesBase = $symfonyFilesDir.Constants::PERMANENT_CONTENT_STORAGE_DIRECTORY.DIRECTORY_SEPARATOR.
                Constants::THEMES_DIR_NAME.DIRECTORY_SEPARATOR.
                Constants::THEMES_BASE_DIR_NAME;
            FileUtil::copyDir($symfonyThemesBase, $this->fileHelper->getThemesBaseDir(), ['delete' => true]);

            // Then perform a general copy for the rest, preserving user content
            $copied = FileUtil::copyDir($symfonyFilesDir, $this->fileHelper->getFilesDir());
        } catch (\Exception $e) {
            $copied = false;
        }

        return $copied;
    }
}
