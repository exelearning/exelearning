<?php
// This simplified test uses Symfony DomCrawler for basic HTML element assertions.
namespace App\Tests\Command;

use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\DomCrawler\Crawler;
use Symfony\Component\Console\Application;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Filesystem\Filesystem;
use App\Command\net\exelearning\Command\ElpExportHtml5Command;

class ElpExportSimpleTest extends KernelTestCase
{
    private Filesystem $filesystem;
    private CommandTester $commandTester;
	private string $outputDir;

    protected function setUp(): void
    {
        self::bootKernel();
        $container = static::getContainer();

        $this->filesystem = new Filesystem();
        $command = $container->get(ElpExportHtml5Command::class);
        $application = new Application();
        $application->add($command);
        $this->commandTester = new CommandTester($command);
    }

    public function testIndexHasBasicElements(): void
    {
        // Locate fixture file.
        $inputElp = realpath(__DIR__ . '/../Fixtures/old_manual_exe29_compressed.elp');
        $this->assertFileExists($inputElp, 'ELP fixture file not found.');

        // Prepare output directory.
		$this->outputDir = sys_get_temp_dir() . '/elp_export_' . uniqid();
		$this->filesystem->mkdir($this->outputDir);

        // Execute export command.
        $this->commandTester->execute([
            'input'  => $inputElp,
            'output' => $this->outputDir,
        ]);

        // Ensure command succeeded and file exists.
        $this->assertSame(0, $this->commandTester->getStatusCode());
        $indexPath = $this->outputDir . '/index.html';
        $this->assertFileExists($indexPath, 'index.html was not generated.');

        // Load HTML for assertions.
        $html = file_get_contents($indexPath);
        $crawler = new Crawler($html);

        // Basic head and html tags
        $this->assertStringContainsString(
            'eXeLearning 2.9. Tutorial - Manual',
            $crawler->filter('title')->text(),
            'Page title does not match.'
        );
        $this->assertEquals(
            'es',
            $crawler->filter('html')->attr('lang'),
            'HTML lang attribute should be "es".'
        );
        $this->assertEquals(
            'es',
            $crawler->filter('body')->attr('lang'),
            'Body lang attribute should be "es".'
        );
        $this->assertGreaterThan(
            0,
            $crawler->filter('link[rel="stylesheet"]')->count(),
            'Stylesheet link not found.'
        );

        // Navigation
        $this->assertGreaterThan(
            0,
            $crawler->filter('nav#siteNav')->count(),
            'Main navigation (#siteNav) not found.'
        );
        $this->assertGreaterThanOrEqual(
            5,
            $crawler->filter('nav#siteNav ul > li')->count(),
            'Expected at least 5 top-level nav items.'
        );
        $this->assertGreaterThan(
            0,
            $crawler->filterXPath('//nav[@id="siteNav"]//a[contains(normalize-space(.),"Índice")]')->count(),
            'Navigation link for "Índice" not found.'
        );

        // Main content
        $this->assertGreaterThan(
            0,
            $crawler->filter('main')->count(),
            'Main element not found.'
        );
        $this->assertStringContainsString(
            '¿Qué es eXeLearning?',
            $crawler->filter('main h1')->text(),
            'Main heading does not match root node title.'
        );
        $this->assertGreaterThan(
            0,
            $crawler->filter('div.exe-text')->count(),
            'Expected at least one FreeText content block (exe-text) not found.'
        );
        $this->assertGreaterThan(
            0,
            $crawler->filter('table.exe-table')->count(),
            'Expected table with class exe-table not found.'
        );
        $this->assertGreaterThan(
            0,
            $crawler->filterXPath('//h2[contains(normalize-space(.),"Principales novedades de la versión 2.9")]')->count(),
            'Header "Principales novedades de la versión 2.9" not found.'
        );
        $this->assertGreaterThan(
            0,
            $crawler->filter('iframe[src*="youtube.com/embed"]')->count(),
            'YouTube iframe not found.'
        );
        $this->assertGreaterThan(
            0,
            $crawler->filter('img[src*="10_razones_para_usar_exe.png"]')->count(),
            'Expected image for "10 razones" not found.'
        );
        $this->assertGreaterThan(
            0,
            $crawler->filter('a[href*="exelearning.net"]')->count(),
            'Link to exelearning.net not found.'
        );

        // Footer and license
        $this->assertGreaterThan(
            0,
            $crawler->filter('footer#siteFooter')->count(),
            'Footer (#siteFooter) not found.'
        );
        $this->assertGreaterThan(
            0,
            $crawler->filter('footer#siteFooter a[href*="creativecommons.org"]')->count(),
            'Creative Commons license link not found in footer.'
        );

    }

	protected function tearDown(): void
	{
	    if (isset($this->outputDir) && $this->filesystem->exists($this->outputDir)) {
	    	// Clean up generated files.
	        $this->filesystem->remove($this->outputDir);
	    }
	}

}
