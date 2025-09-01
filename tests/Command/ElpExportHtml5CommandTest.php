<?php

namespace App\Tests\Command;

use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Filesystem\Filesystem;
use App\Command\net\exelearning\Command\ElpExportHtml5Command;
use PHPUnit\Framework\Attributes\DataProvider;

class ElpExportHtml5CommandTest extends KernelTestCase
{
    private CommandTester $commandTester;
    private Filesystem $filesystem;
    private array $tempPaths = [];

    protected function setUp(): void
    {
        self::bootKernel();

        $container = static::getContainer();
        $this->filesystem = new Filesystem();

        $command = $container->get(ElpExportHtml5Command::class);
        $this->commandTester = new CommandTester($command);
    }

    #[DataProvider('elpFileProvider')]
    public function testExportElpFixture(string $fixtureFilename): void
    {
        $inputFile = realpath(__DIR__ . '/../Fixtures/' . $fixtureFilename);
        $outputDir = sys_get_temp_dir() . '/elp_export_' . uniqid();
        mkdir($outputDir, 0755, true);
        $this->tempPaths[] = $outputDir;

        $this->assertFileExists($inputFile, "Input ELP file does not exist: $inputFile");

        $this->commandTester->execute([
            'input' => $inputFile,
            'output' => $outputDir,
            '--debug' => true,
        ]);

        $output = $this->commandTester->getDisplay();

        $this->assertSame(0, $this->commandTester->getStatusCode(), $output);
        $this->assertDirectoryExists($outputDir, 'Output directory does not exist');
        $this->assertFileExists($outputDir . '/index.html', 'index.html not found in output directory');
    }

    public static function elpFileProvider(): array
    {
        return [
            ['basic-example.elp'],                  //   85K
            ['encoding_test.elp'],                  //  477K
            // ['old_elp_modelocrea.elp'],          //  4,2M
            // ['old_elp_nebrija.elp'],             //  7,6M
            // ['old_elp_poder_conexiones.elp'],    //  5,1M
            // ['old_manual_exe29_compressed.elp'], // 10,0M
        ];
    }

    public function testFailsWithInvalidFile(): void
    {
        $tempInvalidFile = tempnam(sys_get_temp_dir(), 'invalid_elp_');
        file_put_contents($tempInvalidFile, 'this is not a valid ELP file');
        $this->tempPaths[] = $tempInvalidFile;

        $outputDir = sys_get_temp_dir() . '/elp_export_invalid_' . uniqid();
        mkdir($outputDir, 0755, true);
        $this->tempPaths[] = $outputDir;

        $this->assertFileExists($tempInvalidFile);

        $this->commandTester->execute([
            'input' => $tempInvalidFile,
            'output' => $outputDir,
            '--debug' => true,
        ]);

        $output = $this->commandTester->getDisplay();

        $this->assertSame(1, $this->commandTester->getStatusCode(), $output);
        $this->assertStringContainsString('Invalid ELP file', $output);
        $this->assertFileDoesNotExist($outputDir . '/index.html', 'index.html should not exist on failure');
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
