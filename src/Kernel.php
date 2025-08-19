<?php

// src/Kernel.php

namespace App;

use App\Util\net\exelearning\Util\SettingsUtil;
use Symfony\Bundle\FrameworkBundle\Kernel\MicroKernelTrait;
use Symfony\Component\Filesystem\Filesystem;
use Symfony\Component\HttpKernel\Kernel as BaseKernel;

class Kernel extends BaseKernel
{
    use MicroKernelTrait;

    // Override the cache directory using the CACHE_DIR environment variable
    public function getCacheDir(): string
    {
        // Check if the CACHE_DIR variable exists and is not empty
        $cacheDir = !empty($_ENV['CACHE_DIR']) ? $_ENV['CACHE_DIR'] : parent::getCacheDir();

        // Check if the directory exists, if not, create it
        $filesystem = new Filesystem();
        if (!$filesystem->exists($cacheDir)) {
            $filesystem->mkdir($cacheDir, 0755); // Create the directory with appropriate permissions
        }

        return $cacheDir;
    }

    // Override the log directory using the LOG_DIR environment variable
    public function getLogDir(): string
    {
        // Check if the LOG_DIR variable exists and is not empty
        $logDir = !empty($_ENV['LOG_DIR']) ? $_ENV['LOG_DIR'] : parent::getLogDir();

        // Check if the directory exists, if not, create it
        $filesystem = new Filesystem();
        if (!$filesystem->exists($logDir)) {
            $filesystem->mkdir($logDir, 0755); // Create the directory with appropriate permissions
        }

        return $logDir;
    }

    protected function initializeContainer(): void
    {
        parent::initializeContainer();

        // Make sure the container is available for SettingsUtil
        SettingsUtil::setContainer($this->getContainer());
    }
}
