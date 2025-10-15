<?php

namespace App\Dto;

/**
 * Aggregates metadata and the ordered list of pages for the print view.
 */
class PrintDocument
{
    /**
     * @param PrintPage[] $pages
     */
    public function __construct(
        private readonly string $projectId,
        private readonly string $title,
        private readonly string $author,
        private readonly ?string $description,
        private readonly string $language,
        private readonly \DateTimeImmutable $generatedAt,
        private readonly array $pages,
    ) {
    }

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function getTitle(): string
    {
        return $this->title;
    }

    public function getAuthor(): string
    {
        return $this->author;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function getLanguage(): string
    {
        return $this->language;
    }

    public function getGeneratedAt(): \DateTimeImmutable
    {
        return $this->generatedAt;
    }

    /**
     * @return PrintPage[]
     */
    public function getPages(): array
    {
        return $this->pages;
    }
}
