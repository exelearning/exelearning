<?php
namespace App\Tests\Functional\Command;

use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Console\Application;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Filesystem\Filesystem;
use App\Command\net\exelearning\Command\ElpExportHtml5Command;

/**
 * Runs the real export command against a .elp fixture and validates the
 * *generated* HTML (UTF-8 bytes, no mojibake, proper <meta charset> in <head>).
 */
class ElpExportEncodingTest extends KernelTestCase
{
    private Filesystem $fs;
    private CommandTester $tester;
    private string $outDir;

    protected function setUp(): void
    {
        self::bootKernel();
        $c = static::getContainer();

        $this->fs = new Filesystem();
        $command = $c->get(ElpExportHtml5Command::class);

        $app = new Application();
        $app->add($command);
        $this->tester = new CommandTester($command);
    }

    /** @test */
    public function test_index_html_is_utf8_has_charset_meta_and_no_mojibake(): void
    {
        // Arrange: .elp fixture and output dir
        $inputElp = realpath(__DIR__ . '/../Fixtures/encoding_test.elp');
        if (!$inputElp) {
            $this->markTestSkipped('Missing fixture: encoding_test.elp');
        }

        $this->outDir = sys_get_temp_dir() . '/elp_export_' . uniqid('', true);
        $this->fs->mkdir($this->outDir);

        // Act: run the real export command
        $this->tester->execute([
            'input'  => $inputElp,
            'output' => $this->outDir,
        ]);

        // Assert: command succeeded and index.html exists
        $this->assertSame(0, $this->tester->getStatusCode(), $this->tester->getDisplay());
        $index = $this->outDir . '/index.html';
        $this->assertFileExists($index, 'index.html was not generated.');

        $html = file_get_contents($index);
        $this->assertNotFalse($html, 'Unable to read generated index.html');

        // 1) Bytes are valid UTF-8
        $this->assertTrue(mb_check_encoding($html, 'UTF-8'), 'Generated index.html is not valid UTF-8');

        // 2) No typical mojibake pattern from UTF-8 interpreted as ISO-8859-1
        $this->assertFalse((bool) preg_match('/Ã./u', $html), 'Found mojibake sequences like Ã¡/Ã©/Ãº… in index.html');

        // 3) <head> contains a UTF-8 charset meta
        $this->assertHeadHasUtf8Meta($html, 'index.html');

        // 4) Rendered text contains the real “Ú” (not mojibake)
        $dom = new \DOMDocument('1.0', 'UTF-8');
        // Force UTF-8 parsing regardless of meta
        @$dom->loadHTML('<?xml encoding="UTF-8" ?>' . $html);
        $xp = new \DOMXPath($dom);

        $found = false;
        foreach ($xp->query('//p[contains(normalize-space(.), "Prueba")]') as $p) {
            $text = trim($p->textContent);
            $this->assertStringNotContainsString('Ã', $text, 'Mojibake inside <p> in index.html');
            if (str_contains($text, 'Prueba Ú')) {
                $found = true;
                break;
            }
        }
        $this->assertTrue($found, 'Expected a <p> with “Prueba Ú” in the generated index.html.');
    }

    /**
     * Assert that the HTML string has a <meta charset="utf-8"> (or http-equiv
     * Content-Type with charset=UTF-8) inside <head>.
     */
    private function assertHeadHasUtf8Meta(string $html, string $label): void
    {
        $dom = new \DOMDocument('1.0', 'UTF-8');
        @$dom->loadHTML($html);
        $xp = new \DOMXPath($dom);

        // Match <meta charset="utf-8"> (case-insensitive)
        $q1 = '//head/meta[translate(@charset,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz")="utf-8"]';

        // Match <meta http-equiv="content-type" content="...; charset=utf-8"> (case-insensitive)
        $q2 = '//head/meta['.
              'translate(@http-equiv,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz")="content-type" and '.
              'contains(translate(@content,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"), "charset=utf-8")'.
              ']';

        $has = ($xp->query($q1)->length > 0) || ($xp->query($q2)->length > 0);
        $this->assertTrue($has, "Missing UTF-8 charset meta in <head> of $label");
    }

    protected function tearDown(): void
    {
        if (isset($this->outDir) && $this->fs->exists($this->outDir)) {
            $this->fs->remove($this->outDir);
        }
    }
}
