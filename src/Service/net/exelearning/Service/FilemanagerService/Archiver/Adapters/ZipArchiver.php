<?php

namespace App\Service\net\exelearning\Service\FilemanagerService\Archiver\Adapters;

use App\Service\net\exelearning\Service\FilemanagerService\Archiver\ArchiverInterface;
use App\Service\net\exelearning\Service\FilemanagerService\Storage\Filesystem as Storage;
use App\Service\net\exelearning\Service\FilemanagerService\Tmpfs\TmpfsInterface;
use League\Flysystem\Config as Flyconfig;
use League\Flysystem\Filesystem as Flysystem;
use League\Flysystem\ZipArchive\ZipArchiveAdapter;

/**
 * Service to zip and unzip files.
 */
class ZipArchiver implements ArchiverInterface
{
    protected $archive;

    protected $storage;

    protected $uniqid;

    protected $tmp_files = [];

    public function __construct(TmpfsInterface $tmpfs)
    {
        $this->tmpfs = $tmpfs;
    }

    /**
     * Creates archive with a unique id to add files.
     */
    public function createArchive(Storage $storage): string
    {
        $this->uniqid = uniqid();
        $this->archive = new Flysystem(
            new ZipAdapter($this->tmpfs->getFileLocation($this->uniqid))
        );
        $this->storage = $storage;

        return $this->uniqid;
    }

    /**
     * Add directories to the file created.
     */
    public function addDirectoryFromStorage(string $path)
    {
        $content = $this->storage->getDirectoryCollection($path, true);
        $this->archive->createDir($path);
        foreach ($content->all() as $item) {
            if ('dir' == $item['type']) {
                $this->archive->createDir($item['path']);
            }
            if ('file' == $item['type']) {
                $this->addFileFromStorage($item['path']);
            }
        }
    }

    /**
     * Add files to the file created.
     */
    public function addFileFromStorage(string $path)
    {
        $file_uniqid = uniqid();
        $file = $this->storage->readStream($path);
        $this->tmpfs->write($file_uniqid, $file['stream']);
        $this->archive->write($path, $this->tmpfs->getFileLocation($file_uniqid));
        $this->tmp_files[] = $file_uniqid;
    }

    /**
     * Uncompress the file selected.
     */
    public function uncompress(string $source, string $destination, Storage $storage)
    {
        $name = uniqid().'.zip';
        $remote_archive = $storage->readStream($source);
        $this->tmpfs->write($name, $remote_archive['stream']);
        $archive = new Flysystem(
            new ZipAdapter($this->tmpfs->getFileLocation($name))
        );
        $contents = $archive->listContents('/', true);
        foreach ($contents as $item) {
            $stream = null;
            if ('dir' == $item['type']) {
                $storage->createDir($destination, $item['path']);
            }
            if ('file' == $item['type']) {
                $stream = $archive->readStream($item['path']);
                $storage->store($destination.'/'.$item['dirname'], $item['basename'], $stream);
            }
            if (is_resource($stream)) {
                fclose($stream);
            }
        }
        $this->tmpfs->remove($name);
    }

    /**
     * Close archive and delete files of tmp.
     */
    public function closeArchive()
    {
        $this->archive->getAdapter()->getArchive()->close();

        foreach ($this->tmp_files as $file) {
            $this->tmpfs->remove($file);
        }
    }

    /**
     * Save archive to the destination folder.
     */
    public function storeArchive($destination, $name)
    {
        $this->closeArchive();

        $file = $this->tmpfs->readStream($this->uniqid);
        $this->storage->store($destination, $name, $file['stream']);
        if (is_resource($file['stream'])) {
            fclose($file['stream']);
        }
        $this->tmpfs->remove($this->uniqid);
    }
}

/**
 * Adapter to add files to the location.
 */
class ZipAdapter
{
    private ZipArchiveAdapter $adapter;

    public function __construct(string $zipFilePath)
    {
        $this->adapter = new ZipArchiveAdapter($zipFilePath);
    }

    public function getAdapter(): ZipArchiveAdapter
    {
        return $this->adapter;
    }

    /**
     * Add in the location and returns path and content.
     *
     * @return array
     */
    public function write(string $path, string $contents, Flyconfig $config)
    {
        $location = $this->adapter->applyPathPrefix($path);

        // using addFile instead of addFromString is more memory efficient
        $archive = (new \ReflectionClass($this->adapter))
            ->getProperty('archive');
        $archive->setAccessible(true);
        $archiveInstance = $archive->getValue($this->adapter);

        $archiveInstance->addFile($contents, $location);

        return compact('path', 'contents');
    }

    // Métodos wrapper para lo que uses en ZipArchiver
    public function __call($name, $arguments)
    {
        return $this->adapter->$name(...$arguments);
    }
}