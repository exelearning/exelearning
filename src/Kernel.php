<?php

// src/Kernel.php

namespace App;

use App\Util\net\exelearning\Util\SettingsUtil;
use Symfony\Bundle\FrameworkBundle\Kernel\MicroKernelTrait;
use Symfony\Component\HttpKernel\Kernel as BaseKernel;

class Kernel extends BaseKernel
{
    use MicroKernelTrait;

    protected function initializeContainer(): void
    {
        parent::initializeContainer();
        // Make sure the container is available for SettingsUtil
        SettingsUtil::setContainer($this->getContainer());
    }

    /**
     * Explicitly define the project root directory.
     *
     * This prevents rare mis-detection scenarios (e.g. when composer.json
     * isn't visible during certain exec contexts) that could make Symfony
     * treat "src" as the project root and write caches under "src/var".
     */
    public function getProjectDir(): string
    {
        return \dirname(__DIR__);
    }

    /**
     * Use host-provided writable cache dir (e.g. ~/.config/exelearning/cache).
     */
    public function getCacheDir(): string
    {
        $dir = $_ENV['CACHE_DIR'] ?? $_SERVER['CACHE_DIR'] ?? null;

        return $dir ? rtrim($dir, '/\\') : parent::getCacheDir();
    }

    /**
     * Use host-provided writable logs dir (e.g. ~/.config/exelearning/log).
     */
    public function getLogDir(): string
    {
        $dir = $_ENV['LOG_DIR'] ?? $_SERVER['LOG_DIR'] ?? null;

        return $dir ? rtrim($dir, '/\\') : parent::getLogDir();
    }
}
