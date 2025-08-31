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
}
