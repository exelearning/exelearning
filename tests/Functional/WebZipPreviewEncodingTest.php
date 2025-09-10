<?php
namespace App\Tests\Functional\Preview;

use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Filesystem\Filesystem;
use App\Command\net\exelearning\Command\ElpExportCommand;
use RecursiveIteratorIterator;
use RecursiveDirectoryIterator;

/**
 * Uses elp:export (HTML5) to produce a site and validates every generated page:
 *  - files are valid UTF-8,
 *  - no mojibake ("Ã.") in raw HTML,
 *  - <head> has a UTF-8 charset meta,
 *  - at least one page renders the full extended Spanish character set.
 */
class WebZipPreviewEncodingTest extends KernelTestCase
{
    /** Extended set expected to appear literally in rendered text nodes. */
    private const EXTENDED_SAMPLE_CHARS = [
        'á','é','í','ó','ú','ü',
        'Á','É','Í','Ó','Ú','Ü',
        'ñ','Ñ','¡','¿','&','>','<'
    ];

    private Filesystem $fs;
    private CommandTester $tester;
    private string $outDir;

    protected function setUp(): void
    {
        self::bootKernel();
        $c = static::getContainer();

        $this->fs = new Filesystem();

        $command = $c->get(ElpExportCommand::class);
        $this->tester = new CommandTester($command);
    }

    /** @test */
    public function test_generated_html_is_utf8_no_mojibake_has_meta_and_renders_extended_chars(): void
    {
        $input = realpath(__DIR__ . '/../Fixtures/encoding_test.elp');
        if (!$input) {
            $this->markTestSkipped('Missing fixture: encoding_test.elp');
        }

        $this->outDir = sys_get_temp_dir() . '/elp_export_html5_' . uniqid('', true);
        $this->fs->mkdir($this->outDir);

        // Run generic export (HTML5)
        $this->tester->execute([
            'input'   => $input,
            'output'  => $this->outDir,
            'format'  => 'html5',
            '--debug' => true,
        ]);

        $this->assertSame(0, $this->tester->getStatusCode(), $this->tester->getDisplay());
        $this->assertDirectoryExists($this->outDir, 'Output directory missing');

        $htmlFiles = $this->findHtmlFiles($this->outDir);
        $this->assertNotEmpty($htmlFiles, 'No generated HTML files found');

        $foundPrueba = false;
        $foundAllExtended = false;

        foreach ($htmlFiles as $file) {
            $rel = ltrim(str_replace($this->outDir . DIRECTORY_SEPARATOR, '', $file), DIRECTORY_SEPARATOR);

            // Skip assets/templates we don’t want to validate here
            if (preg_match('#^(idevices|libs|theme|content/css)/#i', $rel)) {
                continue;
            }

            $html = file_get_contents($file);
            $this->assertNotFalse($html, "Unable to read $rel");

            // Raw UTF-8 and no mojibake
            $this->assertTrue(mb_check_encoding($html, 'UTF-8'), "Not valid UTF-8: $rel");
            $this->assertFalse((bool) preg_match('/Ã./u', $html), "Mojibake found in raw HTML: $rel");

            // <head> must declare UTF-8
            $this->assertHeadHasUtf8Meta($html, $rel);

            // DOM check for “Prueba Ú”
            $dom = new \DOMDocument('1.0', 'UTF-8');
            @$dom->loadHTML('<?xml encoding="UTF-8" ?>' . $html);
            $xp = new \DOMXPath($dom);

            foreach ($xp->query('//p') as $p) {
                $text = trim($p->textContent);

                // Paragraphs should not contain mojibake either
                $this->assertStringNotContainsString('Ã', $text, "Mojibake inside paragraph text: $rel");

                if (!$foundPrueba && str_contains($text, 'Prueba Ú')) {
                    $foundPrueba = true;
                }

                // Try to satisfy the full extended sample with any single paragraph
                if (!$foundAllExtended && $this->containsAll($text, self::EXTENDED_SAMPLE_CHARS)) {
                    $foundAllExtended = true;
                }

                if ($foundPrueba && $foundAllExtended) {
                    break;
                }
            }

            if ($foundPrueba && $foundAllExtended) {
                break;
            }
        }

        $this->assertTrue($foundPrueba, 'Expected a paragraph with “Prueba Ú” in the generated site.');
        $this->assertTrue(
            $foundAllExtended,
            'Expected at least one paragraph to contain all of: ' . implode(' ', self::EXTENDED_SAMPLE_CHARS)
        );
    }

    /** Assert that <head> has a UTF-8 charset meta (charset attribute or http-equiv). */
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

    /** Return all .html/.xhtml files under a directory (recursive). */
    private function findHtmlFiles(string $dir): array
    {
        $rii = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir));
        $files = [];
        foreach ($rii as $f) {
            if ($f->isDir()) continue;
            $p = $f->getPathname();
            if (preg_match('/\.x?html?$/i', $p)) {
                $files[] = $p;
            }
        }
        return $files;
    }

    /** True if $haystack contains every token in $needles. */
    private function containsAll(string $haystack, array $needles): bool
    {
        foreach ($needles as $n) {
            if (!str_contains($haystack, $n)) {
                return false;
            }
        }
        return true;
    }

    protected function tearDown(): void
    {
        if (isset($this->outDir) && $this->fs->exists($this->outDir)) {
            $this->fs->remove($this->outDir);
        }
    }
}
