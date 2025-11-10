<?php

namespace App\Dto\Api\v2\Elp;

/**
 * Response DTO for ELP conversion.
 *
 * Returned by POST /api/v2/convert/elp endpoint.
 */
class ConvertElpResponse
{
    public string $status;
    public ?string $outputUrl = null;
    public ?string $fileName = null;
    public ?int $size = null;

    public function __construct(
        string $status,
        ?string $outputUrl = null,
        ?string $fileName = null,
        ?int $size = null,
    ) {
        $this->status = $status;
        $this->outputUrl = $outputUrl;
        $this->fileName = $fileName;
        $this->size = $size;
    }
}
