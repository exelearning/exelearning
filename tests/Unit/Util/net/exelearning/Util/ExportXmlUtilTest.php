<?php

namespace App\Tests\Unit\Util\net\exelearning\Util;

use App\Util\net\exelearning\Util\ExportXmlUtil;
use PHPUnit\Framework\TestCase;
use Symfony\Contracts\Translation\TranslatorInterface;

class ExportXmlUtilTest extends TestCase
{
    public function test_decrypt()
    {
        $originalString = 'hello world';
        $encryptedString = ExportXmlUtil::decrypt($originalString);
        $decryptedString = ExportXmlUtil::decrypt($encryptedString);
        $this->assertEquals($originalString, $decryptedString);
    }

    public function test_createMadeWithExeLink()
    {
        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')
            ->willReturnMap([
                ['Made with eXeLearning', [], null, null, 'Made with eXeLearning'],
                ['(new window)', [], null, null, '(new window)'],
            ]);

        $xml = ExportXmlUtil::createMadeWithExeLink($translator);

        $this->assertInstanceOf(\SimpleXMLElement::class, $xml);
        $this->assertEquals('made-with-exe-link', $xml->getName());
        $p = $xml->p;
        $this->assertEquals('made-with-eXe', (string)$p['id']);
        $a = $p->a;
        $this->assertEquals('https://exelearning.net/', (string)$a['href']);
        $this->assertEquals('_blank', (string)$a['target']);
        $this->assertEquals('noopener', (string)$a['rel']);
        $this->assertStringContainsString('Made with eXeLearning', (string)$a->span[0]);
        $this->assertStringContainsString('(new window)', (string)$a->span[0]->span[0]);
    }
}
