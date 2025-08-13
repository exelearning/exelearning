<?php

namespace App\Controller\net\exelearning\Controller\Filemanager;

use App\Config\net\exelearning\Config\FilemanagerConfig\SymfonyExtended\FilemanagerResponse;
use App\Config\net\exelearning\Config\FilemanagerConfig\SymfonyExtended\StreamedResponse;
use App\Constants;
use App\Controller\net\exelearning\Controller\Api\DefaultApiController;
use App\Exception\net\exelearning\Exception\Logical\PhpZipExtensionException;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Service\net\exelearning\Service\FilemanagerService\Archiver\ArchiverInterface;
use App\Service\net\exelearning\Service\FilemanagerService\Storage\Filesystem;
use App\Service\net\exelearning\Service\FilemanagerService\Tmpfs\TmpfsInterface;
use App\Service\net\exelearning\Service\FilemanagerService\View\ViewInterface;
use App\Util\net\exelearning\Util\FileUtil;
use App\Util\net\exelearning\Util\Util;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\HeaderUtils;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Mime\MimeTypes;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * Implements view and directory methods to filemanager.
 */
#[Route('/filemanager')]
class FilemanagerMethodController extends DefaultApiController
{
    private $fileHelper;

    protected $storage;

    protected $separator;

    protected $tmpfs;

    protected $logger;

    private $translator;

    public function __construct(EntityManagerInterface $entityManager, FileHelper $fileHelper, Filesystem $storage, TmpfsInterface $tmpfs, LoggerInterface $logger, TranslatorInterface $translator)
    {
        parent::__construct($entityManager, $logger);

        $this->tmpfs = $tmpfs;
        $this->storage = $storage;
        $this->storage->setPathPrefix(Constants::SLASH);
        $this->fileHelper = $fileHelper;
        $this->separator = Constants::SLASH;
        $this->translator = $translator;
    }

    /**
     * Checks if chunk for upload already exists or not.
     *
     * @return JsonResponse
     */
    #[Route('/upload', methods: ['GET'], name: 'chunkCheck')]
    public function chunkCheck(Request $request)
    {
        $file_name = self::input($request, 'resumableFilename', 'file');
        $identifier = (string) preg_replace('/[^0-9a-zA-Z_]/', '', (string) self::input($request, 'resumableIdentifier'));
        $chunk_number = (int) self::input($request, 'resumableChunkNumber');

        $chunk_file = 'multipart_'.$identifier.$file_name.'.part'.$chunk_number;

        if ($this->tmpfs->exists($chunk_file)) {
            return new JsonResponse('Chunk exists', 200, [], false);
        }

        return new JsonResponse('Chunk does not exists', 204, [], false);
    }

    /**
     * Extended method for request.
     */
    public function input(Request $request, $key, $default = null)
    {
        // first try GET, then POST
        $value = $request->get($key, $request->query->get($key));

        // then look into JSON content, fallback to default
        if (null === $value) {
            $content = json_decode((string) $request->getContent());
            $value = isset($content->{$key}) ? $content->{$key} : $default;
        }

        return $value;
    }

    /**
     * Return view of filemanager.
     *
     * @return JsonResponse
     */
    #[Route('/index/{plugin}/{odeSessionId}', name: 'filemanager_index')]
    public function index(Request $request, FilemanagerResponse $response, ViewInterface $view, $odeSessionId = null)
    {
        // Set parameter odeSessionId
        if ($odeSessionId) {
            $session = $request->getSession();
            $session->set('odeSessionId', $odeSessionId);
        }

        $response->html($view->getIndexPage($request));

        return $response;
    }

    /**
     * Return json to set the configuration of filemanager.
     *
     * @return JsonResponse
     */
    #[Route('/getconfig', name: 'getConfig')]
    public function getConfig(Request $request)
    {
        $language = $this->getParameter('kernel.default_locale');
        $fron_conf = [
            'data' => [
                'app_name' => 'Filemanager',
                'language' => $language,
                'upload_max_size' => 100 * 1024 * 1024,
                'upload_chunk_size' => 100 * 1024 * 1024,
                'upload_simultaneous' => 3,
                'default_archive_name' => 'archive.zip',
                'editable' => [
                    0 => '.txt',
                    1 => '.css',
                    2 => '.js',
                    3 => '.ts',
                    4 => '.html',
                    5 => '.php',
                    6 => '.json',
                    7 => '.md',
                ],
                'date_format' => 'YY/MM/DD hh:mm:ss',
                'search_simultaneous' => 5,
                'filter_entries' => [],
            ],
        ];

        $jsonData = $this->getJsonSerialized($fron_conf);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    /**
     * List of root.
     *
     * @return JsonResponse
     */
    #[Route('/getdir', name: 'getDir')]
    public function getDirectory(Request $request)
    {
        $session = $request->getSession();
        if ($session->get('path')) {
            $path = self::input($request, 'dir', $session->get('path'));
        } else {
            $path = self::input($request, 'dir', '/');
        }
        $session->set('path', $path);

        // Filemanager dir path
        $odeSessionId = $this->getOdeSessionId($request, $session->get('odeSessionId'));
        $filemanagerDirPath = $this->fileHelper->getOdeFilemanagerDir($odeSessionId);
        $this->storage->setSessionPath($filemanagerDirPath);

        $content = $this->storage->getDirectoryCollection($path);

        $data = [
            'data' => $content,
        ];

        return new JsonResponse($data, $this->status, [], false);
    }

    /**
     * List of folders when change directory.
     *
     * @return JsonResponse
     */
    #[Route('/changedir', name: 'changeDir')]
    public function changeDirectory(Request $request)
    {
        $session = $request->getSession();
        $path = self::input($request, 'to', $this->separator);

        // Filemanager dir path
        $odeSessionId = $this->getOdeSessionId($request, $session->get('odeSessionId'));
        $filemanagerDirPath = $this->fileHelper->getOdeFilemanagerDir($odeSessionId);
        $this->storage->setSessionPath($filemanagerDirPath);

        // $jsonData =$this->storage->getDirectoryCollection($path);
        $session->set('path', $path);
        $data = [
            'data' => $this->storage->getDirectoryCollection($path),
        ];

        return new JsonResponse($data, $this->status, [], false);
    }

    /**
     * Creates a new folder or file.
     *
     * @return JsonResponse
     */
    #[Route('/createnew', name: 'createNew')]
    public function createNew(Request $request)
    {
        $session = $request->getSession();
        $type = self::input($request, 'type', 'file');
        $name = self::input($request, 'name');
        $path = $session->get('path');

        // Filemanager dir path
        $odeSessionId = $this->getOdeSessionId($request, $session->get('odeSessionId'));
        $filemanagerDirPath = $this->fileHelper->getOdeFilemanagerDir($odeSessionId);
        $this->storage->setSessionPath($filemanagerDirPath);

        if ('dir' == $type) {
            $this->storage->createDir($path, self::input($request, 'name'));
        }
        if ('file' == $type) {
            $this->storage->createFile($path, self::input($request, 'name'));
        }

        $data = [
            'data' => 'Done',
        ];

        return new JsonResponse($data, $this->status, [], false);
    }

    /**
     * Agroup parts of the file to upload and then upload to the server.
     *
     * @return JsonResponse
     */
    #[Route('/upload', methods: ['POST'], name: 'upload')]
    public function upload(Request $request)
    {
        $file_name = self::input($request, 'resumableFilename', 'file');
        $destination = self::input($request, 'resumableRelativePath');
        $chunk_number = (int) self::input($request, 'resumableChunkNumber');
        $total_chunks = (int) self::input($request, 'resumableTotalChunks');
        $total_size = (int) self::input($request, 'resumableTotalSize');
        $identifier = (string) preg_replace('/[^0-9a-zA-Z_]/', '', (string) self::input($request, 'resumableIdentifier'));

        $filebag = $request->files;
        $file = $filebag->get('file');

        $overwrite_on_upload = false;

        if ($file && is_array($file) && array_key_exists('full_path', $file)) {
            unset($file['full_path']);
            $filebag->set('file', $file);
            $file = $filebag->get('file');
        }

        if (!$file || !$file->isValid() || $file->getSize() > 100 * 1024 * 1024) {
            return new JsonResponse('Bad file', 422, [], false);
        }

        $prefix = 'multipart_'.$identifier;

        $stream = fopen($file->getPathName(), 'r');
        $this->tmpfs->write($prefix.$file_name.'.part'.$chunk_number, $stream, false);

        // check if all the parts present, and create the final destination file
        $chunks_size = 0;
        foreach ($this->tmpfs->findAll($prefix.'*') as $chunk) {
            $chunks_size += $chunk['size'];
        }

        // file too big, cleanup to protect server, set error trap
        if ($chunks_size > 1000 * 1024 * 1024) {
            foreach ($this->tmpfs->findAll($prefix.'*') as $tmp_chunk) {
                $this->tmpfs->remove($tmp_chunk['name']);
            }
            $this->tmpfs->write($prefix.'_error', '', false);

            return new JsonResponse('Chunk too big', 422, [], false);
        }

        // if all the chunks are present, create final file and store it
        if ($chunks_size >= $total_size) {
            for ($i = 1; $i <= $total_chunks; ++$i) {
                $part = $this->tmpfs->readStream($prefix.$file_name.'.part'.$i);
                $this->tmpfs->write($file_name, $part['stream'], true);
            }

            $final = $this->tmpfs->readStream($file_name);

            // Filemanager dir path
            $session = $request->getSession();
            $odeSessionId = $this->getOdeSessionId($request, $session->get('odeSessionId'));
            $filemanagerDirPath = $this->fileHelper->getOdeFilemanagerDir($odeSessionId);
            $this->storage->setSessionPath($filemanagerDirPath);

            // Check mimeType before upload
            $isAllowedFile = FileUtil::checkMimeTypeBase64($final['mimeType']);
            // Check filesize
            $isBelowMaxFileSize = FileUtil::checkFileSize($final['filesize']);
            if (!$isAllowedFile || !$isBelowMaxFileSize) {
                $this->logger->error('mime type not allowed or size over limit', ['mimeType' => $final['mimeType'], 'fileSize' => $final['filesize'], 'file:' => $this, 'line' => __LINE__]);

                // Delete restricted file
                $this->tmpfs->remove($file_name);
                foreach ($this->tmpfs->findAll($prefix.'*') as $expired_chunk) {
                    $this->tmpfs->remove($expired_chunk['name']);
                }

                return new JsonResponse('Error storing file', $this->status, [], false);
            }

            $res = $this->storage->store($destination, $final['filename'], $final['stream'], $overwrite_on_upload);

            // cleanup
            $this->tmpfs->remove($file_name);
            foreach ($this->tmpfs->findAll($prefix.'*') as $expired_chunk) {
                $this->tmpfs->remove($expired_chunk['name']);
            }

            return $res ? new JsonResponse('Stored', $this->status, [], false) : new JsonResponse('Error storing file', $this->status, [], false);
        }

        return new JsonResponse('Uploaded', $this->status, [], false);
    }

    /**
     * Delete item selected.
     *
     * @return JsonResponse
     */
    #[Route('/deleteitems', name: 'deleteItems')]
    public function deleteItems(Request $request)
    {
        $items = self::input($request, 'items', []);

        // Filemanager dir path
        $session = $request->getSession();
        $odeSessionId = $this->getOdeSessionId($request, $session->get('odeSessionId'));
        $filemanagerDirPath = $this->fileHelper->getOdeFilemanagerDir($odeSessionId);
        $this->storage->setSessionPath($filemanagerDirPath);

        foreach ($items as $item) {
            if ('dir' == $item->type) {
                $this->storage->deleteDir($item->path);
            }
            if ('file' == $item->type) {
                $this->storage->deleteFile($item->path);
            }
        }

        return new JsonResponse('Done', $this->status, [], false);
    }

    /**
     * Copy selected item.
     *
     * @return JsonResponse
     */
    #[Route('/copyitems', name: 'copyItems')]
    public function copyItems(Request $request)
    {
        $items = self::input($request, 'items', []);
        $destination = self::input($request, 'destination', $this->separator);

        // Filemanager dir path
        $session = $request->getSession();
        $odeSessionId = $this->getOdeSessionId($request, $session->get('odeSessionId'));
        $filemanagerDirPath = $this->fileHelper->getOdeFilemanagerDir($odeSessionId);
        $this->storage->setSessionPath($filemanagerDirPath);

        foreach ($items as $item) {
            if ('dir' == $item->type) {
                $this->storage->copyDir($item->path, $destination);
            }
            if ('file' == $item->type) {
                $this->storage->copyFile($item->path, $destination);
            }
        }

        return new JsonResponse('Done', $this->status, [], false);
    }

    /**
     * Move selected item.
     *
     * @return JsonResponse
     */
    #[Route('/moveitems', name: 'moveItems')]
    public function moveItems(Request $request)
    {
        $items = self::input($request, 'items', []);
        $destination = self::input($request, 'destination', $this->separator);

        // Filemanager dir path
        $session = $request->getSession();
        $odeSessionId = $this->getOdeSessionId($request, $session->get('odeSessionId'));
        $filemanagerDirPath = $this->fileHelper->getOdeFilemanagerDir($odeSessionId);
        $this->storage->setSessionPath($filemanagerDirPath);

        foreach ($items as $item) {
            $full_destination = trim($destination, $this->separator)
                .$this->separator
                .ltrim($item->name, $this->separator);
            $this->storage->move($item->path, $full_destination);
        }

        return new JsonResponse('Done', $this->status, [], false);
    }

    /**
     * Rename the item selected.
     *
     * @return JsonResponse
     */
    #[Route('/renameitem', name: 'renameItem')]
    public function renameItem(Request $request)
    {
        $destination = self::input($request, 'destination', $this->separator);
        $from = self::input($request, 'from');
        $to = self::input($request, 'to');

        // Filemanager dir path
        $session = $request->getSession();
        $odeSessionId = $this->getOdeSessionId($request, $session->get('odeSessionId'));
        $filemanagerDirPath = $this->fileHelper->getOdeFilemanagerDir($odeSessionId);
        $this->storage->setSessionPath($filemanagerDirPath);

        $this->storage->rename($destination, $from, $to);

        return new JsonResponse('Done', $this->status, [], false);
    }

    /**
     * Download the item with a encoded base.
     *
     * @return Response
     */
    #[Route('/download&path={path}', name: 'download')]
    public function download(Request $request, StreamedResponse $streamedResponse, $path)
    {
        // Filemanager dir path
        $session = $request->getSession();
        $odeSessionId = $this->getOdeSessionId($request, $session->get('odeSessionId'));
        $filemanagerDirPath = $this->fileHelper->getOdeFilemanagerDir($odeSessionId);
        $this->storage->setSessionPath($filemanagerDirPath);

        try {
            $file = $this->storage->readStream((string) base64_decode($path));
        } catch (\Exception $e) {
            return $e;
        }

        $streamedResponse->setCallback(function () use ($file): void {
            set_time_limit(0);
            if ($file['stream']) {
                while (!feof($file['stream'])) {
                    echo fread($file['stream'], 1024 * 8);
                    ob_flush();
                    flush();
                }
                fclose($file['stream']);
            }
        });

        $extension = pathinfo($file['filename'], PATHINFO_EXTENSION);
        $mimes = (new MimeTypes())->getMimeTypes($extension);
        $contentType = !empty($mimes) ? $mimes[0] : 'application/octet-stream';
        $disposition = HeaderUtils::DISPOSITION_ATTACHMENT;
        $download_inline = ['pdf'];
        if (in_array($extension, $download_inline) || in_array('*', $download_inline)) {
            $disposition = HeaderUtils::DISPOSITION_INLINE;
        }
        $contentDisposition = HeaderUtils::makeDisposition($disposition, $file['filename'], 'file');
        $streamedResponse->headers->set(
            'Content-Disposition',
            $contentDisposition
        );
        $streamedResponse->headers->set(
            'Content-Type',
            $contentType
        );
        $streamedResponse->headers->set(
            'Content-Transfer-Encoding',
            'binary'
        );
        if (isset($file['filesize'])) {
            $streamedResponse->headers->set(
                'Content-Length',
                $file['filesize']
            );
        }
        if ('dev' == $_ENV['APP_ENV']) {
            $streamedResponse->headers->set(
                'Access-Control-Allow-Origin',
                $request->headers->get('Origin')
            );
            $streamedResponse->headers->set(
                'Access-Control-Allow-Credentials',
                'true'
            );
        }

        return $streamedResponse;
    }

    /**
     * Creates a zip of the item.
     *
     * @return JsonResponse
     */
    #[Route('/zipitems', name: 'zipitems')]
    public function zipItems(Request $request, ArchiverInterface $archiver)
    {
        try {
            Util::checkPhpZipExtension();

            $items = self::input($request, 'items', []);
            $destination = self::input($request, 'destination', $this->separator);
            $name = self::input($request, 'name', 'archive.zip');

            // Filemanager dir path
            $session = $request->getSession();
            $odeSessionId = $this->getOdeSessionId($request, $session->get('odeSessionId'));
            $filemanagerDirPath = $this->fileHelper->getOdeFilemanagerDir($odeSessionId);
            $this->storage->setSessionPath($filemanagerDirPath);

            $archiver->createArchive($this->storage);

            foreach ($items as $item) {
                if ('dir' == $item->type) {
                    $archiver->addDirectoryFromStorage($item->path);
                }
                if ('file' == $item->type) {
                    $archiver->addFileFromStorage($item->path);
                }
            }

            $archiver->storeArchive($destination, $name);

            return new JsonResponse('Done', $this->status, [], false);
        } catch (PhpZipExtensionException $e) {
            $this->logger->error($e->getDescription(), ['className' => $e->getClassName(), 'phpZipExtensionInstalled' => $e->getZipExtensionInstalled(), 'file:' => $this, 'line' => __LINE__]);

            $this->status = self::STATUS_CODE_SERVICE_UNAVAILABLE;

            return new JsonResponse($this->translator->trans($e->getDescription()), $this->status, [], false);
        }
    }

    /**
     * Unzip the file selected.
     *
     * @return JsonResponse
     */
    #[Route('/unzipitem', name: 'unzipitem')]
    public function unzipItem(Request $request, ArchiverInterface $archiver)
    {
        try {
            Util::checkPhpZipExtension();

            $source = self::input($request, 'item');
            $destination = self::input($request, 'destination', $this->separator);

            // Filemanager dir path
            $session = $request->getSession();
            $odeSessionId = $this->getOdeSessionId($request, $session->get('odeSessionId'));
            $filemanagerDirPath = $this->fileHelper->getOdeFilemanagerDir($odeSessionId);
            $this->storage->setSessionPath($filemanagerDirPath);

            $archiver->uncompress($source, $destination, $this->storage);

            return new JsonResponse('Done', $this->status, [], false);
        } catch (PhpZipExtensionException $e) {
            $this->logger->error($e->getDescription(), ['className' => $e->getClassName(), 'phpZipExtensionInstalled' => $e->getZipExtensionInstalled(), 'file:' => $this, 'line' => __LINE__]);

            $this->status = self::STATUS_CODE_SERVICE_UNAVAILABLE;

            return new JsonResponse($this->translator->trans($e->getDescription()), $this->status, [], false);
        }
    }

    /**
     * Save content of edited text files.
     *
     * @return JsonResponse
     */
    #[Route('/savecontent', name: 'saveContent')]
    public function saveContent(Request $request)
    {
        $session = $request->getSession();
        $path = self::input($request, 'dir', $session->get('path', $this->separator));

        $name = self::input($request, 'name');
        $content = self::input($request, 'content');

        // Filemanager dir path
        $session = $request->getSession();
        $odeSessionId = $this->getOdeSessionId($request, $session->get('odeSessionId'));
        $filemanagerDirPath = $this->fileHelper->getOdeFilemanagerDir($odeSessionId);
        $this->storage->setSessionPath($filemanagerDirPath);

        $stream = tmpfile();
        fwrite($stream, $content);
        rewind($stream);

        $this->storage->deleteFile($path.$this->separator.$name);
        $this->storage->store($path, $name, $stream);

        if (is_resource($stream)) {
            fclose($stream);
        }

        return new JsonResponse('Done', $this->status, [], false);
    }

    /**
     * Get relative path to the file.
     *
     * @return JsonResponse
     */
    #[Route('/getpath', name: 'getpath')]
    public function getPath(Request $request)
    {
        // path post
        $path = self::input($request, 'item');
        // Term fixed
        $pathIni = 'files';
        // Term to search
        $pathCutString = 'tmp';

        // Filemanager dir path
        $session = $request->getSession();
        $odeSessionId = $this->getOdeSessionId($request, $session->get('odeSessionId'));
        $filemanagerDirPath = $this->fileHelper->getOdeFilemanagerDir($odeSessionId);
        $this->storage->setSessionPath($filemanagerDirPath);

        // Directory path
        $path = $this->storage->getSessionPath().$path;
        // Cut path to a relative path
        $relativePathSearchTerm = $pathCutString.DIRECTORY_SEPARATOR;
        $reltivePathPosition = strpos($path, $relativePathSearchTerm);
        $path = substr($path, $reltivePathPosition);

        // Relative path
        $relativePath = $pathIni.DIRECTORY_SEPARATOR.$path;

        $data = [
            'path' => $relativePath,
        ];

        return new JsonResponse($data, $this->status, [], false);
    }
}
