<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Dto\PrintPage;
use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdeFiles;
use App\Entity\net\exelearning\Entity\OdeNavStructureSync;
use App\Entity\net\exelearning\Entity\OdePagStructureSync;
use App\Service\PrintDocumentBuilder;
use App\Service\Project\ProjectPropertiesBuilder;
use App\Tests\Helper\TestDatabaseHelper;
use DateTime;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

final class PrintDocumentBuilderTest extends KernelTestCase
{
    public function testBuildCreatesOrderedPages(): void
    {
        $databasePath = sys_get_temp_dir().'/print-builder-'.uniqid().'.sqlite';
        putenv('DB_DRIVER=pdo_sqlite');
        putenv('DB_PATH='.$databasePath);
        $_ENV['DB_DRIVER'] = 'pdo_sqlite';
        $_ENV['DB_PATH'] = $databasePath;
        $_SERVER['DB_DRIVER'] = 'pdo_sqlite';
        $_SERVER['DB_PATH'] = $databasePath;

        self::bootKernel();
        $container = self::$kernel->getContainer();
        $entityManager = $container->get('doctrine')->getManager();

        $schemaTool = new SchemaTool($entityManager);
        $metadata = $entityManager->getMetadataFactory()->getAllMetadata();
        $schemaTool->dropSchema($metadata);
        $schemaTool->createSchema($metadata);

        $user = TestDatabaseHelper::createUser($entityManager, 'owner@example.com');

        $projectId = 'PRJ'.strtoupper(bin2hex(random_bytes(4)));
        $sessionId = 'SES'.strtoupper(bin2hex(random_bytes(4)));
        $versionId = 'VER'.strtoupper(bin2hex(random_bytes(4)));

        $current = new CurrentOdeUsers();
        $current->setOdeId($projectId);
        $current->setOdeVersionId($versionId);
        $current->setOdeSessionId($sessionId);
        $current->setUser($user->getEmail());
        $current->setLastAction(new DateTime());
        $current->setLastSync(new DateTime());
        $current->setSyncSaveFlag(false);
        $current->setSyncNavStructureFlag(false);
        $current->setSyncPagStructureFlag(false);
        $current->setSyncComponentsFlag(false);
        $current->setSyncUpdateFlag(false);
        $current->setNodeIp('127.0.0.1');
        $entityManager->persist($current);

        $file = new OdeFiles();
        $file->setOdeId($projectId);
        $file->setOdeVersionId($versionId);
        $file->setTitle('Demo print project');
        $file->setVersionName('1.0');
        $file->setFileName('demo.elp');
        $file->setFileType('elp');
        $file->setDiskFilename('demo.elp');
        $file->setSize('123');
        $file->setUser($user->getEmail());
        $file->setIsManualSave(true);
        $entityManager->persist($file);

        $rootNav = new OdeNavStructureSync();
        $rootNav->setOdeSessionId($sessionId);
        $rootNav->setOdePageId('PAGE'.strtoupper(bin2hex(random_bytes(3))));
        $rootNav->setPageName('Inicio');
        $rootNav->setOdeNavStructureSyncOrder(1);
        $entityManager->persist($rootNav);

        $childNav = new OdeNavStructureSync();
        $childNav->setOdeSessionId($sessionId);
        $childNav->setOdePageId('PAGE'.strtoupper(bin2hex(random_bytes(3))));
        $childNav->setPageName('Tema 1');
        $childNav->setOdeNavStructureSyncOrder(1);
        $childNav->setOdeParentPageId($rootNav->getOdePageId());
        $childNav->setOdeNavStructureSync($rootNav);
        $entityManager->persist($childNav);

        $rootBlock = new OdePagStructureSync();
        $rootBlock->setOdeSessionId($sessionId);
        $rootBlock->setOdePageId($rootNav->getOdePageId());
        $rootBlock->setOdeBlockId('BLK'.strtoupper(bin2hex(random_bytes(3))));
        $rootBlock->setBlockName('Content');
        $rootBlock->setOdePagStructureSyncOrder(1);
        $rootBlock->setOdeNavStructureSync($rootNav);
        $entityManager->persist($rootBlock);

        $childBlock = new OdePagStructureSync();
        $childBlock->setOdeSessionId($sessionId);
        $childBlock->setOdePageId($childNav->getOdePageId());
        $childBlock->setOdeBlockId('BLK'.strtoupper(bin2hex(random_bytes(3))));
        $childBlock->setBlockName('Content');
        $childBlock->setOdePagStructureSyncOrder(1);
        $childBlock->setOdeNavStructureSync($childNav);
        $entityManager->persist($childBlock);

        $rootComponent = new OdeComponentsSync();
        $rootComponent->setOdeSessionId($sessionId);
        $rootComponent->setOdePageId($rootNav->getOdePageId());
        $rootComponent->setOdeBlockId($rootBlock->getOdeBlockId());
        $rootComponent->setOdeIdeviceId('IDE'.strtoupper(bin2hex(random_bytes(3))));
        $rootComponent->setOdeIdeviceTypeName('Text');
        $rootComponent->setOdePagStructureSync($rootBlock);
        $rootComponent->setHtmlView('<p>Introducción</p>');
        $rootComponent->setOdeComponentsSyncOrder(1);
        $entityManager->persist($rootComponent);

        $childComponent = new OdeComponentsSync();
        $childComponent->setOdeSessionId($sessionId);
        $childComponent->setOdePageId($childNav->getOdePageId());
        $childComponent->setOdeBlockId($childBlock->getOdeBlockId());
        $childComponent->setOdeIdeviceId('IDE'.strtoupper(bin2hex(random_bytes(3))));
        $childComponent->setOdeIdeviceTypeName('Text');
        $childComponent->setOdePagStructureSync($childBlock);
        $childComponent->setHtmlView('<p>Tema 1 contenido</p>');
        $childComponent->setOdeComponentsSyncOrder(1);
        $entityManager->persist($childComponent);

        $entityManager->flush();

        $builder = new PrintDocumentBuilder(
            $entityManager->getRepository(CurrentOdeUsers::class),
            $entityManager->getRepository(OdeNavStructureSync::class),
            $entityManager->getRepository(OdePagStructureSync::class),
            new ProjectPropertiesBuilder($entityManager)
        );
        $document = $builder->build($projectId, $user->getEmail());

        $pages = $document->getPages();
        $this->assertNotEmpty($pages, 'Print document must contain pages');
        $this->assertInstanceOf(PrintPage::class, $pages[0]);
        $this->assertSame('Inicio', $pages[0]->getTitle(), 'First page should match fixture root');

        $tema1 = null;
        foreach ($pages as $page) {
            if ('Tema 1' === $page->getTitle()) {
                $tema1 = $page;
                break;
            }
        }

        $this->assertNotNull($tema1, 'Expected Tema 1 page in flattened structure');
        $this->assertGreaterThanOrEqual(0, $tema1->getLevel());
        $this->assertStringNotContainsString('idevice_actions', $pages[0]->getContent(), 'UI scaffolding should be stripped');
    }
}
