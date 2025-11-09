<?php

namespace App\Service\Archive;

use ZipArchive;

/**
 * Creates ZIP archives from directories using ZipArchive.
 */
class ZipArchiver
{
    /**
     * Create a ZIP file from a directory.
     *
     * @param string $sourceDir absolute path to directory
     * @param string $targetZip absolute path to target ZIP
     *
     * @throws \RuntimeException on failure
     */
    public function createFromDirectory(string $sourceDir, string $targetZip): void
    {
        if (!is_dir($sourceDir)) {
            throw new \RuntimeException('Source directory not found: '.$sourceDir);
        }

        $zip = new \ZipArchive();
        if (true !== $zip->open($targetZip, \ZipArchive::CREATE | \ZipArchive::OVERWRITE)) {
            throw new \RuntimeException('Unable to open ZIP file for writing: '.$targetZip);
        }

        $files = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($sourceDir, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($files as $file) {
            $filePath = (string) $file;
            $localName = ltrim(str_replace($sourceDir, '', $filePath), DIRECTORY_SEPARATOR);
            if (is_dir($filePath)) {
                $zip->addEmptyDir($localName);
            } elseif (is_file($filePath)) {
                if (!$zip->addFile($filePath, $localName)) {
                    $zip->close();
                    throw new \RuntimeException('Failed to add file to ZIP: '.$localName);
                }
            }
        }

        if (!$zip->close()) {
            throw new \RuntimeException('Failed to finalize ZIP archive: '.$targetZip);
        }
    }
}
