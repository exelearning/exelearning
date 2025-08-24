<?php

namespace App\Tests\Unit\Util\net\exelearning\Util;

use App\Util\net\exelearning\Util\FileUtil;
use PHPUnit\Framework\TestCase;

class FileUtilTest extends TestCase
{
    private $testDir;

    protected function setUp(): void
    {
        $this->testDir = sys_get_temp_dir() . '/file_util_test';
        if (!is_dir($this->testDir)) {
            mkdir($this->testDir, 0777, true);
        }
    }

    protected function tearDown(): void
    {
        if (is_dir($this->testDir)) {
            FileUtil::removeDir($this->testDir);
        }
    }

    public function test_formatFilesize()
    {
        $this->assertEquals('1 KB', FileUtil::formatFilesize(1024));
        $this->assertEquals('1 MB', FileUtil::formatFilesize(1024 * 1024));
        $this->assertEquals('1.5 KB', FileUtil::formatFilesize(1536));
    }

    public function test_getDateDirStructureFromIdentifier()
    {
        $identifier = '20201018103234EWHDKF';
        $expected = '2020' . DIRECTORY_SEPARATOR . '10' . DIRECTORY_SEPARATOR . '18' . DIRECTORY_SEPARATOR;
        $this->assertEquals($expected, FileUtil::getDateDirStructureFromIdentifier($identifier));
    }

    public function test_listSubdirsAndFiles()
    {
        $subDir1 = $this->testDir . '/subdir1';
        $subDir2 = $this->testDir . '/subdir2';
        mkdir($subDir1);
        mkdir($subDir2);

        $file1 = $this->testDir . '/file1.txt';
        $file2 = $this->testDir . '/file2.txt';
        file_put_contents($file1, 'test1');
        file_put_contents($file2, 'test2');

        $expectedSubdirs = ['subdir1', 'subdir2'];
        $actualSubdirs = FileUtil::listSubdirs($this->testDir);
        sort($expectedSubdirs);
        sort($actualSubdirs);
        $this->assertEquals($expectedSubdirs, $actualSubdirs);

        $expectedFiles = ['file1.txt', 'file2.txt'];
        $actualFiles = FileUtil::listFilesByParentFolder($this->testDir);
        sort($expectedFiles);
        sort($actualFiles);
        $this->assertEquals($expectedFiles, $actualFiles);
    }

    public function test_createAndRemoveDir()
    {
        $newDir = $this->testDir . '/newdir';
        $this->assertTrue(FileUtil::createDir($newDir));
        $this->assertTrue(is_dir($newDir));
        $this->assertTrue(FileUtil::removeDir($newDir));
        $this->assertFalse(is_dir($newDir));
    }
}
