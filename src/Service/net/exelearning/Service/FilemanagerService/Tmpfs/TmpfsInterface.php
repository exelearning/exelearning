<?php

namespace App\Service\net\exelearning\Service\FilemanagerService\Tmpfs;

/**
 * Functions for tmpfs.
 */
interface TmpfsInterface
{
    public function exists(string $filename): bool;

    public function findAll($pattern): array;

    public function write(string $filename, $data, $append);

    public function read(string $filename): string;

    public function readStream(string $filename): array;

    public function remove(string $filename);

    public function getFileLocation(string $filename): string;

    public function clean(int $older_than);
}
