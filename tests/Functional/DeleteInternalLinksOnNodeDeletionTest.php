<?php
namespace App\Tests\Functional;

use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdeNavStructureSync;
use App\Service\net\exelearning\Service\Api\OdeServiceInterface;
use App\Tests\Helper\TestDatabaseHelper;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\Request;
use App\Controller\net\exelearning\Controller\Api\NavStructureApiController;

class DeleteInternalLinksOnNodeDeletionTest extends KernelTestCase
{
    private ContainerInterface $container;

    protected function setUp(): void
    {
        self::bootKernel();
        $this->container = static::getContainer();
    }

    /** @test */
    public function test_deleting_node_removes_internal_links_from_components(): void
    {
        $em = $this->container->get('doctrine')->getManager();

        // Ensure a user exists
        $user = TestDatabaseHelper::createUser($em);

        // Import the ELP fixture into a fresh session
        $odeService = $this->container->get(OdeServiceInterface::class);

        $elpPath = realpath(__DIR__ . '/../Fixtures/tema-10-ejemplo.elp');
        $this->assertNotFalse($elpPath, 'Missing fixture: tema-10-ejemplo.elp');

        $check = $odeService->checkLocalOdeFile(basename($elpPath), $elpPath, $user, true);
        $this->assertSame('OK', $check['responseMessage'] ?? null, 'ELP check failed');

        $odeService->createElpStructureAndCurrentOdeUser(
            basename($elpPath),
            $user,
            $user,
            '127.0.0.1',
            true,
            $check
        );

        $sessionId = $check['odeSessionId'];
        $this->assertNotEmpty($sessionId, 'No session id returned after import');

        // Locate the nodes: "Inicio" and "Tema 1"
        $navRepo = $em->getRepository(OdeNavStructureSync::class);
        $navs = $navRepo->getNavStructure($sessionId);

        $inicio = null;
        $toDelete = null;
        foreach ($navs as $n) {
            if ($n->getPageName() === 'Inicio') {
                $inicio = $n;
            }
            if ($n->getPageName() === 'Tema 1') {
                $toDelete = $n;
            }
        }

        $this->assertNotNull($inicio, 'Inicio page not found in imported ELP');
        $this->assertNotNull($toDelete, 'Tema 1 page not found in imported ELP');

        $deletedPageId = (int) $toDelete->getOdePageId();
        $this->assertGreaterThan(0, $deletedPageId, 'Invalid odePageId for page to delete');

        // Gather components for "Inicio" and confirm there is at least one internal link to the target page
        $compRepo = $em->getRepository(OdeComponentsSync::class);
        $inicioComponents = $compRepo->findBy([
            'odeSessionId' => $sessionId,
            'odePageId'    => $inicio->getOdePageId(),
        ]);

        $this->assertNotEmpty($inicioComponents, 'Inicio page has no components to validate');

        $targetHref = 'exe-node:' . $deletedPageId;
        $hadLink = false;
        foreach ($inicioComponents as $c) {
            $hv = (string) ($c->getHtmlView() ?? '');
            $jp = (string) ($c->getJsonProperties() ?? '');
            if (str_contains($hv, $targetHref) || str_contains($jp, $targetHref)) {
                $hadLink = true;
                break;
            }
        }
        $this->assertTrue($hadLink, 'Fixture does not contain expected internal link to the target page in Inicio');

        // Perform deletion via controller action
        /** @var NavStructureApiController $controller */
        $controller = $this->container->get(NavStructureApiController::class);
        $response = $controller->deleteOdeNavStructureSyncAction(new Request([], [], [], [], [], []), $toDelete->getId());
        $this->assertSame(200, $response->getStatusCode(), 'Delete action did not return HTTP 200');

        // Reload components and ensure internal links are gone
        $inicioComponents = $compRepo->findBy([
            'odeSessionId' => $sessionId,
            'odePageId'    => $inicio->getOdePageId(),
        ]);

        foreach ($inicioComponents as $c) {
            $hv = (string) ($c->getHtmlView() ?? '');
            $jp = (string) ($c->getJsonProperties() ?? '');

            // html_view must not contain the exe-node href anymore
            $this->assertStringNotContainsString('href="' . $targetHref . '"', $hv, 'html_view still contains href to deleted node');
            // json_properties may contain escaped quotes; assert both raw and escaped forms are gone
            $this->assertStringNotContainsString('href=\"' . $targetHref . '\"', $jp, 'json_properties still contains escaped href to deleted node');
            $this->assertStringNotContainsString('href="' . $targetHref . '"', $jp, 'json_properties still contains href to deleted node');
        }
    }
}
