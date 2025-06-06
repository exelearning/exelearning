<?php

namespace App\Service\net\exelearning\Service\FilemanagerService\Storage;

use App\Helper\net\exelearning\Helper\FileHelper;
use League\Flysystem\Adapter\Local;
use League\Flysystem\Filesystem as Flysystem;

/**
 * Implements Flysystem to the filemanager.
 */
class Filesystem
{
    private $fileHelper;

    protected $separator;

    protected $storage;

    protected $path_prefix;

    protected $sessionPath;

    public function __construct(FileHelper $fileHelper)
    {
        $this->separator = '/';
        $this->path_prefix = $this->separator;
        $this->fileHelper = $fileHelper;
    }

    /**
     * Create Dir in the destination selected.
     */
    public function createDir(string $path, string $name)
    {
        // Initialice Flysystem
        $fileManagerDirPath = $this->sessionPath;
        $this->setFlysystem($fileManagerDirPath);

        $destination = $this->joinPaths($this->applyPathPrefix($path), $name);

        return $this->storage->createDir($destination);
    }

    /**
     * Create File in the destination selected.
     */
    public function createFile(string $path, string $name)
    {
        // Initialice Flysystem
        $fileManagerDirPath = $this->sessionPath;
        $this->setFlysystem($fileManagerDirPath);

        $destination = $this->joinPaths($this->applyPathPrefix($path), $name);

        while ($this->storage->has($destination)) {
            $destination = $this->upcountName($destination);
        }
        $this->storage->put($destination, '');
    }

    public function fileExists(string $path)
    {
        $path = $this->applyPathPrefix($path);

        return $this->storage->has($path);
    }

    public function isDir(string $path)
    {
        $path = $this->applyPathPrefix($path);

        return false === $this->storage->getSize($path);
    }

    public function copyFile(string $source, string $destination)
    {
        $source = $this->applyPathPrefix($source);
        $destination = $this->joinPaths($this->applyPathPrefix($destination), $this->getBaseName($source));

        // Initialice Flysystem
        $fileManagerDirPath = $this->sessionPath;
        $this->setFlysystem($fileManagerDirPath);

        while ($this->storage->has($destination)) {
            $destination = $this->upcountName($destination);
        }

        return $this->storage->copy($source, $destination);
    }

    public function copyDir(string $source, string $destination)
    {
        $source = $this->applyPathPrefix($this->addSeparators($source));
        $destination = $this->applyPathPrefix($this->addSeparators($destination));
        $source_dir = $this->getBaseName($source);
        $real_destination = $this->joinPaths($destination, $source_dir);

        // Initialice Flysystem
        $fileManagerDirPath = $this->sessionPath;
        $this->setFlysystem($fileManagerDirPath);

        while (!empty($this->storage->listContents($real_destination, true))) {
            $real_destination = $this->upcountName($real_destination);
        }
        $contents = $this->storage->listContents($source, true);
        if (empty($contents)) {
            $this->storage->createDir($real_destination);
        }
        foreach ($contents as $file) {
            $source_path = $this->separator.ltrim($file['path'], $this->separator);
            $path = substr($source_path, strlen($source), strlen($source_path));

            if ('dir' == $file['type']) {
                $this->storage->createDir($this->joinPaths($real_destination, $path));
                continue;
            }

            if ('file' == $file['type']) {
                $this->storage->copy($file['path'], $this->joinPaths($real_destination, $path));
            }
        }
    }

    public function deleteDir(string $path)
    {
        // Initialice Flysystem
        $fileManagerDirPath = $this->sessionPath;
        $this->setFlysystem($fileManagerDirPath);

        return $this->storage->deleteDir($this->applyPathPrefix($path));
    }

    public function deleteFile(string $path)
    {
        // Initialice Flysystem
        $fileManagerDirPath = $this->sessionPath;
        $this->setFlysystem($fileManagerDirPath);

        return $this->storage->delete($this->applyPathPrefix($path));
    }

    public function readStream(string $path): array
    {
        // Initialice Flysystem
        $fileManagerDirPath = $this->sessionPath;
        $this->setFlysystem($fileManagerDirPath);

        if ($this->isDir($path)) {
            throw new \Exception('Cannot stream directory');
        }

        $path = $this->applyPathPrefix($path);

        return [
            'filename' => $this->getBaseName($path),
            'stream' => $this->storage->readStream($path),
            'filesize' => $this->storage->getSize($path),
        ];
    }

    public function move(string $from, string $to): bool
    {
        $from = $this->applyPathPrefix($from);
        $to = $this->applyPathPrefix($to);

        // Initialice Flysystem
        $fileManagerDirPath = $this->sessionPath;
        $this->setFlysystem($fileManagerDirPath);

        while ($this->storage->has($to)) {
            $to = $this->upcountName($to);
        }

        return $this->storage->rename($from, $to);
    }

    public function rename(string $destination, string $from, string $to): bool
    {
        $from = $this->joinPaths($this->applyPathPrefix($destination), $from);
        $to = $this->joinPaths($this->applyPathPrefix($destination), $to);

        // Initialice Flysystem
        $fileManagerDirPath = $this->sessionPath;
        $this->setFlysystem($fileManagerDirPath);

        while ($this->storage->has($to)) {
            $to = $this->upcountName($to);
        }

        return $this->storage->rename($from, $to);
    }

    public function store(string $path, string $name, $resource, bool $overwrite = false): bool
    {
        $destination = $this->joinPaths($this->applyPathPrefix($path), $name);

        // Initialice Flysystem
        $fileManagerDirPath = $this->sessionPath;
        $this->setFlysystem($fileManagerDirPath);

        while ($this->storage->has($destination)) {
            if ($overwrite) {
                $this->storage->delete($destination);
            } else {
                $destination = $this->upcountName($destination);
            }
        }

        return $this->storage->putStream($destination, $resource);
    }

    public function setPathPrefix(string $path_prefix)
    {
        $this->path_prefix = $this->addSeparators($path_prefix);
    }

    public function setSessionPath(string $sessionPath)
    {
        $this->sessionPath = $sessionPath;
    }

    public function getSeparator()
    {
        return $this->separator;
    }

    public function getPathPrefix(): string
    {
        return $this->path_prefix;
    }

    public function getSessionPath(): string
    {
        return $this->sessionPath;
    }

    public function getDirectoryCollection(string $path, bool $recursive = false): DirectoryCollection
    {
        $collection = new DirectoryCollection($path);

        // Initialice Flysystem
        $fileManagerDirPath = $this->sessionPath;
        $this->setFlysystem($fileManagerDirPath);

        foreach ($this->storage->listContents($this->applyPathPrefix($path), $recursive) as $entry) {
            // By default only 'path' and 'type' is present
            $name = $this->getBaseName($entry['path']);
            $userpath = $this->stripPathPrefix($entry['path']);
            $dirname = isset($entry['dirname']) ? $entry['dirname'] : $path;
            $size = isset($entry['size']) ? $entry['size'] : 0;
            $timestamp = isset($entry['timestamp']) ? $entry['timestamp'] : 0;

            $collection->addFile($entry['type'], $userpath, $name, $size, $timestamp);
        }

        if (!$recursive && $this->addSeparators($path) !== $this->separator) {
            $collection->addFile('back', $this->getParent($path), '..', 0, 0);
        }

        return $collection;
    }

    protected function upcountCallback($matches)
    {
        $index = isset($matches[1]) ? intval($matches[1]) + 1 : 1;
        $ext = isset($matches[2]) ? $matches[2] : '';

        return '_'.$index.$ext;
    }

    protected function upcountName($name)
    {
        return preg_replace_callback(
            '/(?:(?:_([\d]+))?(\.[^.]+))?$/',
            [$this, 'upcountCallback'],
            $name,
            1
        );
    }

    private function applyPathPrefix(string $path): string
    {
        if (
            '..' == $path
            || false !== strpos($path, '..'.$this->separator)
            || false !== strpos($path, $this->separator.'..')
        ) {
            $path = $this->separator;
        }

        return $this->joinPaths($this->getPathPrefix(), $path);
    }

    private function stripPathPrefix(string $path): string
    {
        $path = $this->separator.ltrim($path, $this->separator);

        if (substr($path, 0, strlen($this->getPathPrefix())) == $this->getPathPrefix()) {
            $path = $this->separator.substr($path, strlen($this->getPathPrefix()));
        }

        return $path;
    }

    private function addSeparators(string $dir): string
    {
        if (!$dir || $dir == $this->separator || !trim($dir, $this->separator)) {
            return $this->separator;
        }

        return $this->separator.trim($dir, $this->separator).$this->separator;
    }

    private function joinPaths(string $path1, string $path2): string
    {
        if (!$path2 || !trim($path2, $this->separator)) {
            return $this->addSeparators($path1);
        }

        return $this->addSeparators($path1).ltrim($path2, $this->separator);
    }

    private function getParent(string $dir): string
    {
        if (!$dir || $dir == $this->separator || !trim($dir, $this->separator)) {
            return $this->separator;
        }

        $tmp = explode($this->separator, trim($dir, $this->separator));
        array_pop($tmp);

        return $this->separator.trim(implode($this->separator, $tmp), $this->separator);
    }

    private function getBaseName(string $path): string
    {
        if (!$path || $path == $this->separator || !trim($path, $this->separator)) {
            return $this->separator;
        }

        $tmp = explode($this->separator, trim($path, $this->separator));

        return (string) array_pop($tmp);
    }

    /**
     * Initialice flysystem with path.
     */
    private function setFlysystem(string $path)
    {
        $adapter = new Local($path);
        $this->storage = new Flysystem($adapter);
    }
}
