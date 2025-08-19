<?php

namespace App\Tests\Unit\Util\net\exelearning\Util;

use App\Util\net\exelearning\Util\DateUtil;
use PHPUnit\Framework\TestCase;

class DateUtilTest extends TestCase
{
    public function test_getSecondsDateInterval()
    {
        $seconds = 10;
        $interval = DateUtil::getSecondsDateInterval($seconds);
        $this->assertInstanceOf(\DateInterval::class, $interval);
        $this->assertEquals($seconds, $interval->s);
    }
}
