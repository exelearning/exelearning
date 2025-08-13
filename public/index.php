<?php

use App\Kernel;
use Doctrine\Deprecations\Deprecation;

require_once dirname(__DIR__) . '/vendor/autoload_runtime.php';

return function (array $context) {
    // Ignore Doctrine ORM proxy autoloader deprecation on PHP >= 8.4
    // Ref: https://github.com/doctrine/orm/pull/12005
    if (class_exists(Deprecation::class)) {
        Deprecation::ignoreDeprecations('https://github.com/doctrine/orm/pull/12005');
    }

    return new Kernel($context['APP_ENV'], (bool) $context['APP_DEBUG']);
};
