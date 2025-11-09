<?php

namespace App\Dto\Api\v2\Elp;

use Symfony\Component\HttpFoundation\File\UploadedFile;

/**
 * Request DTO for converting ELP files.
 *
 * Represents the input for POST /api/v2/convert/elp endpoint.
 */
class ConvertElpRequest
{
    /**
     * Uploaded ELP file.
     */
    public ?UploadedFile $file = null;
}
