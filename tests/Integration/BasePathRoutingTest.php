<?php

declare(strict_types=1);

namespace App\Tests\Integration;

use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;

final class BasePathRoutingTest extends WebTestCase
{
    public static function basePathProvider(): array
    {
        return [
            'root install' => [''],
            'one level' => ['/exelearning'],
            'two levels' => ['/web/exelearning'],
            'deep path' => ['/a/b/c'],
        ];
    }

    #[DataProvider('basePathProvider')]
    public function testRoutesHonorBasePath(string $basePath): void
    {
        // Reboot the kernel between runs so the container sees the new env
        self::ensureKernelShutdown();

        // Set env var that feeds parameters.base_path (config/services.yaml)
        putenv('BASE_PATH='.$basePath);
        $_ENV['BASE_PATH'] = $basePath;
        $_SERVER['BASE_PATH'] = $basePath;

        $client = self::createClient();

        $container = self::getContainer();
        $router = $container->get('router');

        // Parameter must reflect the env var
        self::assertSame($basePath, $container->getParameter('base_path'));

        // Named routes should be prefixed with BASE_PATH when set
        $expectedWorkareaPath = ($basePath ?: '').'/workarea';
        $expectedHealthPath = ($basePath ?: '').'/healthcheck';

        self::assertSame($expectedWorkareaPath, $router->generate('workarea', [], UrlGeneratorInterface::ABSOLUTE_PATH));
        self::assertSame($expectedHealthPath, $router->generate('healthcheck', [], UrlGeneratorInterface::ABSOLUTE_PATH));

        // The healthcheck endpoint should respond at its BASE_PATH-aware URL
        $client->request('GET', $expectedHealthPath);
        self::assertResponseStatusCodeSame(Response::HTTP_OK);
        self::assertJsonStringEqualsJsonString('{"status":"ok"}', $client->getResponse()->getContent());

        // Note: We only assert the BASE_PATH-aware URL to avoid depending
        // on route load order for the legacy /healthcheck redirect.
    }
}
