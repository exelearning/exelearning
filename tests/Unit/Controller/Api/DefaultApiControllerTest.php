<?php
declare(strict_types=1);

namespace App\Tests\Unit\Controller\Api;

use App\Controller\net\exelearning\Controller\Api\DefaultApiController;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Serializer\SerializerInterface;

/**
 * Unit tests for DefaultApiController to prevent regression of the
 * hydrateRequestBody bug that caused duplicate ODE components on export.
 *
 * Key requirement: POST requests MUST NOT be processed by hydrateRequestBody
 * to prevent breaking session cleanup during file imports.
 */
final class DefaultApiControllerTest extends TestCase
{
    private DefaultApiController $controller;

    protected function setUp(): void
    {
        $entityManager = $this->createMock(EntityManagerInterface::class);
        $logger = $this->createMock(LoggerInterface::class);
        $serializer = $this->createMock(SerializerInterface::class);

        $this->controller = new class($entityManager, $logger, $serializer) extends DefaultApiController {
            public function exposeHydrateRequestBody(Request $request): void
            {
                $this->hydrateRequestBody($request);
            }
        };
    }

    /**
     * Critical test: POST requests must NOT have their body hydrated.
     * This prevents the bug where session cleanup is broken during imports,
     * leading to duplicate ODE components in exports.
     */
    public function testHydrateRequestBodyDoesNotProcessPostRequests(): void
    {
        $request = Request::create(
            '/test',
            'POST',
            [], // parameters
            [], // cookies
            [], // files
            ['CONTENT_TYPE' => 'application/json'],
            '{"key": "value"}'
        );

        // Verify request parameters are empty before hydration
        self::assertCount(0, $request->request->all());

        // Call hydrateRequestBody
        $this->controller->exposeHydrateRequestBody($request);

        // CRITICAL: Parameters should still be empty (NOT hydrated)
        self::assertCount(
            0,
            $request->request->all(),
            'POST requests must NOT be hydrated to prevent session cleanup issues'
        );
    }

    /**
     * PUT requests SHOULD have their body hydrated (this is expected behavior)
     */
    public function testHydrateRequestBodyProcessesPutRequests(): void
    {
        $request = Request::create(
            '/test',
            'PUT',
            [], // parameters
            [], // cookies
            [], // files
            ['CONTENT_TYPE' => 'application/json'],
            '{"key": "value"}'
        );

        self::assertCount(0, $request->request->all());

        $this->controller->exposeHydrateRequestBody($request);

        // PUT requests SHOULD be hydrated
        self::assertCount(1, $request->request->all());
        self::assertSame('value', $request->request->get('key'));
    }

    /**
     * PATCH requests SHOULD have their body hydrated
     */
    public function testHydrateRequestBodyProcessesPatchRequests(): void
    {
        $request = Request::create(
            '/test',
            'PATCH',
            [], // parameters
            [], // cookies
            [], // files
            ['CONTENT_TYPE' => 'application/json'],
            '{"key": "value"}'
        );

        self::assertCount(0, $request->request->all());

        $this->controller->exposeHydrateRequestBody($request);

        // PATCH requests SHOULD be hydrated
        self::assertCount(1, $request->request->all());
        self::assertSame('value', $request->request->get('key'));
    }

    /**
     * DELETE requests SHOULD have their body hydrated
     */
    public function testHydrateRequestBodyProcessesDeleteRequests(): void
    {
        $request = Request::create(
            '/test',
            'DELETE',
            [], // parameters
            [], // cookies
            [], // files
            ['CONTENT_TYPE' => 'application/json'],
            '{"key": "value"}'
        );

        self::assertCount(0, $request->request->all());

        $this->controller->exposeHydrateRequestBody($request);

        // DELETE requests SHOULD be hydrated
        self::assertCount(1, $request->request->all());
        self::assertSame('value', $request->request->get('key'));
    }

    /**
     * GET requests should NOT be processed
     */
    public function testHydrateRequestBodyDoesNotProcessGetRequests(): void
    {
        $request = Request::create(
            '/test',
            'GET',
            [], // parameters
            [], // cookies
            [], // files
            ['CONTENT_TYPE' => 'application/json'],
            '{"key": "value"}'
        );

        self::assertCount(0, $request->request->all());

        $this->controller->exposeHydrateRequestBody($request);

        // GET requests should NOT be hydrated
        self::assertCount(0, $request->request->all());
    }

    /**
     * Requests with existing parameters should not be re-hydrated
     */
    public function testHydrateRequestBodySkipsAlreadyHydratedRequests(): void
    {
        $request = Request::create(
            '/test',
            'PUT',
            ['existing' => 'param'], // Already has parameters
            [], // cookies
            [], // files
            ['CONTENT_TYPE' => 'application/json'],
            '{"key": "value"}'
        );

        self::assertCount(1, $request->request->all());
        self::assertSame('param', $request->request->get('existing'));

        $this->controller->exposeHydrateRequestBody($request);

        // Should still have only the original parameter
        self::assertCount(1, $request->request->all());
        self::assertSame('param', $request->request->get('existing'));
        self::assertNull($request->request->get('key'));
    }

    /**
     * Empty body should be skipped
     */
    public function testHydrateRequestBodySkipsEmptyBody(): void
    {
        $request = Request::create(
            '/test',
            'PUT',
            [], // parameters
            [], // cookies
            [], // files
            ['CONTENT_TYPE' => 'application/json'],
            '' // Empty body
        );

        self::assertCount(0, $request->request->all());

        $this->controller->exposeHydrateRequestBody($request);

        // Should still be empty
        self::assertCount(0, $request->request->all());
    }

    /**
     * Test form-urlencoded content type
     */
    public function testHydrateRequestBodyProcessesFormUrlencodedForPutRequests(): void
    {
        $request = Request::create(
            '/test',
            'PUT',
            [],
            [],
            [],
            ['CONTENT_TYPE' => 'application/x-www-form-urlencoded'],
            'key=value&foo=bar'
        );

        self::assertCount(0, $request->request->all());

        $this->controller->exposeHydrateRequestBody($request);

        self::assertCount(2, $request->request->all());
        self::assertSame('value', $request->request->get('key'));
        self::assertSame('bar', $request->request->get('foo'));
    }
}
