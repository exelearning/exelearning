<?php

namespace App\Tests\Unit\Util\net\exelearning\Util;

use App\Util\net\exelearning\Util\FilePermissionsUtil;
use PHPUnit\Framework\TestCase;

class FilePermissionsUtilTest extends TestCase
{
    private $testDir;
    private $testFile;

    protected function setUp(): void
    {
        $this->testDir = sys_get_temp_dir()
            . '/test_dir_' . bin2hex(random_bytes(6)); // unique name
        mkdir($this->testDir, 0777, true);

        $this->testFile = $this->testDir . '/test_file.txt';
        file_put_contents($this->testFile, 'test');
    }

    protected function tearDown(): void
    {
        if (file_exists($this->testFile)) {
            unlink($this->testFile);
        }
        if (is_dir($this->testDir)) {
            rmdir($this->testDir);
        }
    }

    public function test_isWritable()
    {
        $this->assertTrue(FilePermissionsUtil::isWritable($this->testDir));
        $this->assertTrue(FilePermissionsUtil::isWritable($this->testFile));
    }

    public function test_isReadable()
    {
        $this->assertTrue(FilePermissionsUtil::isReadable($this->testFile));
    }
}
