<?php

namespace App\Dto\Api\v2\Elp;

/**
 * Response DTO for ELP export.
 *
 * Returned by POST /api/v2/export/* endpoints.
 */
class ExportElpResponse
{
    public string $status;
    public ?string $outputUrl = null;
    public ?string $downloadToken = null;
    public array $files = [];
    public ?string $format = null;

    public function __construct(
        string $status,
        ?string $outputUrl = null,
        ?string $downloadToken = null,
        array $files = [],
        ?string $format = null,
    ) {
        $this->status = $status;
        $this->outputUrl = $outputUrl;
        $this->downloadToken = $downloadToken;
        $this->files = $files;
        $this->format = $format;
    }
}
