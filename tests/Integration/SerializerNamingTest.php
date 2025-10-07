<?php

declare(strict_types=1);

namespace App\Tests\Integration;

use App\Entity\net\exelearning\Dto\IdeviceDataSaveDto;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Serializer\SerializerInterface;

class SerializerNamingTest extends KernelTestCase
{
    public function testIdeviceDataSaveDtoSerialization(): void
    {
        self::bootKernel();
        $serializer = self::getContainer()->get(SerializerInterface::class);

        $dto = new IdeviceDataSaveDto();
        $dto->setResponseMessage('OK');
        $dto->setIsNewOdeComponentsSync(true);
        $dto->setIsNewOdePagStructureSync(true);

        $json = $serializer->serialize($dto, 'json');
        $this->assertJson($json);

        $data = json_decode($json, true, JSON_THROW_ON_ERROR);
        $this->assertArrayHasKey('newOdeComponentsSync', $data);
        $this->assertTrue($data['newOdeComponentsSync']);
        $this->assertArrayHasKey('newOdePagStructureSync', $data);
        $this->assertTrue($data['newOdePagStructureSync']);
    }
}
