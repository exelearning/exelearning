<?php

namespace App\Dto\Api\v2\Elp;

use Symfony\Component\HttpFoundation\File\UploadedFile;

/**
 * Request DTO for exporting ELP files.
 *
 * Represents the input for POST /api/v2/export/* endpoints.
 */
class ExportElpRequest
{
    /**
     * Uploaded ELP file.
     */
    public ?UploadedFile $file = null;

    /**
     * Optional base URL for links.
     */
    public ?string $baseUrl = null;
}
