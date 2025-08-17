<?php
namespace App\Tests\Functional\Preview;

use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Console\Application;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Filesystem\Filesystem;
use App\Command\net\exelearning\Command\ElpExportCommand;
use RecursiveIteratorIterator;
use RecursiveDirectoryIterator;

/**
 * Executes elp:export (HTML5) against the .elp fixture and validates the
 * *generated* pages:
 *  - files are valid UTF-8,
 *  - no mojibake ("Ã.") in raw HTML,
 *  - <head> has a UTF-8 charset meta,
 *  - some <p> contains the real "Prueba Ú".
 */
class WebZipPreviewEncodingTest extends KernelTestCase
{
    private Filesystem $fs;
    private CommandTester $tester;
    private string $outDir;

    protected function setUp(): void
    {
        self::bootKernel();
        $c = static::getContainer();

        $this->fs = new Filesystem();

        $command = $c->get(ElpExportCommand::class);
        $app = new Application();
        $app->add($command);
        $this->tester = new CommandTester($command);
    }

    /** @test */
    public function test_generated_html_is_utf8_has_charset_meta_and_no_mojibake_and_shows_prueba_U(): void
    {
        // Arrange
        $inputElp = realpath(__DIR__ . '/../Fixtures/encoding_test.elp');
        if (!$inputElp) {
            $this->markTestSkipped('Missing fixture: encoding_test.elp');
        }

        $this->outDir = sys_get_temp_dir() . '/elp_export_html5_' . uniqid('', true);
        $this->fs->mkdir($this->outDir);

        // Act: run the generic export (HTML5)
        $this->tester->execute([
            'command' => 'elp:export',
            'input'   => $inputElp,
            'output'  => $this->outDir,
            'format'  => 'html5',
            '--debug' => true,
        ]);

        // Assert command and output
        $this->assertSame(0, $this->tester->getStatusCode(), $this->tester->getDisplay());
        $this->assertDirectoryExists($this->outDir, 'Output directory missing');

        $htmlFiles = $this->findHtmlFiles($this->outDir);
        $this->assertNotEmpty($htmlFiles, 'No generated HTML files found.');

        $foundPrueba = false;

        foreach ($htmlFiles as $file) {
            $rel = ltrim(str_replace($this->outDir . DIRECTORY_SEPARATOR, '', $file), DIRECTORY_SEPARATOR);

            // Skip obvious assets/templates
            if (preg_match('#^(idevices|libs|theme|content/css)/#i', $rel)) {
                continue;
            }

            $html = file_get_contents($file);
            $this->assertNotFalse($html, "Unable to read $rel");

            // Raw bytes must be UTF-8
            $this->assertTrue(mb_check_encoding($html, 'UTF-8'), "Not valid UTF-8: $rel");

            // No typical mojibake pattern
            $this->assertFalse((bool) preg_match('/Ã./u', $html), "Found mojibake in raw HTML: $rel");

            // <head> contains a UTF-8 charset meta
            $this->assertHeadHasUtf8Meta($html, $rel);

            // Parse and check rendered text
            $dom = new \DOMDocument('1.0', 'UTF-8');
            @$dom->loadHTML('<?xml encoding="UTF-8" ?>' . $html);
            $xp = new \DOMXPath($dom);

            foreach ($xp->query('//p[contains(normalize-space(.), "Prueba")]') as $p) {
                $text = trim($p->textContent);
                $this->assertStringNotContainsString('Ã', $text, "Mojibake inside <p> of $rel");
                if (str_contains($text, 'Prueba Ú')) {
                    $foundPrueba = true;
                    break 2;
                }
            }
        }

        $this->assertTrue($foundPrueba, 'Expected to find a <p> with “Prueba Ú” in the generated site.');
    }

    /** Assert that <head> has a UTF-8 charset meta (charset attr or http-equiv). */
    private function assertHeadHasUtf8Meta(string $html, string $label): void
    {
        $dom = new \DOMDocument('1.0', 'UTF-8');
        @$dom->loadHTML($html);
        $xp = new \DOMXPath($dom);

        $q1 = '//head/meta[translate(@charset,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz")="utf-8"]';
        $q2 = '//head/meta['.
              'translate(@http-equiv,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz")="content-type" and '.
              'contains(translate(@content,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"), "charset=utf-8")'.
              ']';

        $has = ($xp->query($q1)->length > 0) || ($xp->query($q2)->length > 0);
        $this->assertTrue($has, "Missing UTF-8 charset meta in <head> of $label");
    }

    /** @return array<string> */
    private function findHtmlFiles(string $dir): array
    {
        $rii = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir));
        $files = [];
        foreach ($rii as $file) {
            if ($file->isDir()) {
                continue;
            }
            $path = $file->getPathname();
            if (preg_match('/\.x?html?$/i', $path)) {
                $files[] = $path;
            }
        }
        return $files;
    }

    protected function tearDown(): void
    {
        if (isset($this->outDir) && $this->fs->exists($this->outDir)) {
            $this->fs->remove($this->outDir);
        }
    }
}
