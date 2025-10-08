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
        // Capture current env to avoid polluting other tests
        $originalEnv = getenv('BASE_PATH');
        $hadOriginal = $originalEnv !== false;

        try {
            // Reboot the kernel between runs so the container sees the new env
            self::ensureKernelShutdown();

            // Set env var that feeds parameters.base_path (config/services.yaml)
            putenv('BASE_PATH='.$basePath);
            $_ENV['BASE_PATH'] = $basePath;
            $_SERVER['BASE_PATH'] = $basePath;

            // Important in CI: the test cache may be pre-warmed by setup scripts,
            // which bakes the routing prefix. Clear the cache so routes are rebuilt
            // with the new BASE_PATH for this dataset.
            $projectDir = \dirname(__DIR__, 2); // repo root
            $cacheDir = $projectDir.'/var/cache/test';
            if (is_dir($cacheDir)) {
                // Use the project's FileUtil for a robust recursive remove
                require_once $projectDir.'/src/Util/net/exelearning/Util/FileUtil.php';
                \App\Util\net\exelearning\Util\FileUtil::removeDir($cacheDir);
            }

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
        } finally {
            // Ensure we don't leak this env var to subsequent tests
            self::ensureKernelShutdown();
            if ($hadOriginal) {
                putenv('BASE_PATH='.$originalEnv);
                $_ENV['BASE_PATH'] = $originalEnv;
                $_SERVER['BASE_PATH'] = $originalEnv;
            } else {
                // Unset when there was no prior value
                putenv('BASE_PATH');
                unset($_ENV['BASE_PATH'], $_SERVER['BASE_PATH']);
            }
        }
    }
}
