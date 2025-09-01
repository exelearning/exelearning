<?php

namespace App\Tests\Command;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Warning;
use PHPUnit\Framework\AssertionFailedError;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Filesystem\Filesystem;
use App\Command\net\exelearning\Command\ElpExportCommand;

class ElpExportCommandTest extends KernelTestCase
{
    private CommandTester $commandTester;
    private Filesystem $filesystem;
    private array $tempPaths = [];

    protected function setUp(): void
    {
        self::bootKernel();

        $container = static::getContainer();
        $this->filesystem = new Filesystem();

        // Get the command service directly and test it without attaching to Application
        $command = $container->get(ElpExportCommand::class);
        $this->commandTester = new CommandTester($command);
    }

    #[DataProvider('elpFormatProvider')]
    #[Group('slow')]
    public function testExportAllFormats(string $fixtureFilename, string $format): void
    {
        $inputFile = realpath(__DIR__ . '/../Fixtures/' . $fixtureFilename);
        $outputDir = sys_get_temp_dir() . '/elp_export_' . $format . '_' . uniqid();
        mkdir($outputDir, 0755, true);
        $this->tempPaths[] = $outputDir;

        $this->assertFileExists($inputFile, "Missing input file: $inputFile");

        try {
            $this->commandTester->execute([
                'input'   => $inputFile,
                'output'  => $outputDir,
                'format'  => $format,
                '--debug' => true,
            ]);

            $status = $this->commandTester->getStatusCode();
            $this->assertSame(0, $status, "Unexpected exit code for format: $format");

            $this->assertDirectoryExists($outputDir, "Output directory does not exist for format: $format");
            $this->assertNotEmpty(
                glob("$outputDir/*"),
                "Output directory for $format should not be empty"
            );
        } catch (AssertionFailedError | Warning $e) {
            printf(
                "\n[TEST FAILURE] Format: %s | File: %s | Output: %s\n",
                $format,
                basename($inputFile),
                $outputDir
            );
            printf(
                "[%s] %s in %s:%d\n",
                get_class($e),
                $e->getMessage(),
                $e->getFile(),
                $e->getLine()
            );
            printf("[Command Output]\n%s\n", $this->commandTester->getDisplay());
            throw $e;
        }
    }

    public static function elpFormatProvider(): array
    {
        $elpFiles = [
            'basic-example.elp',                  //   85K
            // 'encoding_test.elp',               //  477K
            // 'old_elp_modelocrea.elp',          //  4,2M
            // 'old_elp_nebrija.elp',             //  7,6M
            'old_elp_poder_conexiones.elp',       //  5,1M
            // 'old_manual_exe29_compressed.elp', // 10,0M
        ];

        $formats = [
            'html5',
            'html5-sp',
            'scorm12',
            'scorm2004',
            'ims',
            'epub3',
            'elp',
        ];

        $combinations = [];
        foreach ($elpFiles as $file) {
            foreach ($formats as $format) {
                $combinations[] = [$file, $format];
            }
        }

        return $combinations;
    }

    public function testFailsWithInvalidFile(): void
    {
        $tempInvalid = tempnam(sys_get_temp_dir(), 'invalid_elp_');
        file_put_contents($tempInvalid, 'not a valid ELP');
        $this->tempPaths[] = $tempInvalid;

        $outputDir = sys_get_temp_dir() . '/elp_export_invalid_' . uniqid();
        mkdir($outputDir, 0755, true);
        $this->tempPaths[] = $outputDir;

        $this->assertFileExists($tempInvalid);

        try {
            $this->commandTester->execute([
                'input'   => $tempInvalid,
                'output'  => $outputDir,
                '--debug' => true,
            ]);

            $status = $this->commandTester->getStatusCode();
            $this->assertSame(1, $status, 'Expected exit code 1 for invalid file');
            $this->assertStringContainsString('Invalid ELP file', $this->commandTester->getDisplay());
            $this->assertFileDoesNotExist("$outputDir/index.html");
        } catch (AssertionFailedError | Warning $e) {
            printf(
                "\n[TEST FAILURE] Invalid file test | File: %s | Output: %s\n",
                basename($tempInvalid),
                $outputDir
            );
            printf(
                "[%s] %s in %s:%d\n",
                get_class($e),
                $e->getMessage(),
                $e->getFile(),
                $e->getLine()
            );
            printf("[Command Output]\n%s\n", $this->commandTester->getDisplay());
            throw $e;
        }
    }

    protected function tearDown(): void
    {
        foreach ($this->tempPaths as $path) {
            if ($this->filesystem->exists($path)) {
                $this->filesystem->remove($path);
            }
        }
    }
}
