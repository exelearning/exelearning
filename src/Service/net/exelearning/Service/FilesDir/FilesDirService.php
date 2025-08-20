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
        $this->checkFile = $this->filesDir.Constants::FILE_CHECKED_FILENAME.'-'.Constants::APP_VERSION;
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
        return file_exists($this->checkFile);
    }

    /**
     * Undocumented function.
     *
     * @return void
     */
    public function addCheck()
    {
        if (FilePermissionsUtil::isWritable($this->filesDir)) {
            // Remove old checked files
            $files = scandir($this->filesDir);
            foreach ($files as $file) {
                $filePath = $this->filesDir.DIRECTORY_SEPARATOR.$file;
                if (is_file($filePath) && 0 === strpos($file, Constants::FILE_CHECKED_FILENAME)) {
                    unlink($filePath);
                }
            }
            // Add new checked file
            $file = fopen($this->checkFile, 'w');
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
            FileUtil::removeDir($this->fileHelper->getIdevicesBaseDir());
            FileUtil::removeDir($this->fileHelper->getThemesBaseDir());
            $copied = FileUtil::copyDir(
                $this->fileHelper->getSymfonyFilesDir(),
                $this->fileHelper->getFilesDir()
            );
        } catch (\Exception $e) {
            $copied = false;
        }

        return $copied;
    }
}
