<?php

declare(strict_types=1);

namespace App\Service\net\exelearning\Service\FilemanagerService\Archiver\Adapters;

use App\Service\net\exelearning\Service\FilemanagerService\Archiver\ArchiverInterface;
use App\Service\net\exelearning\Service\FilemanagerService\Storage\Filesystem as Storage;
use App\Service\net\exelearning\Service\FilemanagerService\Tmpfs\TmpfsInterface;

/**
 * Service to zip and unzip files using native \ZipArchive.
 *
 * This implementation avoids Flysystem and any reflection tricks,
 * writes files via temporary paths to keep memory usage low,
 * and streams data in and out safely.
 */
class ZipArchiver implements ArchiverInterface
{
    /** @var \ZipArchive|null */
    protected $zip;

    /** @var Storage */
    protected $storage;

    /** @var string Unique tmpfs identifier for the working zip file */
    protected $uniqid;

    /** @var array<string> List of temp files buffered into the zip */
    protected $tmpFiles = [];

    /** @var TmpfsInterface */
    protected $tmpfs;

    public function __construct(TmpfsInterface $tmpfs)
    {
        $this->tmpfs = $tmpfs;
    }

    /**
     * Create a new archive on tmpfs and prepare it for adding entries.
     *
     * @return string unique identifier (the tmpfs filename of the zip)
     */
    public function createArchive(Storage $storage): string
    {
        // Give the tmp file a .zip suffix so some tools recognize it if needed.
        $this->uniqid = uniqid(prefix: 'zip_', more_entropy: true).'.zip';
        $zipPath = $this->tmpfs->getFileLocation($this->uniqid);

        $zip = new \ZipArchive();
        $opened = $zip->open($zipPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE);
        if (true !== $opened) {
            throw new \RuntimeException('Cannot create ZIP at '.$zipPath.' (code '.$opened.')');
        }

        $this->zip = $zip;
        $this->storage = $storage;

        return $this->uniqid;
    }

    /**
     * Recursively add a directory tree from Storage into the archive.
     * The structure is preserved inside the zip.
     */
    public function addDirectoryFromStorage(string $path): void
    {
        $this->ensureZipIsOpen();

        // Normalize path for zip
        $base = trim($path, '/');
        if ('' !== $base) {
            // Ensure the base directory exists inside the zip
            $this->zip->addEmptyDir($base);
        }

        $content = $this->storage->getDirectoryCollection($path, true);
        foreach ($content->all() as $item) {
            if ('dir' === $item['type']) {
                $dirPath = trim($item['path'], '/');
                if ('' !== $dirPath) {
                    $this->zip->addEmptyDir($dirPath);
                }
                continue;
            }

            if ('file' === $item['type']) {
                $this->addFileFromStorage($item['path']);
            }
        }
    }

    /**
     * Add a single file from Storage into the archive.
     * Uses tmpfs as a buffer to avoid loading the whole file into memory.
     */
    public function addFileFromStorage(string $path): void
    {
        $this->ensureZipIsOpen();

        // Read as stream from Storage
        $file = $this->storage->readStream($path);
        if (!isset($file['stream']) || !is_resource($file['stream'])) {
            throw new \RuntimeException('Storage did not return a valid stream for '.$path);
        }

        // Persist the stream to a tmpfs file to pass a file path to ZipArchive::addFile
        $tmpId = uniqid(prefix: 'zf_', more_entropy: true);
        $tmpPath = $this->tmpfs->getFileLocation($tmpId);

        $out = fopen($tmpPath, 'wb');
        if (!is_resource($out)) {
            if (is_resource($file['stream'])) {
                fclose($file['stream']);
            }
            throw new \RuntimeException('Cannot open tmp path for writing: '.$tmpPath);
        }

        stream_copy_to_stream($file['stream'], $out);
        fclose($out);
        fclose($file['stream']);

        // Path inside the zip must not start with a leading slash
        $zipInnerPath = ltrim($path, '/');
        $ok = $this->zip->addFile($tmpPath, $zipInnerPath);
        if (false === $ok) {
            $this->tmpfs->remove($tmpId);
            throw new \RuntimeException('Failed to add file to archive: '.$zipInnerPath);
        }

        $this->tmpFiles[] = $tmpId;
    }

    /**
     * Uncompress a zip from Storage into a destination path on the same Storage.
     * Reads via tmpfs to a local \ZipArchive for efficient iteration.
     */
    public function uncompress(string $source, string $destination, Storage $storage): void
    {
        // Buffer remote zip to tmpfs
        $name = uniqid(prefix: 'unz_', more_entropy: true).'.zip';
        $remote = $storage->readStream($source);
        if (!isset($remote['stream']) || !is_resource($remote['stream'])) {
            throw new \RuntimeException('Storage did not return a valid stream for '.$source);
        }
        $this->tmpfs->write($name, $remote['stream']); // write() is expected to consume and close the stream

        $zipPath = $this->tmpfs->getFileLocation($name);
        $zip = new \ZipArchive();
        $opened = $zip->open($zipPath);
        if (true !== $opened) {
            $this->tmpfs->remove($name);
            throw new \RuntimeException('Cannot open ZIP for uncompress: '.$zipPath.' (code '.$opened.')');
        }

        // Iterate all entries; create dirs and stream file contents out
        for ($i = 0; $i < $zip->numFiles; ++$i) {
            $entryName = $zip->getNameIndex($i);
            if (false === $entryName) {
                continue;
            }

            // Normalize names and detect directories
            if (str_ends_with($entryName, '/')) {
                // Directory inside the zip
                // Keep your original two-argument createDir() call signature if your Storage expects it
                $storage->createDir($destination, rtrim($entryName, '/'));
                continue;
            }

            // File: obtain a read stream and hand it to Storage::store
            $stream = $zip->getStream($entryName);
            if (!is_resource($stream)) {
                // Some zips may contain special entries; skip if no stream
                continue;
            }

            $dirname = trim(dirname($entryName), '.');
            $basename = basename($entryName);

            if ('' !== $dirname && '/' !== $dirname) {
                $storage->createDir($destination, $dirname);
            }
            $storage->store(
                rtrim($destination, '/').'/'.ltrim($dirname, '/'),
                $basename,
                $stream
            );

            if (is_resource($stream)) {
                fclose($stream);
            }
        }

        $zip->close();
        $this->tmpfs->remove($name);
    }

    /**
     * Close the working archive and cleanup temporary buffered files.
     */
    public function closeArchive(): void
    {
        if ($this->zip instanceof \ZipArchive) {
            $this->zip->close();
            $this->zip = null;
        }

        foreach ($this->tmpFiles as $fileId) {
            $this->tmpfs->remove($fileId);
        }
        $this->tmpFiles = [];
    }

    /**
     * Persist the created archive from tmpfs into Storage at the requested location.
     * Also cleans up the tmpfs copy afterwards.
     */
    public function storeArchive($destination, $name): void
    {
        // Ensure the zip file is closed before reading it
        $this->closeArchive();

        // Read the zip from tmpfs and push it to Storage
        $file = $this->tmpfs->readStream($this->uniqid);
        if (!isset($file['stream']) || !is_resource($file['stream'])) {
            throw new \RuntimeException('Could not read the temporary zip stream: '.$this->uniqid);
        }

        $this->storage->store($destination, $name, $file['stream']);

        if (is_resource($file['stream'])) {
            fclose($file['stream']);
        }

        // Remove the tmpfs zip
        $this->tmpfs->remove($this->uniqid);
    }

    /**
     * Guard to ensure an archive is currently open.
     */
    protected function ensureZipIsOpen(): void
    {
        if (!($this->zip instanceof \ZipArchive)) {
            throw new \LogicException('Archive is not open. Call createArchive() first.');
        }
    }
}
