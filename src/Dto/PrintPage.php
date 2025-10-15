<?php

namespace App\Dto;

/**
 * Represents a single page in the print view.
 */
class PrintPage
{
    public function __construct(
        private readonly string $id,
        private readonly string $title,
        private readonly int $level,
        private readonly string $content,
        private readonly string $anchor,
        private readonly array $ancestors = [],
    ) {
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function getTitle(): string
    {
        return $this->title;
    }

    public function getLevel(): int
    {
        return $this->level;
    }

    public function getContent(): string
    {
        return $this->content;
    }

    public function getAnchor(): string
    {
        return $this->anchor;
    }

    /**
     * @return string[]
     */
    public function getAncestors(): array
    {
        return $this->ancestors;
    }
}
