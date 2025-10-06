<?php

namespace App\Tests\Unit\Util\net\exelearning\Util;

use App\Util\net\exelearning\Util\UrlUtil;
use App\Constants;
use PHPUnit\Framework\TestCase;

class UrlUtilTest extends TestCase
{
    public function test_getTemporaryContentStorageUrl()
    {
        $expectedUrl = Constants::FILES_DIR_NAME . Constants::SLASH . Constants::TEMPORARY_CONTENT_STORAGE_DIRECTORY;
        $this->assertEquals($expectedUrl, UrlUtil::getTemporaryContentStorageUrl());
    }
}
