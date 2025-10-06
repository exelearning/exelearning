<?php

namespace App\Tests\Unit\Util\net\exelearning\Util;

use App\Util\net\exelearning\Util\OdeXmlUtil;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

class OdeXmlUtilTest extends TestCase
{
    public function test_prepareText()
    {
        $class = new ReflectionClass(OdeXmlUtil::class);
        $method = $class->getMethod('prepareText');
        $method->setAccessible(true);

        $text = '<p>This is a test</p>';
        $expected = '&lt;p&gt;This is a test&lt;/p&gt;';
        $this->assertEquals($expected, $method->invoke(null, $text));

        $text = 'This has "quotes" & ampersands';
        $expected = 'This has &quot;quotes&quot; &amp; ampersands';
        $this->assertEquals($expected, $method->invoke(null, $text));
    }
}
