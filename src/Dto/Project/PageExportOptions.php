<?php

namespace App\Dto\Project;

/**
 * Options to limit an export to specific project pages.
 */
class PageExportOptions
{
    /** @var string[] */
    private array $pageIds;
    private string $primaryPageId;

    public function __construct(iterable $pageIds)
    {
        $normalized = [];
        foreach ($pageIds as $id) {
            $id = trim((string) $id);
            if ('' === $id) {
                continue;
            }
            $normalized[] = $id;
        }

        $normalized = array_values(array_unique($normalized));

        if (empty($normalized)) {
            throw new \InvalidArgumentException('At least one page id must be provided for export.');
        }

        $this->pageIds = $normalized;
        $this->primaryPageId = $normalized[0];
    }

    /**
     * @return string[]
     */
    public function getPageIds(): array
    {
        return $this->pageIds;
    }

    public function isSinglePage(): bool
    {
        return 1 === \count($this->pageIds);
    }

    public function getPrimaryPageId(): string
    {
        return $this->primaryPageId;
    }
}
