<?php

namespace App\Tests\Unit\Util;

use PHPUnit\Framework\TestCase;
use App\Util\net\exelearning\Util\OdeXmlUtil;
use ReflectionClass;

/**
 * Unit tests for OdeXmlUtil::prepareText() encoding behavior.
 */
class OdeXmlUtilPrepareTextTest extends TestCase
{
    /**
     * Call the private static prepareText() via reflection.
     *
     * @param string|null $text
     * @return string|null
     */
    private function callPrepareText(?string $text): ?string
    {
        $ref = new ReflectionClass(OdeXmlUtil::class);
        $m = $ref->getMethod('prepareText');
        $m->setAccessible(true);

        return $m->invoke(null, $text);
    }

    /** @test */
    public function test_it_keeps_utf8_and_escapes_xml_entities(): void
    {
        // Given a proper UTF-8 string with XML-sensitive chars.
        $in  = 'A < B & C " \' Prueba Ú ñ';
        $out = $this->callPrepareText($in);

        // Then UTF-8 chars remain intact and XML entities are escaped.
        $this->assertSame(
            'A &lt; B &amp; C &quot; &apos; Prueba Ú ñ',
            $out,
            'Expected XML-escaped output while keeping UTF-8 letters unchanged.'
        );

        // And the result is valid UTF-8.
        $this->assertTrue(mb_check_encoding($out, 'UTF-8'));
    }

    /** @test */
    public function test_it_converts_latin1_input_to_utf8(): void
    {
        // Given a Latin-1 (ISO-8859-1) byte for Ú (0xDA).
        $latin1 = 'Prueba ' . chr(0xDA); // "Ú" in ISO-8859-1 bytes.

        $out = $this->callPrepareText($latin1);

        // Then it is converted to proper UTF-8 and XML-escaped consistently.
        $this->assertStringContainsString('Prueba Ú', $out);
        $this->assertTrue(mb_check_encoding($out, 'UTF-8'), 'Output must be UTF-8.');
    }

    /** @test */
    public function test_it_converts_cp1252_smart_quotes_to_utf8(): void
    {
        // 0x93 and 0x94 are left/right double quotes in Windows-1252
        $cp1252 = chr(0x93) . 'Hola' . chr(0x94); // “Hola”
        $out = $this->callPrepareText($cp1252);

        $this->assertStringContainsString('“Hola”', $out);
        $this->assertTrue(mb_check_encoding($out, 'UTF-8'));
    }


    /** @test */
    public function test_it_returns_null_on_null_input(): void
    {
        $this->assertNull($this->callPrepareText(null));
    }
}
