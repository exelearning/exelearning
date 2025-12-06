<?php

namespace App\Service\net\exelearning\Service\FilemanagerService\Tmpfs\Adapters;

use App\Helper\net\exelearning\Helper\FileHelper;
use App\Service\net\exelearning\Service\FilemanagerService\Tmpfs\TmpfsInterface;
use App\Util\net\exelearning\Util\FilePermissionsUtil;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\RequestStack;

/**
 * Temporary folder for zip and parts of upload.
 */
class Tmpfs implements TmpfsInterface
{
    protected $path;
    private $fileHelper;
    private $logger;

    public function __construct(RequestStack $requestStack, FileHelper $fileHelper, LoggerInterface $logger)
    {
        $request = $requestStack->getCurrentRequest();
        $odeSessionId = $request->query->get('odeSessionId') ?? $request->request->get('odeSessionId');
        if (null == $odeSessionId) {
            $session = $request->getSession();
            $odeSessionId = $session->get('odeSessionId');
        }

        $this->path = $fileHelper->getOdeSessionTmpDir($odeSessionId);
        $this->logger = $logger;

        if (!is_dir($this->path)) {
            mkdir($this->path);
        }
        $this->clean(60 * 5);
    }

    public function write(string $filename, $data, $append = false)
    {
        $filename = $this->sanitizeFilename($filename);

        $flags = 0;

        if ($append) {
            $flags = FILE_APPEND;
        }
        file_put_contents($this->getPath().$filename, $data, $flags);
    }

    public function getFileLocation(string $filename): string
    {
        $filename = $this->sanitizeFilename($filename);

        return $this->getPath().$filename;
    }

    public function read(string $filename): string
    {
        $filename = $this->sanitizeFilename($filename);

        return (string) file_get_contents($this->getPath().$filename);
    }

    public function readStream(string $filename): array
    {
        $filename = $this->sanitizeFilename($filename);

        $stream = fopen($this->getPath().$filename, 'r');
        $filesize = filesize($this->getPath().$filename);
        $mimeType = mime_content_type($this->getPath().$filename);

        return [
            'filename' => $filename,
            'stream' => $stream,
            'filesize' => $filesize,
            'mimeType' => $mimeType,
        ];
    }

    public function exists(string $filename): bool
    {
        $filename = $this->sanitizeFilename($filename);

        return file_exists($this->getPath().$filename);
    }

    public function findAll($pattern): array
    {
        $files = [];
        $matches = glob($this->getPath().$pattern);
        if (!empty($matches)) {
            foreach ($matches as $filename) {
                if (is_file($filename)) {
                    $files[] = [
                        'name' => basename($filename),
                        'size' => filesize($filename),
                        'time' => filemtime($filename),
                    ];
                }
            }
        }

        return $files;
    }

    public function remove(string $filename)
    {
        try {
            $filename = $this->sanitizeFilename($filename);
            $filePath = $this->getPath().$filename;

            if (file_exists($filePath) || FilePermissionsUtil::isWritable($filePath)) {
                try {
                    unlink($filePath);
                } catch (\Exception $e) {
                    $this->logger->error('unlink error : '.$e->getMessage(), ['filePath:' => $filePath, 'file:' => $this, 'line' => __LINE__]);
                }
            }
        } catch (\Exception $e) {
            $this->logger->error('File error : '.$e->getMessage(), ['filePath:' => $filePath, 'file:' => $this, 'line' => __LINE__]);
        }
    }

    public function clean(int $older_than)
    {
        $files = $this->findAll('*.part*');
        foreach ($files as $file) {
            if (time() - $file['time'] >= $older_than) {
                $this->remove($file['name']);
            }
        }
    }

    private function getPath(): string
    {
        return $this->path;
    }

    private function sanitizeFilename($filename)
    {
        $filename = (string) preg_replace(
            '~
            [<>:"/\\|?*]|    # file system reserved https://en.wikipedia.org/wiki/Filename#Reserved_characters_and_words
            [\x00-\x1F]|     # control characters http://msdn.microsoft.com/en-us/library/windows/desktop/aa365247%28v=vs.85%29.aspx
            [\x7F\xA0\xAD]|  # non-printing characters DEL, NO-BREAK SPACE, SOFT HYPHEN
            [;\\\{}^\~`]     # other non-safe
            ~xu',
            '-',
            (string) $filename
        );

        return mb_substr($filename, 0, 255);
    }
}
