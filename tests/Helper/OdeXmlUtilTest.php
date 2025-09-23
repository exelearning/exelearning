<?php

namespace App\Tests\Helper;

use PHPUnit\Framework\TestCase;
use App\Util\net\exelearning\Util\OdeXmlUtil;
use Symfony\Contracts\Translation\TranslatorInterface;

class OdeXmlUtilTest extends TestCase
{
    public function testOldElpStructureNewPageBasic()
    {
        $odeSessionId  = '20250418172857XIPCIJ';
        $generatedIds  = [];
        $xpathNamespace = "http://www.exelearning.org/content/v0.3";
        $translator = $this->createMock(TranslatorInterface::class);

        // This is an xml node taken from an old elp
        $xml_serialized = file_get_contents(realpath(__DIR__ . '/../Fixtures/node_serialized.xml'));

        $oldXmlListInst = simplexml_load_string($xml_serialized);


        // 3) Usamos Reflection para llamar al método privado estático
        $refClass  = new \ReflectionClass(OdeXmlUtil::class);
        $refMethod = $refClass->getMethod('oldElpStructureNewPage');
        $refMethod->setAccessible(true);

        $result = $refMethod->invokeArgs(
            null,
            [$odeSessionId, $generatedIds, $oldXmlListInst, null, $xpathNamespace, $translator]
        );

        // 4) Aserciones básicas sobre la estructura de salida
        $this->assertIsArray($result);
        $this->assertArrayHasKey('odeNavStructureSyncs', $result);
        $this->assertArrayHasKey('nodeReferences',           $result);
        $this->assertArrayHasKey('srcRoutes',                $result);
        $this->assertEquals("titlePage", $result['odeNavStructureSyncs'][0]->getOdeNavStructureSyncProperties()[0]->getKey());
        $this->assertEquals("_Inicio_", $result['odeNavStructureSyncs'][0]->getOdeNavStructureSyncProperties()[0]->getValue());
    }
}
