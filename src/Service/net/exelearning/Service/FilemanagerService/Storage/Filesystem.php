<?php

declare(strict_types=1);

namespace App\Service\net\exelearning\Service\FilemanagerService\Storage;

use App\Helper\net\exelearning\Helper\FileHelper;

/**
 * Filesystem wrapper for local storage using native PHP.
 *
 * It preserves the public API used by the application so you can
 * remove Flysystem without touching the rest of your code.
 */
class Filesystem
{
    /** @var FileHelper */
    private $fileHelper;

    /** @var string */
    protected $separator;

    /** @var string Path prefix applied to all operations (virtual root) */
    protected $path_prefix;

    /** @var string Base path for the current session (physical root) */
    protected $sessionPath;

    public function __construct(FileHelper $fileHelper)
    {
        $this->separator = '/';
        $this->path_prefix = $this->separator;
        $this->fileHelper = $fileHelper;
    }

    /**
     * Create a directory inside destination path.
     */
    public function createDir(string $path, string $name)
    {
        $destination = $this->joinPaths($this->applyPathPrefix($path), $name);
        $abs = $this->absPath($destination);
        if (is_dir($abs)) {
            return true;
        }

        return @mkdir($abs, 0775, true);
    }

    /**
     * Create an empty file at destination path.
     */
    public function createFile(string $path, string $name)
    {
        $destination = $this->joinPaths($this->applyPathPrefix($path), $name);
        $abs = $this->absPath($destination);

        while ($this->fileExists($destination)) {
            $destination = $this->upcountName($destination);
        }
        $abs = $this->absPath($destination);

        $dir = \dirname($abs);
        if (!is_dir($dir) && !@mkdir($dir, 0775, true)) {
            throw new \RuntimeException('Cannot create directory: '.$dir);
        }

        $fh = @fopen($abs, 'wb');
        if (!is_resource($fh)) {
            throw new \RuntimeException('Cannot create file: '.$abs);
        }
        fclose($fh);

        return true;
    }

    public function fileExists(string $path)
    {
        $path = $this->applyPathPrefix($path);

        return file_exists($this->absPath($path));
    }

    public function isDir(string $path)
    {
        $path = $this->applyPathPrefix($path);

        return is_dir($this->absPath($path));
    }

    public function copyFile(string $source, string $destination)
    {
        $source = $this->applyPathPrefix($source);
        $destination = $this->joinPaths($this->applyPathPrefix($destination), $this->getBaseName($source));

        while ($this->fileExists($destination)) {
            $destination = $this->upcountName($destination);
        }

        $srcAbs = $this->absPath($source);
        $dstAbs = $this->absPath($destination);

        $dir = \dirname($dstAbs);
        if (!is_dir($dir) && !@mkdir($dir, 0775, true)) {
            throw new \RuntimeException('Cannot create directory: '.$dir);
        }

        return @copy($srcAbs, $dstAbs);
    }

    public function copyDir(string $source, string $destination)
    {
        $source = $this->applyPathPrefix($this->addSeparators($source));
        $destination = $this->applyPathPrefix($this->addSeparators($destination));

        $source_dir = $this->getBaseName($source);
        $real_destination = $this->joinPaths($destination, $source_dir);

        $srcAbs = $this->absPath($source);
        $dstAbs = $this->absPath($real_destination);

        // Ensure a non-colliding destination name
        while ($this->dirNotEmpty($real_destination)) {
            $real_destination = $this->upcountName($real_destination);
            $dstAbs = $this->absPath($real_destination);
        }

        if (!is_dir($srcAbs)) {
            // If source is empty/nonexistent, just create the directory
            return @mkdir($dstAbs, 0775, true);
        }

        $it = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($srcAbs, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($it as $item) {
            $rel = ltrim(str_replace($srcAbs, '', $item->getPathname()), DIRECTORY_SEPARATOR);
            $target = $this->absPath($this->joinPaths($real_destination, str_replace(DIRECTORY_SEPARATOR, '/', $rel)));

            if ($item->isDir()) {
                if (!is_dir($target) && !@mkdir($target, 0775, true)) {
                    throw new \RuntimeException('Cannot create directory: '.$target);
                }
            } else {
                $dir = \dirname($target);
                if (!is_dir($dir) && !@mkdir($dir, 0775, true)) {
                    throw new \RuntimeException('Cannot create directory: '.$dir);
                }
                if (!@copy($item->getPathname(), $target)) {
                    throw new \RuntimeException('Cannot copy file to: '.$target);
                }
            }
        }

        return true;
    }

    public function deleteDir(string $path)
    {
        $abs = $this->absPath($this->applyPathPrefix($path));
        if (!is_dir($abs)) {
            return true;
        }
        $it = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($abs, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($it as $fileinfo) {
            $fileinfo->isDir() ? @rmdir($fileinfo->getPathname()) : @unlink($fileinfo->getPathname());
        }

        return @rmdir($abs);
    }

    public function deleteFile(string $path)
    {
        $abs = $this->absPath($this->applyPathPrefix($path));
        if (is_file($abs)) {
            return @unlink($abs);
        }

        return true;
    }

    /**
     * Return a readable stream for a file plus metadata.
     *
     * @return array{filename:string,stream:resource,filesize:int}
     */
    public function readStream(string $path): array
    {
        if ($this->isDir($path)) {
            throw new \Exception('Cannot stream directory');
        }

        $abs = $this->absPath($this->applyPathPrefix($path));
        $fh = @fopen($abs, 'rb');
        if (!is_resource($fh)) {
            throw new \RuntimeException('Cannot open stream for: '.$abs);
        }

        return [
            'filename' => $this->getBaseName($path),
            'stream' => $fh,
            'filesize' => @filesize($abs) ?: 0,
        ];
    }

    public function move(string $from, string $to): bool
    {
        $from = $this->applyPathPrefix($from);
        $to = $this->applyPathPrefix($to);

        while ($this->fileExists($to)) {
            $to = $this->upcountName($to);
        }

        $fromAbs = $this->absPath($from);
        $toAbs = $this->absPath($to);

        $dir = \dirname($toAbs);
        if (!is_dir($dir) && !@mkdir($dir, 0775, true)) {
            throw new \RuntimeException('Cannot create directory: '.$dir);
        }

        return @rename($fromAbs, $toAbs);
    }

    public function rename(string $destination, string $from, string $to): bool
    {
        $from = $this->joinPaths($this->applyPathPrefix($destination), $from);
        $to = $this->joinPaths($this->applyPathPrefix($destination), $to);

        while ($this->fileExists($to)) {
            $to = $this->upcountName($to);
        }

        $fromAbs = $this->absPath($from);
        $toAbs = $this->absPath($to);

        $dir = \dirname($toAbs);
        if (!is_dir($dir) && !@mkdir($dir, 0775, true)) {
            throw new \RuntimeException('Cannot create directory: '.$dir);
        }

        return @rename($fromAbs, $toAbs);
    }

    /**
     * Store a file by streaming it to disk.
     */
    public function store(string $path, string $name, $resource, bool $overwrite = false): bool
    {
        $destination = $this->joinPaths($this->applyPathPrefix($path), $name);

        while ($this->fileExists($destination)) {
            if ($overwrite) {
                $this->deleteFile($destination);
                break;
            }
            $destination = $this->upcountName($destination);
        }

        $abs = $this->absPath($destination);
        $dir = \dirname($abs);
        if (!is_dir($dir) && !@mkdir($dir, 0775, true)) {
            throw new \RuntimeException('Cannot create directory: '.$dir);
        }

        if (!is_resource($resource)) {
            throw new \InvalidArgumentException('store() expects a stream resource');
        }

        $out = @fopen($abs, 'wb');
        if (!is_resource($out)) {
            throw new \RuntimeException('Cannot open destination for writing: '.$abs);
        }

        stream_copy_to_stream($resource, $out);
        fclose($out);

        return true;
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

    /**
     * Build a DirectoryCollection for a given path.
     * Mirrors the previous Flysystem-based behavior.
     */
    public function getDirectoryCollection(string $path, bool $recursive = false): DirectoryCollection
    {
        $collection = new DirectoryCollection($path);

        $base = $this->absPath($this->applyPathPrefix($path));
        if (!is_dir($base)) {
            if (!$recursive && $this->addSeparators($path) !== $this->separator) {
                $collection->addFile('back', $this->getParent($path), '..', 0, 0);
            }

            return $collection;
        }

        if ($recursive) {
            $it = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($base, \FilesystemIterator::SKIP_DOTS),
                \RecursiveIteratorIterator::SELF_FIRST
            );
            foreach ($it as $fileinfo) {
                $rel = ltrim(str_replace($base, '', $fileinfo->getPathname()), DIRECTORY_SEPARATOR);
                $userpath = $this->stripPathPrefix($this->joinPaths($path, str_replace(DIRECTORY_SEPARATOR, '/', $rel)));

                $type = $fileinfo->isDir() ? 'dir' : 'file';
                $name = $fileinfo->getBasename();
                $size = $fileinfo->isDir() ? 0 : ($fileinfo->getSize() ?: 0);
                $timestamp = $fileinfo->getMTime() ?: 0;

                $collection->addFile($type, $userpath, $name, $size, $timestamp);
            }
        } else {
            $it = new \FilesystemIterator($base, \FilesystemIterator::SKIP_DOTS);
            foreach ($it as $fileinfo) {
                $type = $fileinfo->isDir() ? 'dir' : 'file';
                $name = $fileinfo->getBasename();
                $userpath = $this->stripPathPrefix($this->joinPaths($path, $name));
                $size = $fileinfo->isDir() ? 0 : ($fileinfo->getSize() ?: 0);
                $timestamp = $fileinfo->getMTime() ?: 0;

                $collection->addFile($type, $userpath, $name, $size, $timestamp);
            }
        }

        if (!$recursive && $this->addSeparators($path) !== $this->separator) {
            $collection->addFile('back', $this->getParent($path), '..', 0, 0);
        }

        return $collection;
    }

    /**
     * Return absolute path on disk for a virtual path (sessionPath + relative).
     */
    private function absPath(string $virtualPath): string
    {
        $root = rtrim($this->sessionPath ?? '', DIRECTORY_SEPARATOR);
        if ('' === $root) {
            throw new \LogicException('Session path is not set.');
        }
        // Normalize to OS separators
        $virtualPath = ltrim($virtualPath, $this->separator);
        $path = $root.DIRECTORY_SEPARATOR.str_replace($this->separator, DIRECTORY_SEPARATOR, $virtualPath);

        // Prevent path traversal above the root
        $normalized = $this->normalizeAbsolutePath($path);
        $normalizedRoot = $this->normalizeAbsolutePath($root);

        if (0 !== strpos($normalized, $normalizedRoot)) {
            throw new \RuntimeException('Path traversal detected: '.$virtualPath);
        }

        return $normalized;
    }

    /**
     * Normalize absolute path without resolving symlinks (portable realpath).
     */
    private function normalizeAbsolutePath(string $abs): string
    {
        $parts = [];
        foreach (explode(DIRECTORY_SEPARATOR, $abs) as $seg) {
            if ('' === $seg || '.' === $seg) {
                continue;
            }
            if ('..' === $seg) {
                array_pop($parts);
                continue;
            }
            $parts[] = $seg;
        }
        $prefix = DIRECTORY_SEPARATOR;
        if (1 === preg_match('~^[A-Za-z]:\\\\~', $abs)) { // Windows drive
            $prefix = '';
        }

        return $prefix.implode(DIRECTORY_SEPARATOR, $parts);
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
            '..' === $path
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
     * Check whether the given virtual directory has any contents.
     */
    private function dirNotEmpty(string $virtualDir): bool
    {
        $abs = $this->absPath($virtualDir);
        if (!is_dir($abs)) {
            return false;
        }
        $it = new \FilesystemIterator($abs, \FilesystemIterator::SKIP_DOTS);

        return $it->valid();
    }
}
