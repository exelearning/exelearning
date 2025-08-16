<?php
namespace App\Tests\Functional\Command;

use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Console\Application;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Filesystem\Filesystem;
use App\Command\net\exelearning\Command\ElpExportHtml5Command;

/**
 * Functional encoding tests for HTML export.
 */
class ElpExportEncodingTest extends KernelTestCase
{
    private Filesystem $filesystem;
    private CommandTester $tester;
    private string $outputDir;

    protected function setUp(): void
    {
        self::bootKernel();
        $container = static::getContainer();

        $this->filesystem = new Filesystem();
        $command = $container->get(ElpExportHtml5Command::class);
        $app = new Application();
        $app->add($command);

        $this->tester = new CommandTester($command);
    }

    /** @test */
    public function test_index_html_has_no_mojibake(): void
    {
        $inputElp = realpath(__DIR__ . '/../Fixtures/encoding_test.elp');
        if (!$inputElp) {
            $this->markTestSkipped('Missing fixture encoding_test.elp');
        }

        $this->outputDir = sys_get_temp_dir() . '/elp_export_' . uniqid('', true);
        $this->filesystem->mkdir($this->outputDir);

        // When
        $this->tester->execute([
            'input'  => $inputElp,
            'output' => $this->outputDir,
        ]);

        // Then
        $this->assertSame(0, $this->tester->getStatusCode());
        $indexPath = $this->outputDir . '/index.html';
        $this->assertFileExists($indexPath, 'index.html was not generated.');

        $html = file_get_contents($indexPath);

        // 2) No mojibake patterns typical of UTF-8 read as ISO-8859-1.
        $this->assertFalse(
            (bool) preg_match('/Ã./u', $html),
            'Found mojibake sequences like Ã¡/Ã©/Ãº...'
        );

        // 3) File content is valid UTF-8.
        $this->assertTrue(mb_check_encoding($html, 'UTF-8'));
    }

    protected function tearDown(): void
    {
        if (isset($this->outputDir) && $this->filesystem->exists($this->outputDir)) {
            $this->filesystem->remove($this->outputDir);
        }
    }
}
