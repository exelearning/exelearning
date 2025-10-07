<?php

namespace App\Tests\Controller\Filemanager;

use App\Controller\net\exelearning\Controller\Filemanager\FilemanagerMethodController;
use App\Config\net\exelearning\Config\FilemanagerConfig\SymfonyExtended\FilemanagerResponse;
use App\Config\net\exelearning\Config\FilemanagerConfig\SymfonyExtended\StreamedResponse;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Service\net\exelearning\Service\FilemanagerService\Archiver\ArchiverInterface;
use App\Service\net\exelearning\Service\FilemanagerService\Storage\DirectoryCollection;
use App\Service\net\exelearning\Service\FilemanagerService\Storage\Filesystem;
use App\Service\net\exelearning\Service\FilemanagerService\Tmpfs\TmpfsInterface;
use App\Service\net\exelearning\Service\FilemanagerService\View\ViewInterface;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\MockObject\MockObject;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Session\SessionInterface;
use Psr\Log\LoggerInterface;
use Symfony\Contracts\Translation\TranslatorInterface;
use Symfony\Component\Serializer\SerializerInterface;

/**
 * Tests for FilemanagerMethodController functionality
 */
class FilemanagerMethodControllerTest extends WebTestCase
{
    private FilemanagerMethodController $controller;
    private MockObject $entityManager;
    private MockObject $fileHelper;
    private MockObject $storage;
    private MockObject $tmpfs;
    private MockObject $logger;
    private MockObject $translator;
    private MockObject $view;
    private MockObject $serializer;

    /**
     * Set up test environment before each test
     */
    protected function setUp(): void
    {
        parent::setUp();

        // Create mocks for all dependencies
        $this->entityManager = $this->createMock(EntityManagerInterface::class);
        $this->fileHelper = $this->createMock(FileHelper::class);
        $this->storage = $this->createMock(Filesystem::class);
        $this->tmpfs = $this->createMock(TmpfsInterface::class);
        $this->logger = $this->createMock(LoggerInterface::class);
        $this->translator = $this->createMock(TranslatorInterface::class);
        $this->view = $this->createMock(ViewInterface::class);
        $this->serializer = $this->createMock(SerializerInterface::class);
        $this->serializer->method('serialize')->willReturnCallback(static function ($data, $format, array $context = []) {
            return json_encode($data);
        });

        // Configure standard mock behavior
        $this->storage->method('getSessionPath')->willReturn('/tmp/session_path');
        $this->fileHelper->method('getOdeFilemanagerDir')->willReturn('/tmp/filemanager_dir');

        // Setup mock directory collection
        $directoryData = [
            ['name' => 'file1.txt', 'type' => 'file', 'path' => '/file1.txt'],
            ['name' => 'folder1', 'type' => 'dir', 'path' => '/folder1']
        ];
        
        $directoryCollection = new DirectoryCollection($directoryData);
        $this->storage->method('getDirectoryCollection')->willReturn($directoryCollection);

        // Create controller instance
        $this->controller = new FilemanagerMethodController(
            $this->entityManager,
            $this->fileHelper,
            $this->storage,
            $this->tmpfs,
            $this->logger,
            $this->translator,
            $this->serializer
        );
    }

    /**
     * Test chunkCheck method when chunk exists
     */
    public function testChunkCheckReturnsChunkExists(): void
    {
        // Prepare request with resumable parameters
        $request = new Request([
            'resumableFilename' => 'testfile.txt',
            'resumableIdentifier' => '12345',
            'resumableChunkNumber' => '1'
        ]);

        // Configure tmpfs mock to report that chunk exists
        $this->tmpfs->method('exists')->willReturn(true);

        // Execute the method
        $response = $this->controller->chunkCheck($request);

        // Assert response type and content
        $this->assertInstanceOf(JsonResponse::class, $response);
        $this->assertEquals(200, $response->getStatusCode());
        $this->assertEquals('"Chunk exists"', $response->getContent());
    }

    /**
     * Test chunkCheck method when chunk does not exist
     */
    public function testChunkCheckReturnsChunkDoesNotExist(): void
    {
        // Prepare request with resumable parameters
        $request = new Request([
            'resumableFilename' => 'testfile.txt',
            'resumableIdentifier' => '12345',
            'resumableChunkNumber' => '1'
        ]);

        // Configure tmpfs mock to report that chunk does not exist
        $this->tmpfs->method('exists')->willReturn(false);

        // Execute the method
        $response = $this->controller->chunkCheck($request);

        // Assert response type and content
        $this->assertInstanceOf(JsonResponse::class, $response);
        $this->assertEquals(204, $response->getStatusCode());
        $this->assertEquals('"Chunk does not exists"', $response->getContent());
    }

    /**
     * Test getConfig method returns properly formatted configuration
     */
    public function testGetConfigReturnsJsonResponse(): void
    {
        $request = new Request();

        // Create a partial mock to handle the getParameter method
        $this->controller = $this->getMockBuilder(FilemanagerMethodController::class)
            ->setConstructorArgs([
                $this->entityManager,
                $this->fileHelper,
                $this->storage,
                $this->tmpfs,
                $this->logger,
                $this->translator,
                $this->serializer
            ])
            ->onlyMethods(['getParameter'])
            ->getMock();

        // Mock locale parameter
        $this->controller->method('getParameter')->willReturn('en');

        // Execute the method
        $response = $this->controller->getConfig($request);

        // Assert response structure
        $this->assertInstanceOf(JsonResponse::class, $response);
        $this->assertJson($response->getContent());

        $data = json_decode($response->getContent(), true);
        $this->assertArrayHasKey('data', $data);
        $this->assertArrayHasKey('app_name', $data['data']);
        $this->assertEquals('Filemanager', $data['data']['app_name']);
        $this->assertArrayHasKey('language', $data['data']);
        $this->assertArrayHasKey('editable', $data['data']);
        $this->assertIsArray($data['data']['editable']);
    }

    /**
     * Test getDirectory returns directory contents
     */
    public function testGetDirectoryReturnsJsonResponse(): void
    {
        // Create mock request with session
        $request = new Request();
        $session = $this->createMock(SessionInterface::class);
        $session->method('get')->willReturn('/');
        $request->setSession($session);

        // Create controller with mocked input and getOdeSessionId methods
        $this->controller = $this->getMockBuilder(FilemanagerMethodController::class)
            ->setConstructorArgs([
                $this->entityManager,
                $this->fileHelper,
                $this->storage,
                $this->tmpfs,
                $this->logger,
                $this->translator,
                $this->serializer
            ])
            ->onlyMethods(['input', 'getOdeSessionId'])
            ->getMock();
            
        // Configure input method to return path
        $this->controller->method('input')
            ->with($this->anything(), 'dir', $this->anything())
            ->willReturn('/');
            
        $this->controller->method('getOdeSessionId')
            ->willReturn('test_session_id');

        // Execute the method
        $response = $this->controller->getDirectory($request);

        // Assert response structure
        $this->assertInstanceOf(JsonResponse::class, $response);
        
        // Test that the response is JSON
        $this->assertEquals('application/json', $response->headers->get('Content-Type'));
        
        // Check that response content is decodable
        $responseData = json_decode($response->getContent(), true);
        $this->assertIsArray($responseData);
        $this->assertArrayHasKey('data', $responseData);
    }

    /**
     * Test index returns the filemanager interface
     */
    public function testIndexReturnsFilemanagerResponse(): void
    {
        // Mock request with session
        $request = new Request();
        $session = $this->createMock(SessionInterface::class);
        $request->setSession($session);

        // Mock filemanager response
        $filemanagerResponse = $this->createMock(FilemanagerResponse::class);
        $filemanagerResponse->expects($this->once())
            ->method('html')
            ->with('<html>File Manager</html>');

        // Mock view that returns HTML
        $this->view->method('getIndexPage')->willReturn('<html>File Manager</html>');

        // Execute the method
        $response = $this->controller->index($request, $filemanagerResponse, $this->view, 'session123');
        
        // Assert response type
        $this->assertInstanceOf(FilemanagerResponse::class, $response);
    }

    /**
     * Test deleteItems removes selected items
     */
    public function testDeleteItems(): void
    {
        // Create sample items to delete
        $items = [
            (object)['type' => 'file', 'path' => '/file1.txt'],
            (object)['type' => 'dir', 'path' => '/folder1']
        ];

        // Create controller with mocked input method
        $this->controller = $this->getMockBuilder(FilemanagerMethodController::class)
            ->setConstructorArgs([
                $this->entityManager,
                $this->fileHelper,
                $this->storage,
                $this->tmpfs,
                $this->logger,
                $this->translator,
                $this->serializer
            ])
            ->onlyMethods(['input', 'getOdeSessionId'])
            ->getMock();
        
        // Configure input method to return items
        $this->controller->method('input')
            ->with($this->anything(), 'items', $this->anything())
            ->willReturn($items);
            
        $this->controller->method('getOdeSessionId')
            ->willReturn('test_session_id');

        // Create mock request with session
        $request = new Request();
        $request->initialize([], [], [], [], [], ['CONTENT_TYPE' => 'application/json'], json_encode(['items' => $items]));
        
        $session = $this->createMock(SessionInterface::class);
        $session->method('get')->willReturn('session123');
        $request->setSession($session);

        // Expect storage to delete items
        $this->storage->expects($this->once())
            ->method('deleteFile')
            ->with('/file1.txt');
        
        $this->storage->expects($this->once())
            ->method('deleteDir')
            ->with('/folder1');

        // Execute the method
        $response = $this->controller->deleteItems($request);

        // Assert response
        $this->assertInstanceOf(JsonResponse::class, $response);
        $this->assertEquals('"Done"', $response->getContent());
    }

}
