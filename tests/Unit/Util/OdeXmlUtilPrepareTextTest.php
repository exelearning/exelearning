<?php
namespace App\Tests\Unit\Util;

use PHPUnit\Framework\TestCase;
use App\Util\net\exelearning\Util\OdeXmlUtil;
use ReflectionClass;

/**
 * Focused unit test for OdeXmlUtil::prepareText() ensuring:
 *  - UTF-8 input is preserved and XML-escaped,
 *  - Latin-1/CP1252 input gets converted to UTF-8,
 *  - null returns null.
 */
class OdeXmlUtilPrepareTextTest extends TestCase
{
    /** Helper: call the private static prepareText() via reflection. */
    private function callPrepareText(?string $text): ?string
    {
        $ref = new ReflectionClass(OdeXmlUtil::class);
        $m = $ref->getMethod('prepareText');
        $m->setAccessible(true);

        return $m->invoke(null, $text);
    }

    /** @test */
    public function test_keeps_utf8_and_escapes_xml_entities(): void
    {
        $in  = 'A < B & C " \' Prueba Ú ñ';
        $out = $this->callPrepareText($in);

        $this->assertSame('A &lt; B &amp; C &quot; &apos; Prueba Ú ñ', $out);
        $this->assertTrue(mb_check_encoding($out, 'UTF-8'));
    }

    /** @test */
    public function test_converts_latin1_to_utf8(): void
    {
        // 0xDA is Ú in ISO-8859-1
        $latin1 = 'Prueba ' . chr(0xDA);
        $out = $this->callPrepareText($latin1);

        $this->assertStringContainsString('Prueba Ú', $out);
        $this->assertTrue(mb_check_encoding($out, 'UTF-8'));
    }

    /** @test */
    public function test_converts_cp1252_smart_quotes_to_utf8(): void
    {
        // 0x93/0x94 are “ and ” in Windows-1252
        $cp1252 = chr(0x93) . 'Hola' . chr(0x94); // “Hola”
        $out = $this->callPrepareText($cp1252);

        $this->assertStringContainsString('“Hola”', $out);
        $this->assertTrue(mb_check_encoding($out, 'UTF-8'));
    }

    /** @test */
    public function returns_null_for_null_input(): void
    {
        $this->assertNull($this->callPrepareText(null));
    }
}
