<?php

namespace App\Tests\Unit\Util\net\exelearning\Util;

use App\Util\net\exelearning\Util\Util;
use PHPUnit\Framework\TestCase;

class UtilTest extends TestCase
{
    public function test_generateId()
    {
        $id = Util::generateId();
        $this->assertIsString($id);
        $this->assertEquals(20, strlen($id));
        $this->assertMatchesRegularExpression('/^\d{14}[A-Z]{6}$/', $id);
    }

    public function test_generateIdCheckUnique()
    {
        $existingIds = ['20201018103234EWHDKF'];
        $newId = Util::generateIdCheckUnique($existingIds);
        $this->assertIsString($newId);
        $this->assertNotContains($newId, $existingIds);
    }

    public function test_generateRandomStr()
    {
        $randomStr = Util::generateRandomStr(10);
        $this->assertIsString($randomStr);
        $this->assertEquals(10, strlen($randomStr));
        $this->assertMatchesRegularExpression('/^[A-Z]{10}$/', $randomStr);
    }

    public function test_checkPhpZipExtension()
    {
        if (extension_loaded('zip')) {
            $this->assertTrue(Util::checkPhpZipExtension());
        } else {
            $this->markTestSkipped('zip extension not loaded.');
        }
    }

    public function test_checkPhpGdExtension()
    {
        if (extension_loaded('gd')) {
            $this->assertTrue(Util::checkPhpGdExtension());
        } else {
            $this->markTestSkipped('gd extension not loaded.');
        }
    }
}
