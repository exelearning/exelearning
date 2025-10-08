<?php
namespace App\Tests\E2E\Utils;

use Facebook\WebDriver\Remote\LocalFileDetector;
use Facebook\WebDriver\WebDriverBy;
use Symfony\Component\Panther\Client;

/**
 * Utility class for handling file uploads in E2E tests.
 */
class FileUploadTestUtils
{
    /**
     * Uploads a file using a CSS selector.
     *
     * @param Client $client The Panther client
     * @param string $fileInputSelector CSS selector for the file input element
     * @param string $filePath Absolute path to the file to upload
     * @return void
     */
    public static function uploadFile(Client $client, string $fileInputSelector, string $filePath): void
    {
        TestLogger::debug("Uploading file: $filePath using selector: $fileInputSelector");
        
        try {
            // Find the file input element
            $fileInput = $client->findElement(WebDriverBy::cssSelector($fileInputSelector));
            
            // Set the file detector and send the file path
            $fileInput->setFileDetector(new LocalFileDetector());
            $fileInput->sendKeys($filePath);
            
            TestLogger::debug("File upload successful");
        } catch (\Exception $e) {
            TestLogger::error("File upload failed: " . $e->getMessage());
            throw $e;
        }
    }
    
    /**
     * Uploads a file by making a file input visible first (for hidden inputs).
     *
     * @param Client $client The Panther client
     * @param string $fileInputSelector CSS selector for the file input element
     * @param string $filePath Absolute path to the file to upload
     * @return void
     */
    public static function uploadFileToHiddenInput(Client $client, string $fileInputSelector, string $filePath): void
    {
        TestLogger::debug("Uploading file to hidden input: $filePath using selector: $fileInputSelector");
        
        try {
            // Make the file input visible using JavaScript
            $client->executeScript(
                "document.querySelector('$fileInputSelector').style.opacity = 1;" .
                "document.querySelector('$fileInputSelector').style.display = 'block';" .
                "document.querySelector('$fileInputSelector').style.visibility = 'visible';"
            );
            
            // Now upload the file
            self::uploadFile($client, $fileInputSelector, $filePath);
        } catch (\Exception $e) {
            TestLogger::error("Hidden input file upload failed: " . $e->getMessage());
            throw $e;
        }
    }
    
    /**
     * Creates a test file with the given content in the system temp directory.
     *
     * @param string $filename Name of the file to create
     * @param string $content Content to write to the file
     * @return string Absolute path to the created file
     */
    public static function createTestFile(string $filename, string $content = 'Test file content'): string
    {
        $tempDir = sys_get_temp_dir() . '/e2e_test_files';
        
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0777, true);
        }
        
        $filePath = $tempDir . '/' . $filename;
        file_put_contents($filePath, $content);
        
        TestLogger::debug("Created test file at: $filePath");
        
        return $filePath;
    }
    
    /**
     * Prepares and uploads a predefined test file.
     *
     * @param Client $client The Panther client
     * @param string $fileInputSelector CSS selector for the file input element
     * @param string $fileExtension The extension of the file to create (e.g., 'txt', 'csv')
     * @param string $content Optional content for the file
     * @return string The path to the created file
     */
    public static function prepareAndUploadTestFile(
        Client $client, 
        string $fileInputSelector, 
        string $fileExtension = 'txt',
        string $content = 'Test file content'
    ): string {
        $filename = 'test_file_' . uniqid() . '.' . $fileExtension;
        $filePath = self::createTestFile($filename, $content);
        
        self::uploadFile($client, $fileInputSelector, $filePath);
        
        return $filePath;
    }
    
    /**
     * Uploads a fixture file from the tests/Fixtures directory.
     *
     * @param Client $client The Panther client
     * @param string $fileInputSelector CSS selector for the file input element
     * @param string $fixtureFilename Name of the fixture file (must exist in tests/Fixtures)
     * @return string The absolute path to the fixture file
     */
    public static function uploadFixtureFile(Client $client, string $fileInputSelector, string $fixtureFilename): string
    {
        // The path to the fixtures directory from the container's perspective
        $fixtureDir = '/app/tests/Fixtures';
        $filePath = $fixtureDir . '/' . $fixtureFilename;
        
        TestLogger::debug("Uploading fixture file: $filePath");
        
        // Verify the file exists
        if (!file_exists($filePath)) {
            TestLogger::error("Fixture file not found: $filePath");
            throw new \RuntimeException("Fixture file not found: $filePath");
        }
        
        self::uploadFile($client, $fileInputSelector, $filePath);
        
        return $filePath;
    }
}