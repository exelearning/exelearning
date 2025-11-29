<?php

namespace App\Dto\Project;

/**
 * Options to limit an export to specific project pages.
 */
class PageExportOptions
{
    /** @var string[] */
    private array $pageIds;

    public function __construct(iterable $pageIds, private readonly bool $includeDescendants = false)
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
    }

    /**
     * @return string[]
     */
    public function getPageIds(): array
    {
        return $this->pageIds;
    }

    public function includeDescendants(): bool
    {
        return $this->includeDescendants;
    }
}

