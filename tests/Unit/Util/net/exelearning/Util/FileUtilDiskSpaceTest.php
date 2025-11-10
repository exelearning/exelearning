<?php

namespace App\Tests\Unit\Util\net\exelearning\Util;

use App\Util\net\exelearning\Util\FileUtil;
use App\Util\net\exelearning\Util\SettingsUtil;
use PHPUnit\Framework\Attributes\CoversClass;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

#[CoversClass(FileUtil::class)]
final class FileUtilDiskSpaceTest extends KernelTestCase
{
    protected function setUp(): void
    {
        self::bootKernel();
    }

    protected function tearDown(): void
    {
        parent::tearDown();
        static::ensureKernelShutdown();
    }

    public function testUserStorageMaxDiskSpaceIsRespected(): void
    {
        $diskSpaceBytes = SettingsUtil::getUserStorageMaxDiskSpaceInBytes();
        $maxDiskSpaceMB = self::getContainer()->getParameter('app.user_storage_max_disk_space');
        $expected = $maxDiskSpaceMB * 1024 * 1024;
        self::assertSame($expected, $diskSpaceBytes);

        $dummyFile = new class() {
            public function getSize(): int
            {
                return 128;
            }

            public function getIsManualSave(): bool
            {
                return true;
            }
        };

        $result = FileUtil::getOdeFilesDiskSpace([$dummyFile], true);

        self::assertSame($expected, $result['maxDiskSpace']);
        self::assertSame($diskSpaceBytes - 128, $result['freeSpace']);
    }
}
