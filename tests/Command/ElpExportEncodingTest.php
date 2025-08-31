<?php
namespace App\Tests\Functional\Command;

use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Filesystem\Filesystem;
use App\Command\net\exelearning\Command\ElpExportHtml5Command;

/**
 * Uses the real ElpExportHtml5Command to export a fixture and validates
 * the generated index.html:
 *  - bytes are valid UTF-8,
 *  - no mojibake in raw HTML,
 *  - <head> contains a UTF-8 charset meta,
 *  - and the rendered DOM contains "Prueba Ú".
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
        $this->tester = new CommandTester($command);
    }

    /** @test */
    public function test_index_html_is_utf8_has_charset_meta_and_no_mojibake(): void
    {
        $input = realpath(__DIR__ . '/../Fixtures/encoding_test.elp');
        $this->outDir = sys_get_temp_dir() . '/elp_export_' . uniqid('', true);
        $this->fs->mkdir($this->outDir);

        // Run command
        $this->tester->execute([
            'input'  => $input,
            'output' => $this->outDir,
        ]);

        // Command ok and index exists
        $this->assertSame(0, $this->tester->getStatusCode(), $this->tester->getDisplay());
        $index = $this->outDir . '/index.html';
        $this->assertFileExists($index, 'index.html was not generated.');

        $html = file_get_contents($index);
        $this->assertNotFalse($html, 'Unable to read index.html');

        // (1) Bytes are valid UTF-8
        $this->assertTrue(mb_check_encoding($html, 'UTF-8'), 'index.html is not valid UTF-8');

        // (2) No typical mojibake pattern (Ã. means UTF-8 misread as Latin-1)
        $this->assertFalse((bool) preg_match('/Ã./u', $html), 'Mojibake found in index.html');

        // (3) <head> contains UTF-8 meta
        $this->assertHeadHasUtf8Meta($html, 'index.html');

        // (4) Rendered text contains “Prueba Ú”
        $dom = new \DOMDocument('1.0', 'UTF-8');
        // Force UTF-8 parsing regardless of meta
        @$dom->loadHTML('<?xml encoding="UTF-8" ?>' . $html);
        $xp = new \DOMXPath($dom);

        $found = false;
        foreach ($xp->query('//p[contains(normalize-space(.), "Prueba")]') as $p) {
            $text = trim($p->textContent);
            $this->assertStringNotContainsString('Ã', $text, 'Mojibake inside paragraph text in index.html');
            if (str_contains($text, 'Prueba Ú')) {
                $found = true;
                break;
            }
        }
        $this->assertTrue($found, 'Expected a <p> with “Prueba Ú” in index.html');
    }

    /**
     * Assert that <head> has either:
     *  - <meta charset="utf-8">, or
     *  - <meta http-equiv="content-type" content="...; charset=utf-8">
     */
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

    protected function tearDown(): void
    {
        if (isset($this->outDir) && $this->fs->exists($this->outDir)) {
            $this->fs->remove($this->outDir);
        }
    }
}
