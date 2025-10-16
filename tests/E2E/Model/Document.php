<?php
declare(strict_types=1);

namespace App\Tests\E2E\Model;

use App\Tests\E2E\PageObject\WorkareaPage;

/**
 * Lightweight value object representing a document currently open in the UI.
 * It stores a reference to the associated {@see WorkareaPage} so factories and
 * tests can continue interacting with the same browser session.
 */
final class Document
{
    private string $id;
    private string $title;
    private ?string $author;
    private WorkareaPage $workareaPage;

    public function __construct(
        WorkareaPage $workareaPage,
        string $title,
        ?string $author = null,
        ?string $id = null
    ) {
        $this->workareaPage = $workareaPage;
        $this->title = $title;
        $this->author = $author;
        $this->id = $id ?? uniqid('document_', true);
    }

    /**
     * Internal identifier used by the factories for bookkeeping.
     */
    public function getId(): string
    {
        return $this->id;
    }

    /**
     * Backwards compatible alias retained from the initial implementation.
     */
    public function getDocumentId(): string
    {
        return $this->getId();
    }

    public function getTitle(): string
    {
        return $this->title;
    }

    public function setTitle(string $title): void
    {
        $this->title = $title;
    }

    public function getAuthor(): ?string
    {
        return $this->author;
    }

    public function setAuthor(?string $author): void
    {
        $this->author = $author;
    }

    public function getWorkareaPage(): WorkareaPage
    {
        return $this->workareaPage;
    }

    /**
     * Refreshes cached metadata by inspecting the current UI state.
     */
    public function refreshFromUi(): void
    {
        $this->title = $this->workareaPage->getDocumentTitle();

        try {
            $this->author = $this->workareaPage->getDocumentAuthor();
        } catch (\Throwable) {
            // Some flows do not expose the author field; keep the last known value.
        }
    }

    /**
     * Returns a helper instance representing the root navigation node.
     */
    public function getRootNode(): Node
    {
        return Node::createRoot($this->workareaPage);
    }

    /**
     * Convenience: wrap the already-open workarea as a Document model.
     */
    public static function fromWorkarea(WorkareaPage $workarea): self
    {
        $title = $workarea->getDocumentTitle();
        return new self($workarea, $title, null);
    }

}

