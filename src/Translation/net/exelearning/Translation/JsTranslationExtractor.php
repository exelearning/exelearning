<?php

namespace App\Translation\net\exelearning\Translation;

use App\Constants;
use Symfony\Component\Translation\Extractor\ExtractorInterface;
use Symfony\Component\Translation\MessageCatalogue;

class JsTranslationExtractor implements ExtractorInterface
{
    private $prefix = '';

    private $projectDir;

    public function __construct(string $projectDir)
    {
        $this->projectDir = $projectDir;
    }

    /**
     * Sets a prefix to be added to each extracted message.
     */
    public function setPrefix(string $prefix): void
    {
        $this->prefix = $prefix;
    }

    /**
     * Extracts translation messages from JavaScript files in the given directory.
     */
    public function extract($directory, MessageCatalogue $catalogue): void
    {
        // Search for .js files recursively in the directory
        $files = $this->findJsFiles($directory);

        // Extract messages from each .js file found
        foreach ($files as $file) {
            if (!in_array($file, Constants::TRANSLATION_EXCEPTIONS)) {
                $this->extractMessagesFromJs($file, $catalogue);
            }
        }
    }

    /**
     * Finds all .js files in the public directory.
     */
    private function findJsFiles(): array
    {
        $jsDirectory = $this->projectDir.'/public';

        if (!is_dir($jsDirectory)) {
            throw new \RuntimeException('Directory not found or not accessible: '.$jsDirectory);
        }

        // Create a recursive iterator to traverse all .js files
        $rii = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($jsDirectory));

        $files = [];

        foreach ($rii as $file) {
            if ($file->isFile() && 'js' === pathinfo($file->getFilename(), PATHINFO_EXTENSION)) {
                $files[] = $file->getPathname();
            }
        }

        return $files;
    }

    /**
     * Extracts translation messages from a single .js file and adds them to the catalogue.
     */
    private function extractMessagesFromJs(string $file, MessageCatalogue $catalogue): void
    {
        // Read the contents of the .js file
        $content = file_get_contents($file);

        // Regular expressions to find translatable strings using different types of quotes
        $translationRegex = [
            // Double quotes
            '/\b(?:_|c_)\s*\(\s*"((?:[^"\\\\]|\\\\.)*)"\s*\)\s*,?/s',

            // Single quotes
            '/\b(?:_|c_)\s*\(\s*\'((?:[^\'\\\\]|\\\\.)*)\'\s*\)\s*,?/s',

            // Backticks
            '/\b(?:_|c_)\s*\(\s*`((?:[^`\\\\]|\\\\.)*)`\s*\)\s*,?/s',
        ];

        // Iterate over the regular expressions and find translatable strings
        foreach ($translationRegex as $regex) {
            preg_match_all($regex, $content, $matches);

            // Add the found messages to the translation catalogue
            foreach ($matches[1] as $message) {
                $catalogue->set($message, $this->prefix.$message);
            }
        }
    }
}
